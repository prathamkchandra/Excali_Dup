// Camera module.
//
// The camera maps WORLD coordinates (where shapes actually live, in an
// infinite plane) to SCREEN coordinates (CSS pixels inside the canvas).
//
//   screenX = worldX - camera.x
//   screenY = worldY - camera.y
//
// camera.x / camera.y describe how far the camera has been panned (i.e. they
// are the screen position of world origin (0, 0), with a sign flip baked in
// so that panning "right" with the mouse shows content moving right, exactly
// like dragging the world in Excalidraw).

export type Camera = {
  x: number;
  y: number;
};
