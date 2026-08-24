import type { Point, Shape } from "@/app/types/Shape";
import { getShapeBounds } from "@/app/utils/geometry";
import type { ResizeHandleId } from "@/app/utils/geometry";

// Shape mutations. All coordinates are WORLD coordinates.

// Moves a shape by a world-space delta (used when dragging a selection).
export function translateShape(shape: Shape, dx: number, dy: number) {
  switch (shape.type) {
    case "pencil":
      // A pencil stroke has many points; every point must move.
      for (const p of shape.points) {
        p.x += dx;
        p.y += dy;
      }
      break;

    case "rectangle":
    case "square":
    case "circle":
      shape.x += dx;
      shape.y += dy;
      break;

    case "line":
    case "arrow":
      // Both endpoints move by the same delta so the segment keeps its
      // length and direction.
      shape.startX += dx;
      shape.startY += dy;
      shape.endX += dx;
      shape.endY += dy;
      break;
  }
}

// Normalizes a freshly-drawn rectangle so its origin is the top-left corner
// and its width/height are always positive. While drawing, width/height can
// be negative (dragging up or left); hit detection and resizing are much
// simpler once the shape is guaranteed to be a "clean" rect.
export function normalizeRect(shape: Extract<Shape, { type: "rectangle" }>) {
  if (shape.width < 0) {
    shape.x += shape.width;
    shape.width = -shape.width;
  }
  if (shape.height < 0) {
    shape.y += shape.height;
    shape.height = -shape.height;
  }
}

// Resizes a shape by dragging one of its corner handles.
//
//   rectangle:  the dragged edge (left/right/top/bottom) follows the mouse,
//               the opposite edge stays anchored, and x/y/w/h are recomputed
//               so the result is always a positive, normalized rect.
//   square:     the corner opposite the dragged handle stays fixed while the
//               size becomes max(|dx|, |dy|) of the drag distance, keeping
//               the shape a perfect square.
//   circle:     the centre stays fixed and the radius becomes the distance
//               from the centre to the mouse.
export function resizeShape(
  shape: Shape,
  handle: ResizeHandleId,
  mouse: Point
) {
  switch (shape.type) {
    case "rectangle": {
      const b = getShapeBounds(shape);

      let left = b.minX;
      let right = b.maxX;
      let top = b.minY;
      let bottom = b.maxY;

      if (handle.includes("r")) right = mouse.x;
      else if (handle.includes("l")) left = mouse.x;

      if (handle.includes("b")) bottom = mouse.y;
      else if (handle.includes("t")) top = mouse.y;

      shape.x = Math.min(left, right);
      shape.width = Math.abs(right - left);
      shape.y = Math.min(top, bottom);
      shape.height = Math.abs(bottom - top);
      break;
    }

    case "square": {
      const b = getShapeBounds(shape);

      // The corner OPPOSITE the dragged handle is the anchor.
      const anchorX = handle.includes("l") ? b.maxX : b.minX;
      const anchorY = handle.includes("t") ? b.maxY : b.minY;

      const size = Math.max(
        Math.abs(mouse.x - anchorX),
        Math.abs(mouse.y - anchorY)
      );
      shape.size = size;
      shape.x = handle.includes("l") ? anchorX - size : anchorX;
      shape.y = handle.includes("t") ? anchorY - size : anchorY;
      break;
    }

    case "circle":
      shape.radius = Math.hypot(mouse.x - shape.x, mouse.y - shape.y);
      break;

    case "line":
    case "arrow":
      // Endpoint resize: the dragged handle's endpoint follows the mouse
      // exactly; the other endpoint stays anchored. Length and direction
      // update naturally. Corner ids never occur here (getResizeHandles
      // only returns start/end for these shapes).
      if (handle === "start") {
        shape.startX = mouse.x;
        shape.startY = mouse.y;
      } else if (handle === "end") {
        shape.endX = mouse.x;
        shape.endY = mouse.y;
      }
      break;

    case "pencil":
      break;
  }
}
