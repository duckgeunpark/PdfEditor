import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { displayDimensions, rawToDisplayBox, type Rotation } from "./rotationMath";
import type { CropBox } from "../types";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface RenderedPage {
  thumbnail: string;
  width: number;
  height: number;
  intrinsicRotation: Rotation;
}

export interface CropForRender {
  box: CropBox;
  rawWidth: number;
  rawHeight: number;
}

function cropCanvasToDisplayBox(
  source: HTMLCanvasElement,
  displayBox: CropBox,
  displayHeight: number,
  scale: number,
): HTMLCanvasElement {
  const sx = displayBox.x * scale;
  const sy = (displayHeight - displayBox.y - displayBox.height) * scale;
  const sw = displayBox.width * scale;
  const sh = displayBox.height * scale;

  const cropped = document.createElement("canvas");
  cropped.width = Math.max(1, Math.round(sw));
  cropped.height = Math.max(1, Math.round(sh));
  const ctx = cropped.getContext("2d")!;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, cropped.width, cropped.height);
  return cropped;
}

async function withPdfDocument<T>(
  file: File,
  fn: (doc: pdfjsLib.PDFDocumentProxy) => Promise<T>,
): Promise<T> {
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: buf,
    // Without these, pages using non-embedded/CJK fonts, JBIG2/JPX-encoded
    // scanned images, or ICC color profiles render blank, garbled, or with
    // missing images.
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    iccUrl: "/pdfjs/iccs/",
    wasmUrl: "/pdfjs/wasm/",
  });
  try {
    const doc = await loadingTask.promise;
    return await fn(doc);
  } finally {
    await loadingTask.destroy();
  }
}

export async function getPageCountPdfjs(file: File): Promise<number> {
  return withPdfDocument(file, async (doc) => doc.numPages);
}

/**
 * Renders every page of a PDF file to a PNG data URL thumbnail.
 * width/height are the page's native size in PDF points (rotation-independent).
 */
export async function renderAllThumbnails(
  file: File,
  targetWidth = 220,
): Promise<RenderedPage[]> {
  return withPdfDocument(file, async (doc) => {
    const results: RenderedPage[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;

      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const unrotated = page.getViewport({ scale: 1, rotation: 0 });

      results.push({
        thumbnail: canvas.toDataURL("image/png"),
        width: unrotated.width,
        height: unrotated.height,
        intrinsicRotation: page.rotate as Rotation,
      });

      page.cleanup();
    }

    return results;
  });
}

export async function renderPageToCanvas(
  file: File,
  pageIndex: number,
  scale: number,
  rotation?: 0 | 90 | 180 | 270,
  crop?: CropForRender,
): Promise<HTMLCanvasElement> {
  return withPdfDocument(file, async (doc) => {
    const page = await doc.getPage(pageIndex + 1);
    const effectiveRotation = (rotation ?? page.rotate) as Rotation;
    const viewport = page.getViewport({ scale, rotation: effectiveRotation });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    page.cleanup();

    if (!crop) return canvas;

    const displayBox = rawToDisplayBox(
      crop.box,
      crop.rawWidth,
      crop.rawHeight,
      effectiveRotation,
    );
    const displayHeight =
      effectiveRotation === 90 || effectiveRotation === 270 ? crop.rawWidth : crop.rawHeight;
    return cropCanvasToDisplayBox(canvas, displayBox, displayHeight, scale);
  });
}

/**
 * Renders just the cropped region of a page (at roughly targetWidth pixels
 * wide) as a PNG data URL — used to make the grid thumbnail reflect an
 * applied crop instead of always showing the full, uncropped page.
 */
export async function renderCroppedThumbnail(
  file: File,
  pageIndex: number,
  crop: CropForRender,
  intrinsicRotation: Rotation,
  targetWidth = 220,
): Promise<string> {
  const displayBox = rawToDisplayBox(crop.box, crop.rawWidth, crop.rawHeight, intrinsicRotation);
  const scale = targetWidth / displayBox.width;
  const canvas = await renderPageToCanvas(file, pageIndex, scale, intrinsicRotation, crop);
  return canvas.toDataURL("image/png");
}

/**
 * Renders the full, uncropped page as a PNG data URL — used to restore the
 * grid thumbnail after a previously-applied crop is removed.
 */
export async function renderPageThumbnail(
  file: File,
  pageIndex: number,
  rawWidth: number,
  rawHeight: number,
  intrinsicRotation: Rotation,
  targetWidth = 220,
): Promise<string> {
  const { width: dispWidth } = displayDimensions(rawWidth, rawHeight, intrinsicRotation);
  const scale = targetWidth / dispWidth;
  const canvas = await renderPageToCanvas(file, pageIndex, scale, intrinsicRotation);
  return canvas.toDataURL("image/png");
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob failed"))),
      mime,
      quality,
    );
  });
}

export async function convertPdfToImages(
  file: File,
  format: "png" | "jpeg",
  scale: number,
  quality = 0.92,
): Promise<{ name: string; blob: Blob }[]> {
  return withPdfDocument(file, async (doc) => {
    const baseName = file.name.replace(/\.pdf$/i, "");
    const padLength = String(doc.numPages).length;
    const mime = format === "png" ? "image/png" : "image/jpeg";
    const ext = format === "png" ? "png" : "jpg";
    const results: { name: string; blob: Blob }[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const blob = await canvasToBlob(canvas, mime, quality);
      const pageNumber = String(i).padStart(padLength, "0");
      results.push({ name: `${baseName}_page_${pageNumber}.${ext}`, blob });

      page.cleanup();
    }

    return results;
  });
}
