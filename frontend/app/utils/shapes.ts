import type { Shape } from "@/app/types/Shape";

// Moves a shape by a canvas-local delta. All coordinate math happens in
// canvas-local pixels, so shapes keep their positions relative to the grid
// even after the page has been scrolled.
export function translateShape(
  shape: Shape,
  dx: number,
  dy: number
) {
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
  }
}
