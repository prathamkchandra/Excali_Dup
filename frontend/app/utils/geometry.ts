import type { Camera } from "@/app/utils/camera";
import { worldToScreen } from "@/app/utils/coordinates";
import type { Point, Shape } from "@/app/types/Shape";

// Hit detection and geometry helpers, all in WORLD coordinates.
//
// Shapes are stored in world coordinates. `shapeContainsPoint` and the
// bounds helper therefore receive world-space points (convert the mouse
// first with screenToWorld).

export type ResizeHandleId = "tl" | "tr" | "bl" | "br" | "start" | "end";

// Extra grab distance (world units) for line/arrow bodies. Area shapes can
// be clicked anywhere inside their bounds, but a 1-dimensional segment is
// invisible to a bbox test, so it needs its own tolerance around the stroke.
export const LINE_HIT_TOLERANCE = 6;

// Length of the two arrowhead strokes (world units). Lives here (not in
// draw.ts) so the eraser/select hit test can cover the head without a
// circular import.
export const ARROWHEAD_SIZE = 10;

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

    case "line":
    case "arrow":
      // A segment's bounds are just its two endpoints; works while drawing
      // even when start === end (zero-area box).
      return {
        minX: Math.min(shape.startX, shape.endX),
        minY: Math.min(shape.startY, shape.endY),
        maxX: Math.max(shape.startX, shape.endX),
        maxY: Math.max(shape.startY, shape.endY),
      };
  }
}

// Shortest distance from point (px, py) to the SEGMENT ab (not the infinite
// line): project p onto ab and clamp t to [0, 1] so misses past either end
// measure against that endpoint instead of somewhere off-segment.
function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSq = abx * abx + aby * aby;

  // Degenerate segment (start == end): distance is to that single point.
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lengthSq)
  );
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
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

    case "line":
    case "arrow": {
      const tolerance = LINE_HIT_TOLERANCE + padding;
      if (
        distanceToSegment(
          x,
          y,
          shape.startX,
          shape.startY,
          shape.endX,
          shape.endY
        ) <= tolerance
      ) {
        return true;
      }

      // The arrowhead sticks out laterally past the shaft near the tip, so
      // also accept anything inside a circle the size of the head.
      if (shape.type === "arrow") {
        const dx = x - shape.endX;
        const dy = y - shape.endY;
        return Math.hypot(dx, dy) <= ARROWHEAD_SIZE + padding;
      }

      return false;
    }
  }
}

// World-space positions of the resize handles for a shape. Rectangle and
// square get the 4 corners of their bounding box; a circle gets the 4 points
// of its bounding box too (each one pulls the radius). Lines and arrows get
// their two ENDPOINTS - pulling an endpoint changes length/direction, which
// is the only meaningful "resize" for a segment. Pencil strokes are not
// resizable, so they get no handles.
export function getResizeHandles(
  shape: Shape
): { id: ResizeHandleId; x: number; y: number }[] {
  if (shape.type === "pencil") return [];

  if (shape.type === "line" || shape.type === "arrow") {
    return [
      { id: "start", x: shape.startX, y: shape.startY },
      { id: "end", x: shape.endX, y: shape.endY },
    ];
  }

  const b = getShapeBounds(shape);
  return [
    { id: "tl", x: b.minX, y: b.minY },
    { id: "tr", x: b.maxX, y: b.minY },
    { id: "bl", x: b.minX, y: b.maxY },
    { id: "br", x: b.maxX, y: b.maxY },
  ];
}

// Returns the handle under a SCREEN-space point (handles are hit-tested in
// screen space so their grab area stays a constant ~12px regardless of zoom).
// The visual handle is 8px but the touch/click hit area is larger for easier
// grabbing on both mouse and touch devices.
export function hitTestResizeHandle(
  shape: Shape,
  camera: Camera,
  zoom: number,
  screenX: number,
  screenY: number,
  hitRadius = 12
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
    // Endpoint handles can move in any direction, so a directional resize
    // cursor would be misleading - "move" matches the free 2D dragging.
    case "start":
    case "end":
      return "move";
  }
}

// The point a shape hangs from while being dragged: its visual center for
// segments, the first point for pencil strokes, and the top-left corner for
// area shapes. beginDrag/updateDrag must agree on this so the grab offset
// stays stable during a drag.
export function getDragAnchor(shape: Shape): Point {
  if (shape.type === "pencil") {
    return shape.points[0] ?? { x: 0, y: 0 };
  }
  if (shape.type === "line" || shape.type === "arrow") {
    return {
      x: (shape.startX + shape.endX) / 2,
      y: (shape.startY + shape.endY) / 2,
    };
  }
  return { x: shape.x, y: shape.y };
}

// Snaps `current` so the segment start->current lies on the nearest 45° ray
// from `start` (0°, 45°, 90°, ...), keeping its original length. Screen Y
// grows downward, but the 45° step is symmetric under that flip, so the
// result still lands exactly on horizontal/vertical/both diagonals.
export function snapAngle(start: Point, current: Point): Point {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const STEP = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / STEP) * STEP;
  const length = Math.hypot(dx, dy);
  return {
    x: start.x + Math.cos(angle) * length,
    y: start.y + Math.sin(angle) * length,
  };
}
