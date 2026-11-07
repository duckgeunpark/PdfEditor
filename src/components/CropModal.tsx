import { useEffect, useRef, useState } from "react";
import { renderPageToCanvas } from "../lib/pdfRender";
import { displayDimensions, displayToRawBox, rawToDisplayBox, type Rotation } from "../lib/rotationMath";
import type { CropBox } from "../types";

interface CropModalProps {
  file: File;
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
  intrinsicRotation: Rotation;
  initialCrop: CropBox | null;
  onApply: (box: CropBox, applyToAll: boolean) => void;
  onClose: () => void;
}

type Mode = "visual" | "percent" | "pixel";
type DragKind = "move" | "nw" | "ne" | "sw" | "se";

const MAX_DISPLAY_WIDTH = 640;

export default function CropModal({
  file,
  pageIndex,
  pageWidth,
  pageHeight,
  intrinsicRotation,
  initialCrop,
  onApply,
  onClose,
}: CropModalProps) {
  const [mode, setMode] = useState<Mode>("visual");
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [applyToAll, setApplyToAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Everything below operates in "display space": PDF-point space as the
  // page normally appears (i.e. pageWidth/pageHeight rotated by the page's
  // own intrinsic /Rotate), matching what's rendered and what the thumbnail
  // grid shows. pageWidth/pageHeight (raw, unrotated) are only touched at
  // the two boundaries: loading an existing crop, and reporting the final
  // box back to the caller — both of which are in raw MediaBox space
  // because that's what pdf-lib's setCropBox needs.
  const { width: dispWidth, height: dispHeight } = displayDimensions(
    pageWidth,
    pageHeight,
    intrinsicRotation,
  );

  const [box, setBox] = useState<CropBox>(() =>
    initialCrop
      ? rawToDisplayBox(initialCrop, pageWidth, pageHeight, intrinsicRotation)
      : { x: 0, y: 0, width: dispWidth, height: dispHeight },
  );

  useEffect(() => {
    let cancelled = false;
    const displayScale = Math.min(1, MAX_DISPLAY_WIDTH / dispWidth);
    setScale(displayScale);
    renderPageToCanvas(file, pageIndex, displayScale, intrinsicRotation).then((canvas) => {
      if (cancelled) return;
      setCanvasUrl(canvas.toDataURL("image/png"));
    });
    return () => {
      cancelled = true;
    };
  }, [file, pageIndex, dispWidth, intrinsicRotation]);

  // convert display-space point box -> CSS pixel rect (top-left origin) for overlay
  const rect = {
    left: box.x * scale,
    top: (dispHeight - box.y - box.height) * scale,
    width: box.width * scale,
    height: box.height * scale,
  };

  // Full clamp: enforces the mutual x+width<=dispWidth / y+height<=dispHeight
  // constraint. Used for drag interactions (where x/width move together in a
  // single update) and as a final safety pass before applying.
  const clampBox = (b: CropBox): CropBox => {
    const width = Math.min(Math.max(b.width, 10), dispWidth);
    const height = Math.min(Math.max(b.height, 10), dispHeight);
    const x = Math.min(Math.max(b.x, 0), dispWidth - width);
    const y = Math.min(Math.max(b.y, 0), dispHeight - height);
    return { x, y, width, height };
  };

  // Per-field clamp: bounds each field independently to the page's extent
  // without coupling it to the others. Used while typing into the pixel
  // inputs, since e.g. entering X before shrinking width would otherwise get
  // silently forced back to 0 by the mutual constraint above.
  const clampField = (b: CropBox): CropBox => ({
    x: Math.min(Math.max(b.x, 0), dispWidth),
    y: Math.min(Math.max(b.y, 0), dispHeight),
    width: Math.min(Math.max(b.width, 10), dispWidth),
    height: Math.min(Math.max(b.height, 10), dispHeight),
  });

  const startDrag = (kind: DragKind) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startBox = box;

    const onMove = (ev: PointerEvent) => {
      const dxPt = (ev.clientX - startX) / scale;
      const dyPt = (ev.clientY - startY) / scale; // screen-down = positive

      let next = { ...startBox };
      if (kind === "move") {
        next.x = startBox.x + dxPt;
        next.y = startBox.y - dyPt;
      } else {
        if (kind.includes("e")) next.width = startBox.width + dxPt;
        if (kind.includes("w")) {
          next.x = startBox.x + dxPt;
          next.width = startBox.width - dxPt;
        }
        if (kind.includes("n")) {
          next.height = startBox.height - dyPt;
        }
        if (kind.includes("s")) {
          next.y = startBox.y - dyPt;
          next.height = startBox.height + dyPt;
        }
      }
      setBox(clampBox(next));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const setPercentMargins = (top: number, right: number, bottom: number, left: number) => {
    const x = (left / 100) * dispWidth;
    const y = (bottom / 100) * dispHeight;
    const width = dispWidth - x - (right / 100) * dispWidth;
    const height = dispHeight - y - (top / 100) * dispHeight;
    setBox(clampBox({ x, y, width, height }));
  };

  const marginsPercent = {
    top: ((dispHeight - box.y - box.height) / dispHeight) * 100,
    right: ((dispWidth - box.x - box.width) / dispWidth) * 100,
    bottom: (box.y / dispHeight) * 100,
    left: (box.x / dispWidth) * 100,
  };

  const handleApply = () => {
    const finalDisplayBox = clampBox(box);
    const rawBox = displayToRawBox(finalDisplayBox, pageWidth, pageHeight, intrinsicRotation);
    onApply(rawBox, applyToAll);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">
            {pageIndex + 1}페이지 자르기
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-200 px-5 pt-3">
          {(["visual", "percent", "pixel"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-t-md px-3 py-1.5 text-sm font-medium ${
                mode === m
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {m === "visual" ? "드래그로 지정" : m === "percent" ? "여백(%) 지정" : "포인트(pt) 지정"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-5">
          {mode === "visual" && (
            <div
              ref={containerRef}
              className="relative mx-auto select-none"
              style={{ width: dispWidth * scale, height: dispHeight * scale }}
            >
              {canvasUrl && (
                <img
                  src={canvasUrl}
                  alt="page preview"
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}
              <div className="absolute inset-0 bg-black/40" />
              <div
                onPointerDown={startDrag("move")}
                className="absolute cursor-move border-2 border-slate-900 bg-transparent"
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0)",
                  backgroundImage: canvasUrl ? `url(${canvasUrl})` : undefined,
                  backgroundSize: `${dispWidth * scale}px ${dispHeight * scale}px`,
                  backgroundPosition: `-${rect.left}px -${rect.top}px`,
                }}
              >
                {(["nw", "ne", "sw", "se"] as DragKind[]).map((corner) => (
                  <div
                    key={corner}
                    onPointerDown={startDrag(corner)}
                    className={`absolute h-3 w-3 rounded-full border border-white bg-slate-900 ${
                      corner.includes("n") ? "-top-1.5" : "-bottom-1.5"
                    } ${corner.includes("w") ? "-left-1.5" : "-right-1.5"}`}
                    style={{ cursor: `${corner}-resize` }}
                  />
                ))}
              </div>
            </div>
          )}

          {mode === "percent" && (
            <div className="mx-auto grid max-w-sm grid-cols-2 gap-4">
              {(
                [
                  ["top", "위쪽"],
                  ["right", "오른쪽"],
                  ["bottom", "아래쪽"],
                  ["left", "왼쪽"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1 text-sm text-slate-600">
                  {label} 여백 (%)
                  <input
                    type="number"
                    min={0}
                    max={49}
                    value={Math.round(marginsPercent[key])}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0;
                      const m = { ...marginsPercent, [key]: v };
                      setPercentMargins(m.top, m.right, m.bottom, m.left);
                    }}
                    className="rounded-md border border-slate-300 px-2 py-1"
                  />
                </label>
              ))}
            </div>
          )}

          {mode === "pixel" && (
            <div className="mx-auto grid max-w-sm grid-cols-2 gap-4">
              <p className="col-span-2 text-xs text-slate-400">
                단위: pt (PDF 포인트, 좌하단 기준). 페이지 크기: {Math.round(dispWidth)} × {Math.round(dispHeight)} pt
              </p>
              {(
                [
                  ["x", "X (좌측 시작)"],
                  ["y", "Y (하단 시작)"],
                  ["width", "너비"],
                  ["height", "높이"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1 text-sm text-slate-600">
                  {label}
                  <input
                    type="number"
                    value={Math.round(box[key])}
                    onChange={(e) =>
                      setBox(clampField({ ...box, [key]: Number(e.target.value) || 0 }))
                    }
                    className="rounded-md border border-slate-300 px-2 py-1"
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
            />
            모든 페이지에 동일하게 적용
          </label>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              onClick={handleApply}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              적용
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
