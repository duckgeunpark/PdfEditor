import { useEffect, useRef, useState } from "react";
import { renderPageToCanvas } from "../lib/pdfRender";
import { displayDimensions, type Rotation } from "../lib/rotationMath";
import { displayObjectToRaw, rawObjectToDisplay } from "../lib/drawingSpace";
import type { DrawArrow, DrawLine, DrawObject, DrawPath, DrawRect, DrawTextBox } from "../types";

interface DrawModalProps {
  file: File;
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
  intrinsicRotation: Rotation;
  initialDrawings: DrawObject[];
  onApply: (drawings: DrawObject[]) => void;
  onClose: () => void;
}

type Tool = "pen" | "line" | "arrow" | "rect" | "text";

const MAX_DISPLAY_WIDTH = 640;
const COLORS = ["#dc2626", "#16a34a", "#2563eb", "#f59e0b", "#000000", "#ffffff"];
const STROKE_WIDTHS = [2, 4, 8];

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Converts a display-space (top-left origin, y-down) canvas point to
 * display-space PDF points (bottom-left origin, y-up), the convention every
 * DrawObject is stored in before being flipped once more to raw space.
 */
function canvasPointToDisplay(px: number, py: number, scale: number, dispHeight: number) {
  return { x: px / scale, y: dispHeight - py / scale };
}

