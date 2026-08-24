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

// A straight segment between two world-space endpoints. Unlike the area
// shapes there is no canonical "origin corner": both endpoints matter, so
// dragging must move all four numbers and resizing moves one endpoint at a
// time.
export type LineShape = {
  type: "line";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

// Same geometry as a line, but rendered with an arrowhead at (endX, endY).
export type ArrowShape = {
  type: "arrow";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

export type Shape =
  | PencilShape
  | RectangleShape
  | SquareShape
  | CircleShape
  | LineShape
  | ArrowShape;
