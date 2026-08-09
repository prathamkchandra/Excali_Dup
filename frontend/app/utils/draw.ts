import type { Camera } from "@/app/utils/camera";
import { screenToWorld, worldToScreen } from "@/app/utils/coordinates";
import type { Shape } from "@/app/types/Shape";
import {
  getResizeHandles,
  getShapeBounds,
} from "@/app/utils/geometry";

// Everything that draws pixels on the canvas.
//
// No camera transform is used - the canvas is always drawn in SCREEN space.
// Every shape is translated by the camera offset manually:
//
//   screenX = worldX - camera.x
//   screenY = worldY - camera.y
//
// so panning the camera simply shifts where everything is drawn. The grid
// only draws the lines inside the visible viewport (computed via
// screenToWorld), so panning never runs out of grid.

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

// Draws an infinite grid across the visible viewport. Grid lines live at
// world coordinates; each one is drawn shifted by the camera offset.
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number
) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#2a2a2a";
  ctx.beginPath();

  // Visible world rectangle: the four screen corners mapped into world space.
  const topLeft = screenToWorld(camera, 0, 0);
  const bottomRight = screenToWorld(camera, width, height);

  const startX = Math.floor(topLeft.x / GRID_SIZE) * GRID_SIZE;
  for (let x = startX; x <= bottomRight.x; x += GRID_SIZE) {
    ctx.moveTo(x - camera.x, topLeft.y - camera.y);
    ctx.lineTo(x - camera.x, bottomRight.y - camera.y);
  }

  const startY = Math.floor(topLeft.y / GRID_SIZE) * GRID_SIZE;
  for (let y = startY; y <= bottomRight.y; y += GRID_SIZE) {
    ctx.moveTo(topLeft.x - camera.x, y - camera.y);
    ctx.lineTo(bottomRight.x - camera.x, y - camera.y);
  }

  ctx.stroke();
}

// Redraws every shape, offsetting each one by the camera so it appears where
// it belongs on screen.
export function drawShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  camera: Camera,
  selectedIndex: number | null
) {
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  shapes.forEach((shape, index) => {
    ctx.strokeStyle = selectedIndex === index ? "#ffd166" : "#ffffff";

    switch (shape.type) {
      case "pencil": {
        ctx.beginPath();
        ctx.moveTo(
          shape.points[0].x - camera.x,
          shape.points[0].y - camera.y
        );
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(
            shape.points[i].x - camera.x,
            shape.points[i].y - camera.y
          );
        }
        ctx.stroke();
        break;
      }

      case "rectangle":
        ctx.strokeRect(
          shape.x - camera.x,
          shape.y - camera.y,
          shape.width,
          shape.height
        );
        break;

      case "square":
        ctx.strokeRect(
          shape.x - camera.x,
          shape.y - camera.y,
          shape.size,
          shape.size
        );
        break;

      case "circle": {
        ctx.beginPath();
        ctx.arc(
          shape.x - camera.x,
          shape.y - camera.y,
          shape.radius,
          0,
          Math.PI * 2
        );
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

// Draws the selection UI (dashed bounding box + resize handles) in SCREEN
// space, translating the shape's world bounds with the camera offset.
export function drawSelection(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  shape: Shape
) {
  const b = getShapeBounds(shape);
  const topLeft = worldToScreen(camera, b.minX, b.minY);
  const bottomRight = worldToScreen(camera, b.maxX, b.maxY);
  const width = bottomRight.x - topLeft.x;
  const height = bottomRight.y - topLeft.y;

  // Dashed outline.
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(topLeft.x, topLeft.y, width, height);
  ctx.setLineDash([]);

  // Resize handles: filled squares at each corner.
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffd166";
  for (const handle of getResizeHandles(shape)) {
    const pos = worldToScreen(camera, handle.x, handle.y);
    ctx.fillRect(
      pos.x - HANDLE_SIZE / 2,
      pos.y - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE
    );
    ctx.strokeRect(
      pos.x - HANDLE_SIZE / 2,
      pos.y - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE
    );
  }
}
