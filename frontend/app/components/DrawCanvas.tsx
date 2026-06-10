"use client";

import { useRef, useEffect } from "react";
import { Tool } from "@/app/types/Tool";

type Point = {
  x: number;
  y: number;
};

type PencilShape = {
  type: "pencil";
  points: Point[];
};

type RectangleShape = {
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
};

type Shape =
  | PencilShape
  | RectangleShape;

type DrawCanvasProps = {
  tool: Tool;
};

export default function DrawCanvas({
  tool,
}: DrawCanvasProps) {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const isDrawing =
    useRef(false);

  const shapesRef =
    useRef<Shape[]>([]);

  const currentShape =
    useRef<Shape | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;

    canvas.width =
      window.innerWidth;

    canvas.height =
      window.innerHeight;

    ctx.fillStyle = "black";

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.lineWidth = 3;

    ctx.lineCap = "round";

    ctx.strokeStyle = "white";
  }, []);

  function drawShapes(
    shapes: Shape[]
  ) {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.fillStyle = "black";

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.strokeStyle = "white";

    shapes.forEach((shape) => {

  if (shape.type === "pencil") {

    ctx.beginPath();

    shape.points.forEach(
      (point, index) => {

        if (index === 0) {

          ctx.moveTo(
            point.x,
            point.y
          );

        } else {

          ctx.lineTo(
            point.x,
            point.y
          );

        }

      }
    );

    ctx.stroke();

  }

  if (shape.type === "rectangle") {

    ctx.strokeRect(
      shape.x,
      shape.y,
      shape.width,
      shape.height
    );

  }

});
}

  function handleMouseDown(
  e: React.MouseEvent<HTMLCanvasElement>
) {

  isDrawing.current = true;

  if (tool === "pencil") {

    currentShape.current = {
      type: "pencil",
      points: [
        {
          x: e.clientX,
          y: e.clientY,
        },
      ],
    };
  }

  if (tool === "rectangle") {

    currentShape.current = {
      type: "rectangle",
      x: e.clientX,
      y: e.clientY,
      width: 0,
      height: 0,
    };
  }
}
    function handleMouseMove(
    e: React.MouseEvent<HTMLCanvasElement>
  ) {
    if (
      !isDrawing.current ||
      !currentShape.current
    )
      return;

    if (
  currentShape.current.type ===
  "pencil"
) {

  currentShape.current.points.push({
    x: e.clientX,
    y: e.clientY,
  });

}

if (
  currentShape.current.type ===
  "rectangle"
) {

  currentShape.current.width =
    e.clientX -
    currentShape.current.x;

  currentShape.current.height =
    e.clientY -
    currentShape.current.y;

}

    const temp = [
      ...shapesRef.current,
      currentShape.current,
    ];

    drawShapes(temp);
  }

  function handleMouseUp() {
    if (
      !isDrawing.current ||
      !currentShape.current
    )
      return;

    isDrawing.current = false;

    shapesRef.current.push(
      currentShape.current
    );

    currentShape.current = null;

    drawShapes(
      shapesRef.current
    );
  }
  return (
    <canvas
      ref={canvasRef}
      onMouseDown={
        handleMouseDown
      }
      onMouseMove={
        handleMouseMove
      }
      onMouseUp={
        handleMouseUp
      }

      style={{
        border:
          "2px solid white",
        display: "block",
      }}
    />
  );
}