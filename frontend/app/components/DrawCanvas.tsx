"use client";

import { useRef, useEffect } from "react";
import { tool } from "@/app/types/Tool";

type Point = {
  x: number;
  y: number;
};

type Shape = {
  type: "pencil";
  points: Point[];
};

type DrawCanvasProps = {
  tool: tool;
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
    });
  }

  function handleMouseDown(
    e: React.MouseEvent<HTMLCanvasElement>
  ) {

    if (tool !== "pencil")
      return;

    isDrawing.current = true;

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

  function handleMouseMove(
    e: React.MouseEvent<HTMLCanvasElement>
  ) {
    if (
      !isDrawing.current ||
      !currentShape.current
    )
      return;

    currentShape.current.points.push({
      x: e.clientX,
      y: e.clientY,
    });

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