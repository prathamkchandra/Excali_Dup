import type { Camera } from "@/app/utils/camera";
import type { Shape } from "@/app/types/Shape";
import {
  getResizeHandles,
  getShapeBounds,
} from "@/app/utils/geometry";

// Everything that draws pixels on the canvas.
//
// The canvas is always drawn in SCREEN space (CSS pixels, dpr-scaled). The
// render loop enters WORLD space with ctx.translate(-camera.x, -camera.y)
// before drawing shapes/selection, so those draw functions work in raw world
// coordinates. The grid is drawn in SCREEN space: line positions are derived
// from the camera modulo the grid size, which keeps the world grid perfectly
// aligned while panning in any direction.

export const GRID_SIZE = 20;

export const HANDLE_SIZE = 8;

// Fills the whole canvas with the dark background color.
export function fillBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, width, height);
}

// Draws an infinite grid across the whole visible viewport.
//
// This runs INSIDE the camera transform (scale + translate), so it draws in
// world coordinates: vertical lines at every world x that is a multiple of
// GRID_SIZE within the visible range [camera.x, camera.x + width/zoom]. The
// line width is compensated by 1/zoom so grid lines stay ~1px on screen at
// any zoom level.
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  zoom: number,
  width: number,
  height: number
) {
  ctx.lineWidth = 1 / zoom;
  ctx.strokeStyle = "#2a2a2a";
  ctx.beginPath();

  const startX = Math.floor(camera.x / GRID_SIZE) * GRID_SIZE;
  const endX = camera.x + width / zoom;
  for (let x = startX; x <= endX; x += GRID_SIZE) {
    ctx.moveTo(x, camera.y);
    ctx.lineTo(x, camera.y + height / zoom);
  }

  const startY = Math.floor(camera.y / GRID_SIZE) * GRID_SIZE;
  const endY = camera.y + height / zoom;
  for (let y = startY; y <= endY; y += GRID_SIZE) {
    ctx.moveTo(camera.x, y);
    ctx.lineTo(camera.x + width / zoom, y);
  }

  ctx.stroke();
}

// Draws every shape in WORLD coordinates. Call this inside the camera
// transform (ctx.translate(-camera.x, -camera.y)) so shapes land where they
// belong on screen.
export function drawShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  selectedIndex: number | null
) {
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  shapes.forEach((shape, index) => {
    ctx.strokeStyle = selectedIndex === index ? "#ffd166" : "#ffffff";

    switch (shape.type) {
      case "pencil": {
        if (shape.points.length === 0) break;

        if (shape.points.length === 1) {
          // A stroke that never moved is just a dot.
          ctx.beginPath();
          ctx.arc(
            shape.points[0].x,
            shape.points[0].y,
            ctx.lineWidth / 2,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
          break;
        }

        // Smooth freehand: a quadratic curve through the midpoint of each
        // point pair, so fast pencil strokes render as soft curves instead
        // of jagged straight segments.
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length - 1; i++) {
          const mx = (shape.points[i].x + shape.points[i + 1].x) / 2;
          const my = (shape.points[i].y + shape.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(shape.points[i].x, shape.points[i].y, mx, my);
        }
        const last = shape.points[shape.points.length - 1];
        ctx.lineTo(last.x, last.y);
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

// Draws the eraser cursor: a small circle that follows the pointer. It is
// drawn on top of everything (last) purely as visual feedback - it never
// erases anything. `x`/`y` are SCREEN coordinates.
export function drawEraserCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius = 10
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// Draws the selection UI (dashed bounding box + resize handles) in WORLD
// coordinates. Call this inside the camera transform after drawShapes. All
// sizes are compensated by 1/zoom so the box and handles stay the same size
// on screen at any zoom level.
export function drawSelection(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  zoom: number
) {
  const b = getShapeBounds(shape);
  const width = b.maxX - b.minX;
  const height = b.maxY - b.minY;

  const handleSize = HANDLE_SIZE / zoom;

  // Dashed outline.
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.strokeRect(b.minX, b.minY, width, height);
  ctx.setLineDash([]);

  // Resize handles: filled squares at each corner.
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffd166";
  for (const handle of getResizeHandles(shape)) {
    ctx.fillRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.strokeRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    );
  }
}
