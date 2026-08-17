import type { Camera } from "@/app/utils/camera";
import type { Point } from "@/app/types/Shape";

// Coordinate conversion helpers.
//
// All mouse input arrives in SCREEN coordinates (CSS pixels inside the
// canvas). All shapes are stored in WORLD coordinates (an infinite plane the
// camera floats over). These two helpers are the only place those spaces
// meet, so every other module can pick one space and stay consistent.
//
// The render applies ctx.scale(zoom, zoom) then ctx.translate(-camera.x,
// -camera.y), so a world point lands on screen at:
//
//   screenX = (worldX - camera.x) * zoom
//   screenY = (worldY - camera.y) * zoom
//
// and the inverse is used to convert mouse input back to world space.

export function screenToWorld(
  camera: Camera,
  zoom: number,
  screenX: number,
  screenY: number
): Point {
  return {
    x: screenX / zoom + camera.x,
    y: screenY / zoom + camera.y,
  };
}

export function worldToScreen(
  camera: Camera,
  zoom: number,
  worldX: number,
  worldY: number
): Point {
  return {
    x: (worldX - camera.x) * zoom,
    y: (worldY - camera.y) * zoom,
  };
}