export default function DrawModal({
  file,
  pageIndex,
  pageWidth,
  pageHeight,
  intrinsicRotation,
  initialDrawings,
  onApply,
  onClose,
}: DrawModalProps) {
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1]);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [objects, setObjects] = useState<DrawObject[]>(() =>
    initialDrawings.map((obj) => rawObjectToDisplay(obj, pageWidth, pageHeight, intrinsicRotation)),
  );
  const [draft, setDraft] = useState<DrawObject | null>(null);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { width: dispWidth, height: dispHeight } = displayDimensions(pageWidth, pageHeight, intrinsicRotation);

  useEffect(() => {
    let cancelled = false;
    const displayScale = Math.min(1, MAX_DISPLAY_WIDTH / dispWidth);
    setScale(displayScale);
    renderPageToCanvas(file, pageIndex, displayScale, intrinsicRotation).then((canvas) => {
      if (!cancelled) setCanvasUrl(canvas.toDataURL("image/png"));
    });
    return () => {
      cancelled = true;
    };
  }, [file, pageIndex, dispWidth, intrinsicRotation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const all = draft ? [...objects, draft] : objects;
    for (const obj of all) drawObjectOnCanvas(ctx, obj, scale, dispHeight);
  }, [objects, draft, scale, dispHeight]);

  const getCanvasPoint = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return canvasPointToDisplay(e.clientX - rect.left, e.clientY - rect.top, scale, dispHeight);
  };

  const startPointer = (e: React.PointerEvent) => {
    if (tool === "text") {
      setTextDraft(getCanvasPoint(e));
      setTextValue("");
      return;
    }

    const start = getCanvasPoint(e);
    const id = newId();

    const initial: DrawObject =
      tool === "pen"
        ? ({ id, kind: "path", points: [start], color, strokeWidth } satisfies DrawPath)
        : tool === "line"
          ? ({ id, kind: "line", x1: start.x, y1: start.y, x2: start.x, y2: start.y, color, strokeWidth } satisfies DrawLine)
          : tool === "arrow"
            ? ({ id, kind: "arrow", x1: start.x, y1: start.y, x2: start.x, y2: start.y, color, strokeWidth } satisfies DrawArrow)
            : ({ id, kind: "rect", x: start.x, y: start.y, width: 0, height: 0, color, strokeWidth } satisfies DrawRect);

    setDraft(initial);

    const onMove = (ev: PointerEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const p = canvasPointToDisplay(ev.clientX - rect.left, ev.clientY - rect.top, scale, dispHeight);
      setDraft((prev) => {
        if (!prev) return prev;
        if (prev.kind === "path") return { ...prev, points: [...prev.points, p] };
        if (prev.kind === "line" || prev.kind === "arrow") return { ...prev, x2: p.x, y2: p.y };
        if (prev.kind === "rect") {
          return { ...prev, x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) };
        }
        return prev;
      });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDraft((prev) => {
        if (prev && (prev.kind !== "path" || prev.points.length > 1) && (prev.kind !== "rect" || (prev.width > 1 && prev.height > 1))) {
          setObjects((list) => [...list, prev]);
        }
        return null;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const commitText = () => {
    if (textDraft && textValue.trim()) {
      const obj: DrawTextBox = {
        id: newId(),
        kind: "text",
        x: textDraft.x,
        y: textDraft.y,
        text: textValue,
        fontSize: strokeWidth * 6,
        color,
      };
      setObjects((list) => [...list, obj]);
    }
    setTextDraft(null);
    setTextValue("");
  };

  const undoLast = () => setObjects((list) => list.slice(0, -1));
  const clearAll = () => setObjects([]);

  const handleApply = () => {
    const raw = objects.map((obj) => displayObjectToRaw(obj, pageWidth, pageHeight, intrinsicRotation));
    onApply(raw);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{pageIndex + 1}페이지 그리기</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
          <div className="flex gap-1">
            {(
              [
                ["pen", "✏️ 펜"],
                ["line", "／ 직선"],
                ["arrow", "↗ 화살표"],
                ["rect", "⬜ 사각형"],
                ["text", "T 텍스트"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTool(t)}
                className={`rounded-md px-2.5 py-1.5 text-sm font-medium ${
                  tool === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-slate-900" : "border-slate-200"}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border border-slate-200"
              title="사용자 지정 색상"
            />
          </div>

          <div className="flex items-center gap-1">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setStrokeWidth(w)}
                className={`flex h-7 w-7 items-center justify-center rounded-md border ${
                  strokeWidth === w ? "border-slate-900 bg-slate-100" : "border-slate-200"
                }`}
                title={`굵기 ${w}`}
              >
                <span className="rounded-full bg-slate-900" style={{ width: w, height: w }} />
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <button
              onClick={undoLast}
              disabled={objects.length === 0}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              되돌리기
            </button>
            <button
              onClick={clearAll}
              disabled={objects.length === 0}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              전체 지우기
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div
            ref={containerRef}
            className="relative mx-auto touch-none select-none"
            style={{ width: dispWidth * scale, height: dispHeight * scale }}
            onPointerDown={startPointer}
          >
            {canvasUrl && (
              <img
                src={canvasUrl}
                alt="page preview"
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
            <canvas
              ref={canvasRef}
              width={dispWidth * scale}
              height={dispHeight * scale}
              className="absolute inset-0 h-full w-full cursor-crosshair"
            />
            {textDraft && (
              <input
                autoFocus
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitText();
                  if (e.key === "Escape") {
                    setTextDraft(null);
                    setTextValue("");
                  }
                }}
                onBlur={commitText}
                placeholder="텍스트 입력 후 Enter"
                style={{
                  position: "absolute",
                  left: textDraft.x * scale,
                  top: (dispHeight - textDraft.y) * scale - strokeWidth * 6 * scale,
                  color,
                  fontSize: Math.max(12, strokeWidth * 6 * scale),
                }}
                className="min-w-[120px] rounded border border-slate-400 bg-white/90 px-1 outline-none"
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
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
  );
}

function drawObjectOnCanvas(ctx: CanvasRenderingContext2D, obj: DrawObject, scale: number, dispHeight: number) {
  const toPx = (x: number, y: number) => ({ x: x * scale, y: (dispHeight - y) * scale });
  ctx.strokeStyle = obj.color;
  ctx.fillStyle = obj.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (obj.kind) {
    case "path": {
      ctx.lineWidth = obj.strokeWidth * scale;
      ctx.beginPath();
      obj.points.forEach((p, i) => {
        const { x, y } = toPx(p.x, p.y);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      break;
    }
    case "line": {
      ctx.lineWidth = obj.strokeWidth * scale;
      const a = toPx(obj.x1, obj.y1);
      const b = toPx(obj.x2, obj.y2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      break;
    }
    case "arrow": {
      ctx.lineWidth = obj.strokeWidth * scale;
      const a = toPx(obj.x1, obj.y1);
      const b = toPx(obj.x2, obj.y2);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const headLength = Math.max(10, obj.strokeWidth * 4) * scale;
      const headAngle = Math.PI / 7;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - headLength * Math.cos(angle - headAngle), b.y - headLength * Math.sin(angle - headAngle));
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - headLength * Math.cos(angle + headAngle), b.y - headLength * Math.sin(angle + headAngle));
      ctx.stroke();
      break;
    }
    case "rect": {
      ctx.lineWidth = obj.strokeWidth * scale;
      const topLeft = toPx(obj.x, obj.y + obj.height);
      ctx.strokeRect(topLeft.x, topLeft.y, obj.width * scale, obj.height * scale);
      break;
    }
    case "text": {
      const pos = toPx(obj.x, obj.y);
      ctx.font = `${obj.fontSize * scale}px sans-serif`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(obj.text, pos.x, pos.y);
      break;
    }
  }
}
