// IMPORTANT:
// All coordinates stored in these shapes are CANVAS-LOCAL coordinates,
// expressed in CSS pixels. The canvas starts at the top of the document and
// only grows downward, so these coordinates also equal page coordinates.
// Because shapes keep their original coordinates, they never move when the
// canvas is expanded - the canvas itself just gets taller.

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
