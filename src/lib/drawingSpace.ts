import { displayToRawBox, rawToDisplayBox, type Rotation } from "./rotationMath";
import type { DrawObject } from "../types";

/** DrawObject coordinates are stored in raw MediaBox space (see types.ts); this projects them into display space for rendering. */
export function rawObjectToDisplay(obj: DrawObject, rawWidth: number, rawHeight: number, rotation: Rotation): DrawObject {
  const toDisp = (x: number, y: number) => {
    const box = rawToDisplayBox({ x, y, width: 0, height: 0 }, rawWidth, rawHeight, rotation);
    return { x: box.x, y: box.y };
  };
  switch (obj.kind) {
    case "path":
      return { ...obj, points: obj.points.map((p) => toDisp(p.x, p.y)) };
    case "line":
    case "arrow": {
      const p1 = toDisp(obj.x1, obj.y1);
      const p2 = toDisp(obj.x2, obj.y2);
      return { ...obj, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
    case "rect": {
      const box = rawToDisplayBox({ x: obj.x, y: obj.y, width: obj.width, height: obj.height }, rawWidth, rawHeight, rotation);
      return { ...obj, ...box };
    }
    case "text": {
      const p = toDisp(obj.x, obj.y);
      return { ...obj, x: p.x, y: p.y };
    }
  }
}

/** Inverse of rawObjectToDisplay — used when applying a modal's freshly-drawn display-space objects onto PageState. */
export function displayObjectToRaw(obj: DrawObject, rawWidth: number, rawHeight: number, rotation: Rotation): DrawObject {
  const toRaw = (x: number, y: number) => {
    const box = displayToRawBox({ x, y, width: 0, height: 0 }, rawWidth, rawHeight, rotation);
    return { x: box.x, y: box.y };
  };
  switch (obj.kind) {
    case "path":
      return { ...obj, points: obj.points.map((p) => toRaw(p.x, p.y)) };
    case "line":
    case "arrow": {
      const p1 = toRaw(obj.x1, obj.y1);
      const p2 = toRaw(obj.x2, obj.y2);
      return { ...obj, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    }
    case "rect": {
      const box = displayToRawBox({ x: obj.x, y: obj.y, width: obj.width, height: obj.height }, rawWidth, rawHeight, rotation);
      return { ...obj, ...box };
    }
    case "text": {
      const p = toRaw(obj.x, obj.y);
      return { ...obj, x: p.x, y: p.y };
    }
  }
}
