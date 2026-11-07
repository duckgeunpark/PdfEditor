import { PDFDocument, PDFFont, PDFPage, degrees, rgb, LineCapStyle } from "@cantoo/pdf-lib";
import fontkit from "@cantoo/fontkit";
import type { CropBox, DrawObject, ZipEntry } from "../types";

async function readAsBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

export class PasswordProtectedPdfError extends Error {
  constructor() {
    super("이 PDF는 비밀번호로 보호되어 있어 열 수 없습니다.");
    this.name = "PasswordProtectedPdfError";
  }
}

/**
 * Loads a PDF, transparently decrypting it if it uses the common
 * empty-user-password encryption (no real protection, just a leftover
 * from scanners/office tools). A PDF locked with a real, unknown password
 * throws PasswordProtectedPdfError instead of silently producing blank
 * pages, which plain `PDFDocument.load` would do since it cannot decrypt
 * content streams without the right key.
 */
async function loadPdfDocument(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { password: "" });
  } catch (e) {
    if (e instanceof Error && e.message === "NEEDS PASSWORD") {
      throw new PasswordProtectedPdfError();
    }
    throw e;
  }
}

export async function loadPdf(file: File): Promise<PDFDocument> {
  const bytes = await readAsBytes(file);
  return loadPdfDocument(bytes);
}

export async function getPageCount(file: File): Promise<number> {
  const doc = await loadPdf(file);
  return doc.getPageCount();
}

let koreanFontBytesPromise: Promise<ArrayBuffer> | null = null;

/** Lazily fetched only when a document actually contains a text drawing. */
function loadKoreanFontBytes(): Promise<ArrayBuffer> {
  if (!koreanFontBytesPromise) {
    koreanFontBytesPromise = fetch("/fonts/NanumGothic-Regular.ttf").then((res) => {
      if (!res.ok) throw new Error("한글 폰트를 불러오지 못했습니다.");
      return res.arrayBuffer();
    });
  }
  return koreanFontBytesPromise;
}

/**
 * Returns a function that embeds and caches the Korean text-annotation font
 * on first call, so a document with no text drawings never pays for the
 * font fetch/embed at all, and one with several only pays for it once.
 */
function makeFontLoader(doc: PDFDocument): () => Promise<PDFFont> {
  let fontPromise: Promise<PDFFont> | null = null;
  return () => {
    if (!fontPromise) {
      doc.registerFontkit(fontkit);
      fontPromise = loadKoreanFontBytes().then((bytes) => doc.embedFont(bytes, { subset: true }));
    }
    return fontPromise;
  };
}

function hexToColor(hex: string) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/** Draws a simple two-stroke arrowhead at `to`, pointing away from `from`. */
function drawArrowhead(
  page: PDFPage,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: ReturnType<typeof rgb>,
  thickness: number,
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const headLength = Math.max(10, thickness * 4);
  const headAngle = Math.PI / 7;
  for (const sign of [1, -1]) {
    page.drawLine({
      start: to,
      end: {
        x: to.x - headLength * Math.cos(angle - sign * headAngle),
        y: to.y - headLength * Math.sin(angle - sign * headAngle),
      },
      thickness,
      color,
      lineCap: LineCapStyle.Round,
    });
  }
}

/**
 * Bakes a page's drawings into its content stream. Coordinates are already
 * in the page's raw MediaBox space (bottom-left origin) by this point — the
 * UI converts from display space at the DrawModal boundary, the same way
 * CropModal converts a crop box before it ever reaches PageState.
 */
