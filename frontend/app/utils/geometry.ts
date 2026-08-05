import type { Shape } from "@/app/types/Shape";

// Hit detection in canvas-local coordinates.
//
// `x` and `y` must already be canvas-local (convert the mouse with the
// getBoundingClientRect()-based helper). Because shapes are stored in the
// same coordinate space, this works correctly no matter how far the page
// has been scrolled.
export function shapeContainsPoint(
  shape: Shape,
  x: number,
  y: number
): boolean {
  switch (shape.type) {
    case "pencil": {
      // A pencil stroke is hit-tested by its bounding box, matching the
      // previous behavior. Bounds are computed in a loop so it stays safe
      // even for strokes with thousands of points.
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
      return (
        x >= minX && x <= maxX && y >= minY && y <= maxY
      );
    }

    case "rectangle":
      return (
        x >= shape.x &&
        x <= shape.x + shape.width &&
        y >= shape.y &&
        y <= shape.y + shape.height
      );

    case "square":
      return (
        x >= shape.x &&
        x <= shape.x + shape.size &&
        y >= shape.y &&
        y <= shape.y + shape.size
      );

    case "circle": {
      const dx = x - shape.x;
      const dy = y - shape.y;
      return Math.sqrt(dx * dx + dy * dy) <= shape.radius;
    }
  }
}
