import type { PageState } from "../types";
import PagePreviewFrame from "./PagePreviewFrame";

interface PageThumbnailProps {
  page: PageState;
  index: number;
  isPreviewing: boolean;
  onToggleSelect: () => void;
  onRotate: () => void;
  onCrop: () => void;
  onRemoveCrop: () => void;
  onDraw: () => void;
  onRemoveDrawings: () => void;
  onRemove: () => void;
  onPreview: () => void;
}

export default function PageThumbnail({
  page,
  index,
  isPreviewing,
  onToggleSelect,
  onRotate,
  onCrop,
  onRemoveCrop,
  onDraw,
  onRemoveDrawings,
  onRemove,
  onPreview,
}: PageThumbnailProps) {
  const borderClass = page.selected ? "border-slate-900" : "border-slate-200";
  const ringClass = isPreviewing
    ? "ring-2 ring-blue-500"
    : page.selected
      ? "ring-2 ring-slate-900"
      : "";

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm ${borderClass} ${ringClass}`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-2 py-1">
        <label
          className="flex items-center gap-1.5 text-xs text-slate-500"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={page.selected}
            onChange={onToggleSelect}
            className="h-3.5 w-3.5"
          />
          {index + 1}페이지
        </label>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="rounded px-1.5 text-xs text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          title="이 페이지 삭제"
        >
          ✕
        </button>
      </div>

      {page.cropBox && (
        <div className="absolute left-2 top-8 z-10 flex items-center gap-1 rounded bg-slate-900/80 py-0.5 pl-1.5 pr-1 text-[10px] text-white">
          <span>자르기 적용됨</span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemoveCrop}
            className="rounded px-1 text-red-400 hover:text-red-300"
            title="자르기 초기화"
          >
            ✕
          </button>
        </div>
      )}

      {page.drawings.length > 0 && (
        <div
          className="absolute left-2 z-10 flex items-center gap-1 rounded bg-slate-900/80 py-0.5 pl-1.5 pr-1 text-[10px] text-white"
          style={{ top: page.cropBox ? "3.75rem" : "2rem" }}
        >
          <span>그리기 적용됨</span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemoveDrawings}
            className="rounded px-1 text-red-400 hover:text-red-300"
            title="그리기 초기화"
          >
            ✕
          </button>
        </div>
      )}

      <PagePreviewFrame
        src={page.thumbnail}
        alt={`${index + 1}페이지`}
        rotation={page.rotation}
        onClick={onPreview}
        drawings={page.drawings}
        pageWidth={page.width}
        pageHeight={page.height}
        intrinsicRotation={page.intrinsicRotation}
      />

      <div className="flex divide-x divide-slate-100 border-t border-slate-100 text-xs">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRotate}
          className="flex-1 py-1.5 text-slate-600 hover:bg-slate-50"
        >
          ↻ 회전
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onCrop}
          className="flex-1 py-1.5 text-slate-600 hover:bg-slate-50"
        >
          ⬛ 자르기
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDraw}
          className="flex-1 py-1.5 text-slate-600 hover:bg-slate-50"
        >
          ✏️ 그리기
        </button>
      </div>
    </div>
  );
}