async function bakeDrawings(page: PDFPage, drawings: DrawObject[], getFont: () => Promise<PDFFont>) {
  for (const obj of drawings) {
    const color = hexToColor(obj.color);
    switch (obj.kind) {
      case "path": {
        for (let i = 0; i < obj.points.length - 1; i++) {
          page.drawLine({
            start: obj.points[i],
            end: obj.points[i + 1],
            thickness: obj.strokeWidth,
            color,
            lineCap: LineCapStyle.Round,
          });
        }
        break;
      }
      case "line": {
        page.drawLine({
          start: { x: obj.x1, y: obj.y1 },
          end: { x: obj.x2, y: obj.y2 },
          thickness: obj.strokeWidth,
          color,
          lineCap: LineCapStyle.Round,
        });
        break;
      }
      case "arrow": {
        const start = { x: obj.x1, y: obj.y1 };
        const end = { x: obj.x2, y: obj.y2 };
        page.drawLine({ start, end, thickness: obj.strokeWidth, color, lineCap: LineCapStyle.Round });
        drawArrowhead(page, start, end, color, obj.strokeWidth);
        break;
      }
      case "rect": {
        page.drawRectangle({
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height,
          borderColor: color,
          borderWidth: obj.strokeWidth,
        });
        break;
      }
      case "text": {
        const font = await getFont();
        page.drawText(obj.text, { x: obj.x, y: obj.y, size: obj.fontSize, font, color });
        break;
      }
    }
  }
}

export interface PageEditSpec {
  originalIndex: number;
  rotationDelta: 0 | 90 | 180 | 270;
  cropBox: CropBox | null;
  drawings: DrawObject[];
}

/**
 * Builds a new PDF from the source file using the given page order/edits.
 * Each spec's rotationDelta is added on top of the page's existing rotation,
 * and cropBox (if present) is in PDF point space with a bottom-left origin.
 */
export async function buildEditedPdf(
  file: File,
  specs: PageEditSpec[],
): Promise<Uint8Array> {
  const srcBytes = await readAsBytes(file);
  const srcDoc = await loadPdfDocument(srcBytes);
  const outDoc = await PDFDocument.create();
  const getFont = makeFontLoader(outDoc);

  const indexes = specs.map((s) => s.originalIndex);
  const copiedPages = await outDoc.copyPages(srcDoc, indexes);

  for (let i = 0; i < copiedPages.length; i++) {
    const page = copiedPages[i];
    const spec = specs[i];
    outDoc.addPage(page);

    if (spec.rotationDelta) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + spec.rotationDelta) % 360));
    }

    if (spec.cropBox) {
      const { x, y, width, height } = spec.cropBox;
      page.setCropBox(x, y, width, height);
      page.setMediaBox(x, y, width, height);
    }

    if (spec.drawings.length > 0) {
      await bakeDrawings(page, spec.drawings, getFont);
    }
  }

  return outDoc.save();
}

export interface MultiSourcePageEditSpec {
  file: File;
  originalIndex: number;
  rotationDelta: 0 | 90 | 180 | 270;
  cropBox: CropBox | null;
  drawings: DrawObject[];
}

/**
 * Like buildEditedPdf, but each spec carries its own source file — used by
 * the page editor once multiple PDFs have been merged into one session.
 * Pages are grouped by source file so each source is loaded once and
 * copyPages is called once per source (one call per page would make
 * pdf-lib re-embed every shared font/image for every page instead of
 * deduplicating them), then reassembled into the original spec order.
 */
export async function buildEditedPdfFromSources(
  specs: MultiSourcePageEditSpec[],
): Promise<Uint8Array> {
  const outDoc = await PDFDocument.create();
  const getFont = makeFontLoader(outDoc);
  const specIndexesBySource = new Map<File, number[]>();

  specs.forEach((spec, i) => {
    const list = specIndexesBySource.get(spec.file);
    if (list) list.push(i);
    else specIndexesBySource.set(spec.file, [i]);
  });

  const copiedPages = new Array<PDFPage>(specs.length);
  for (const [file, specIndexes] of specIndexesBySource) {
    const srcDoc = await loadPdf(file);
    const pages = await outDoc.copyPages(
      srcDoc,
      specIndexes.map((i) => specs[i].originalIndex),
    );
    specIndexes.forEach((specIndex, k) => {
      copiedPages[specIndex] = pages[k];
    });
  }

  for (let i = 0; i < copiedPages.length; i++) {
    const page = copiedPages[i];
    const spec = specs[i];
    outDoc.addPage(page);

    if (spec.rotationDelta) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + spec.rotationDelta) % 360));
    }

    if (spec.cropBox) {
      const { x, y, width, height } = spec.cropBox;
      page.setCropBox(x, y, width, height);
      page.setMediaBox(x, y, width, height);
    }

    if (spec.drawings.length > 0) {
      await bakeDrawings(page, spec.drawings, getFont);
    }
  }

  return outDoc.save();
}

