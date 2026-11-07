import type { CropBox } from "../types";

export type Rotation = 0 | 90 | 180 | 270;

export function displayDimensions(
  rawWidth: number,
  rawHeight: number,
  rotation: Rotation,
): { width: number; height: number } {
  return rotation === 90 || rotation === 270
    ? { width: rawHeight, height: rawWidth }
    : { width: rawWidth, height: rawHeight };
}

/**
 * Converts a box in raw (unrotated MediaBox) PDF-point space — bottom-left
 * origin — into the space you'd measure on the page as it's normally
 * displayed (i.e. after applying the page's intrinsic /Rotate, clockwise).
 */
export function rawToDisplayBox(
  box: CropBox,
  rawWidth: number,
  rawHeight: number,
  rotation: Rotation,
): CropBox {
  const { x, y, width, height } = box;
  switch (rotation) {
    case 0:
      return { x, y, width, height };
    case 90:
      return { x: y, y: rawWidth - x - width, width: height, height: width };
    case 180:
      return { x: rawWidth - x - width, y: rawHeight - y - height, width, height };
    case 270:
      return { x: rawHeight - y - height, y: x, width: height, height: width };
  }
}

/** Inverse of rawToDisplayBox. */
export function displayToRawBox(
  box: CropBox,
  rawWidth: number,
  rawHeight: number,
  rotation: Rotation,
): CropBox {
  const { x, y, width, height } = box;
  switch (rotation) {
    case 0:
      return { x, y, width, height };
    case 90:
      return { x: rawWidth - y - height, y: x, width: height, height: width };
    case 180:
      return { x: rawWidth - x - width, y: rawHeight - y - height, width, height };
    case 270:
      return { x: y, y: rawHeight - x - width, width: height, height: width };
  }
}

/** Point form of displayToRawBox — used to bake drawing coordinates into raw MediaBox space. */
export function displayToRawPoint(
  point: { x: number; y: number },
  rawWidth: number,
  rawHeight: number,
  rotation: Rotation,
): { x: number; y: number } {
  const box = displayToRawBox(
    { x: point.x, y: point.y, width: 0, height: 0 },
    rawWidth,
    rawHeight,
    rotation,
  );
  return { x: box.x, y: box.y };
}
