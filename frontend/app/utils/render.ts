import type { Shape } from "@/app/types/Shape";

// Grid line spacing in CSS pixels.
export const GRID_SIZE = 20;

// Fills the whole canvas with the dark background color.
// Called first on every render so no stale pixels survive a resize.
export function fillBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, width, height);
}

// Draws a simple static grid across the whole canvas.
//
// No camera here: the canvas bitmap itself is as large as the document, so
// we just step lines across its full width/height once.
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = 0; x <= width; x += GRID_SIZE) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }

  for (let y = 0; y <= height; y += GRID_SIZE) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }

  ctx.stroke();
}

// Redraws every shape.
//
// Shapes are stored in canvas-local coordinates (they happen to equal page
// coordinates because the canvas starts at the top of the document). No
// camera transform is applied - each shape is drawn exactly where it was
// recorded, which is why existing drawings stay put when the canvas grows.
export function drawShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  selectedIndex: number | null
) {
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  shapes.forEach((shape, index) => {
    ctx.strokeStyle = selectedIndex === index ? "#ffd166" : "#ffffff";

    switch (shape.type) {
      case "pencil": {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
        break;
      }

      case "rectangle":
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        break;

      case "square":
        ctx.strokeRect(shape.x, shape.y, shape.size, shape.size);
        break;

      case "circle": {
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }
  });
}
