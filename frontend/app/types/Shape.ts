// IMPORTANT:
// All coordinates stored in these shapes are WORLD coordinates (CSS pixels in
// an infinite plane the camera floats over) - NOT canvas-local coordinates.
// The canvas is a fixed-size viewport; the camera in utils/camera.ts maps
// world points to screen points for rendering (screenX = worldX - camera.x).
// Because shapes keep their world coordinates forever, panning the camera or
// resizing the window never moves or loses them.

export type Point = {
  x: number;
  y: number;
};

export type PencilShape = {
  type: "pencil";
  points: Point[];
};

export type RectangleShape = {
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SquareShape = {
  type: "square";
  x: number;
  y: number;
  size: number;
};

export type CircleShape = {
  type: "circle";
  x: number;
  y: number;
  radius: number;
};

export type Shape =
  | PencilShape
  | RectangleShape
  | SquareShape
  | CircleShape;
