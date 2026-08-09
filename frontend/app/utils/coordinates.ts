import type { Camera } from "@/app/utils/camera";
import type { Point } from "@/app/types/Shape";

// Coordinate conversion helpers.
//
// All mouse input arrives in SCREEN coordinates (CSS pixels inside the
// canvas). All shapes are stored in WORLD coordinates (an infinite plane the
// camera floats over). These two helpers are the only place those spaces
// meet, so every other module can pick one space and stay consistent.
//
// With no zoom, the two spaces differ by a pure translation: the screen is
// just the world shifted by the camera. screenToWorld adds the camera
// offset, worldToScreen subtracts it.

export function screenToWorld(
  camera: Camera,
  screenX: number,
  screenY: number
): Point {
  return {
    x: screenX + camera.x,
    y: screenY + camera.y,
  };
}

export function worldToScreen(
  camera: Camera,
  worldX: number,
  worldY: number
): Point {
  return {
    x: worldX - camera.x,
    y: worldY - camera.y,
  };
}
