import type { Camera } from "@/app/utils/camera";
import { worldToScreen } from "@/app/utils/coordinates";
import type { Shape } from "@/app/types/Shape";

// Hit detection and geometry helpers, all in WORLD coordinates.
//
// Shapes are stored in world coordinates. `shapeContainsPoint` and the
// bounds helper therefore receive world-space points (convert the mouse
// first with screenToWorld).

export type ResizeHandleId = "tl" | "tr" | "bl" | "br";

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

// Axis-aligned world bounding box of a shape. Works even while a shape is
// being drawn with a negative width/height (dragging up or left), because it
// takes the min/max of both corners.
export function getShapeBounds(shape: Shape): Bounds {
  switch (shape.type) {
    case "pencil": {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of shape.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { minX, minY, maxX, maxY };
    }

    case "rectangle":
      return {
        minX: Math.min(shape.x, shape.x + shape.width),
        minY: Math.min(shape.y, shape.y + shape.height),
        maxX: Math.max(shape.x, shape.x + shape.width),
        maxY: Math.max(shape.y, shape.y + shape.height),
      };

    case "square":
      return {
        minX: Math.min(shape.x, shape.x + shape.size),
        minY: Math.min(shape.y, shape.y + shape.size),
        maxX: Math.max(shape.x, shape.x + shape.size),
        maxY: Math.max(shape.y, shape.y + shape.size),
      };

    case "circle":
      return {
        minX: shape.x - shape.radius,
        minY: shape.y - shape.radius,
        maxX: shape.x + shape.radius,
        maxY: shape.y + shape.radius,
      };
  }
}

// Tests whether a WORLD-space point hits a shape. `padding` (in world units)
// inflates the hit area, so the eraser can remove shapes the pointer only
// comes close to instead of requiring an exact pixel hit.
export function shapeContainsPoint(
  shape: Shape,
  x: number,
  y: number,
  padding = 0
): boolean {
  switch (shape.type) {
    case "pencil":
    case "rectangle":
    case "square": {
      const b = getShapeBounds(shape);
      return (
        x >= b.minX - padding &&
        x <= b.maxX + padding &&
        y >= b.minY - padding &&
        y <= b.maxY + padding
      );
    }

    case "circle": {
      const dx = x - shape.x;
      const dy = y - shape.y;
      return Math.sqrt(dx * dx + dy * dy) <= shape.radius + padding;
    }
  }
}

// World-space positions of the resize handles for a shape. Rectangle and
// square get the 4 corners of their bounding box; a circle gets the 4 points
// of its bounding box too (each one pulls the radius). Pencil strokes are
// not resizable, so they get no handles.
export function getResizeHandles(
  shape: Shape
): { id: ResizeHandleId; x: number; y: number }[] {
  if (shape.type === "pencil") return [];

  const b = getShapeBounds(shape);
  return [
    { id: "tl", x: b.minX, y: b.minY },
    { id: "tr", x: b.maxX, y: b.minY },
    { id: "bl", x: b.minX, y: b.maxY },
    { id: "br", x: b.maxX, y: b.maxY },
  ];
}

// Returns the handle under a SCREEN-space point (handles are hit-tested in
// screen space so their grab area stays a constant ~8px regardless of zoom).
export function hitTestResizeHandle(
  shape: Shape,
  camera: Camera,
  zoom: number,
  screenX: number,
  screenY: number,
  hitRadius = 8
): ResizeHandleId | null {
  for (const handle of getResizeHandles(shape)) {
    const pos = worldToScreen(camera, zoom, handle.x, handle.y);
    const dx = screenX - pos.x;
    const dy = screenY - pos.y;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return handle.id;
    }
  }
  return null;
}

export function resizeCursor(handle: ResizeHandleId): string {
  switch (handle) {
    case "tl":
    case "br":
      return "nwse-resize";
    case "tr":
    case "bl":
      return "nesw-resize";
  }
}
