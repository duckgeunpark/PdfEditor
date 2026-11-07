import type { DrawObject } from "../types";
import { displayDimensions, type Rotation } from "../lib/rotationMath";
import { rawObjectToDisplay } from "../lib/drawingSpace";

interface PagePreviewFrameProps {
  src: string;
  alt: string;
  rotation: 0 | 90 | 180 | 270;
  className?: string;
  onClick?: () => void;
  /** Drawings + the raw page geometry needed to project them into display space, for the live overlay. */
  drawings?: DrawObject[];
  pageWidth?: number;
  pageHeight?: number;
  intrinsicRotation?: Rotation;
}

/**
 * Renders a page thumbnail inside a fixed SQUARE frame. A square is
 * rotationally symmetric under 90-degree turns, so the rotated image's
 * visual bounding box always stays inside the same frame — no clipping at
 * any rotation. object-contain + padding keeps the true page aspect ratio,
 * and the transparent letterbox area shows the frame's own background
 * (visually distinct from the page, which pdf.js always renders opaque).
 */
export default function PagePreviewFrame({
  src,
  alt,
  rotation,
  className = "",
  onClick,
  drawings,
  pageWidth,
  pageHeight,
  intrinsicRotation,
}: PagePreviewFrameProps) {
  const hasOverlay = drawings && drawings.length > 0 && pageWidth && pageHeight && intrinsicRotation !== undefined;

  return (
    <div
      className={`relative aspect-square overflow-hidden bg-slate-200 ${
        onClick ? "cursor-zoom-in" : ""
      } ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${alt} 미리보기` : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{ transform: `rotate(${rotation}deg)` }}
        className="absolute inset-0 h-full w-full select-none object-contain p-2 drop-shadow-md transition-transform duration-200"
      />
      {hasOverlay && (
        <DrawingsOverlay
          drawings={drawings}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          intrinsicRotation={intrinsicRotation}
          rotation={rotation}
        />
      )}
    </div>
  );
}

function DrawingsOverlay({
  drawings,
  pageWidth,
  pageHeight,
  intrinsicRotation,
  rotation,
}: {
  drawings: DrawObject[];
  pageWidth: number;
  pageHeight: number;
  intrinsicRotation: Rotation;
  rotation: 0 | 90 | 180 | 270;
}) {
  const { width: dispWidth, height: dispHeight } = displayDimensions(pageWidth, pageHeight, intrinsicRotation);
  const displayObjects = drawings.map((obj) => rawObjectToDisplay(obj, pageWidth, pageHeight, intrinsicRotation));

  return (
    <svg
      viewBox={`0 0 ${dispWidth} ${dispHeight}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ transform: `rotate(${rotation}deg)` }}
      className="pointer-events-none absolute inset-0 h-full w-full p-2 transition-transform duration-200"
    >
      <g transform={`translate(0, ${dispHeight}) scale(1, -1)`}>
        {displayObjects.map((obj) => {
          switch (obj.kind) {
            case "path":
              return (
                <polyline
                  key={obj.id}
                  points={obj.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={obj.color}
                  strokeWidth={obj.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            case "line":
            case "arrow":
              return (
                <line
                  key={obj.id}
                  x1={obj.x1}
                  y1={obj.y1}
                  x2={obj.x2}
                  y2={obj.y2}
                  stroke={obj.color}
                  strokeWidth={obj.strokeWidth}
                  strokeLinecap="round"
                  markerEnd={obj.kind === "arrow" ? `url(#arrowhead-${obj.id})` : undefined}
                />
              );
            case "rect":
              return (
                <rect
                  key={obj.id}
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  fill="none"
                  stroke={obj.color}
                  strokeWidth={obj.strokeWidth}
                />
              );
            case "text":
              return null;
            default:
              return null;
          }
        })}
        <defs>
          {displayObjects
            .filter((obj) => obj.kind === "arrow")
            .map((obj) => (
              <marker
                key={obj.id}
                id={`arrowhead-${obj.id}`}
                markerWidth={10}
                markerHeight={10}
                refX={6}
                refY={5}
                orient="auto"
              >
                <path d="M0,0 L10,5 L0,10 Z" fill={obj.color} />
              </marker>
            ))}
        </defs>
      </g>
      {displayObjects
        .filter((obj): obj is Extract<DrawObject, { kind: "text" }> => obj.kind === "text")
        .map((obj) => (
          <text key={obj.id} x={obj.x} y={dispHeight - obj.y} fontSize={obj.fontSize} fill={obj.color}>
            {obj.text}
          </text>
        ))}
    </svg>
  );
}
