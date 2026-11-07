export interface UploadedFile {
  id: string;
  file: File;
  name: string;
}

export interface PageState {
  id: string;
  /** The source PDF this page was loaded from (multiple files may be merged into one editor session). */
  sourceFile: File;
  originalIndex: number;
  /** User-added rotation delta, applied on top of intrinsicRotation. */
  rotation: 0 | 90 | 180 | 270;
  /** The PDF page's own /Rotate value — how it normally displays. */
  intrinsicRotation: 0 | 90 | 180 | 270;
  selected: boolean;
  cropBox: CropBox | null;
  /** Raw (unrotated MediaBox) width/height, in PDF points. */
  width: number;
  height: number;
  thumbnail: string;
  drawings: DrawObject[];
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * All drawing coordinates are in "display space": PDF-point space as the
 * page normally appears (i.e. raw MediaBox space rotated by the page's own
 * intrinsicRotation), bottom-left origin — same convention as CropBox. This
 * keeps drawings aligned with what the user actually saw while drawing,
 * independent of the page's own /Rotate value.
 */
export type DrawObject = DrawPath | DrawLine | DrawArrow | DrawRect | DrawTextBox;

interface DrawObjectBase {
  id: string;
  color: string;
}

export interface DrawPath extends DrawObjectBase {
  kind: "path";
  points: { x: number; y: number }[];
  strokeWidth: number;
}

export interface DrawLine extends DrawObjectBase {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
}

export interface DrawArrow extends DrawObjectBase {
  kind: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
}

export interface DrawRect extends DrawObjectBase {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  strokeWidth: number;
}

export interface DrawTextBox extends DrawObjectBase {
  kind: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}