export async function splitToIndividualPdfs(file: File): Promise<ZipEntry[]> {
  const bytes = await readAsBytes(file);
  const srcDoc = await loadPdfDocument(bytes);
  const pageCount = srcDoc.getPageCount();
  const baseName = file.name.replace(/\.pdf$/i, "");
  const entries: ZipEntry[] = [];

  const padLength = String(pageCount).length;

  for (let i = 0; i < pageCount; i++) {
    const outDoc = await PDFDocument.create();
    const [page] = await outDoc.copyPages(srcDoc, [i]);
    outDoc.addPage(page);
    const pdfBytes = await outDoc.save();
    const pageNumber = String(i + 1).padStart(padLength, "0");
    entries.push({
      name: `${baseName}_page_${pageNumber}.pdf`,
      bytes: pdfBytes,
    });
  }

  return entries;
}

/**
 * Parses a comma-separated page-range string like "1-4,7,9-10" (1-based,
 * inclusive) into groups of 0-based page indices — one group per output
 * file. Throws with a Korean, user-facing message on invalid input.
 */
export function parsePageRanges(input: string, totalPages: number): number[][] {
  const groups = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (groups.length === 0) {
    throw new Error("최소 하나의 범위를 입력하세요. 예: 1-4,7,9-10");
  }

  return groups.map((group) => {
    const match = group.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) {
      throw new Error(`"${group}"은(는) 올바른 범위가 아닙니다. 예: 1-4 또는 7`);
    }
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    if (start < 1 || end > totalPages || start > end) {
      throw new Error(`"${group}"이(가) 전체 페이지 범위(1-${totalPages})를 벗어났습니다.`);
    }
    const indices: number[] = [];
    for (let p = start; p <= end; p++) indices.push(p - 1);
    return indices;
  });
}

export async function splitByRanges(file: File, ranges: number[][]): Promise<ZipEntry[]> {
  const baseName = file.name.replace(/\.pdf$/i, "");
  const entries: ZipEntry[] = [];

  for (const indices of ranges) {
    const specs: PageEditSpec[] = indices.map((originalIndex) => ({
      originalIndex,
      rotationDelta: 0,
      cropBox: null,
      drawings: [],
    }));
    const bytes = await buildEditedPdf(file, specs);
    const first = indices[0] + 1;
    const last = indices[indices.length - 1] + 1;
    const label = first === last ? `${first}` : `${first}-${last}`;
    entries.push({ name: `${baseName}_pages_${label}.pdf`, bytes });
  }

  return entries;
}

export async function imagesToPdf(images: File[]): Promise<Uint8Array> {
  const outDoc = await PDFDocument.create();

  for (const image of images) {
    const bytes = await readAsBytes(image);
    const isPng = /\.png$/i.test(image.name) || image.type === "image/png";
    let embedded;
    try {
      embedded = isPng ? await outDoc.embedPng(bytes) : await outDoc.embedJpg(bytes);
    } catch {
      // Name/MIME can lie about the actual encoding; fall back to the other format.
      embedded = isPng ? await outDoc.embedJpg(bytes) : await outDoc.embedPng(bytes);
    }

    const page = outDoc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
    });
  }

  return outDoc.save();
}
