import { useEffect, useState } from "react";
import { renderPageToCanvas } from "../lib/pdfRender";
import { displayDimensions, type Rotation } from "../lib/rotationMath";
import PagePreviewFrame from "./PagePreviewFrame";
import type { CropBox, DrawObject } from "../types";

interface PagePreviewPanelProps {
  file: File;
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
  intrinsicRotation: Rotation;
  cropBox: CropBox | null;
  drawings: DrawObject[];
  fallbackSrc: string;
  rotation: 0 | 90 | 180 | 270;
  pageNumber: number;
  onClose: () => void;
}

const HQ_TARGET_PX = 900;

/**
 * Inline side-panel preview (as opposed to a modal overlay), so it sits next
 * to the page grid and the grid reflows into the remaining width instead of
 * being covered up.
 */
export default function PagePreviewPanel({
  file,
  pageIndex,
  pageWidth,
  pageHeight,
  intrinsicRotation,
  cropBox,
  drawings,
  fallbackSrc,
  rotation,
  pageNumber,
  onClose,
}: PagePreviewPanelProps) {
  const [hqSrc, setHqSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHqSrc(null);
    const { width: dispWidth } = displayDimensions(pageWidth, pageHeight, intrinsicRotation);
    const targetRegionWidth = cropBox ? cropBox.width : dispWidth;
    const scale = Math.max(1, Math.min(4, HQ_TARGET_PX / targetRegionWidth));
    const crop = cropBox ? { box: cropBox, rawWidth: pageWidth, rawHeight: pageHeight } : undefined;
    renderPageToCanvas(file, pageIndex, scale, intrinsicRotation, crop).then((canvas) => {
      if (!cancelled) setHqSrc(canvas.toDataURL("image/png"));
    });
    return () => {
      cancelled = true;
    };
  }, [file, pageIndex, pageWidth, pageHeight, intrinsicRotation, cropBox]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-8 lg:w-1/2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{pageNumber}페이지 미리보기</span>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ✕ 닫기
        </button>
      </div>
      <PagePreviewFrame
        src={hqSrc ?? fallbackSrc}
        alt={`${pageNumber}페이지 확대 보기`}
        rotation={rotation}
        className="w-full rounded-lg"
        drawings={drawings}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        intrinsicRotation={intrinsicRotation}
      />
    </div>
  );
}
