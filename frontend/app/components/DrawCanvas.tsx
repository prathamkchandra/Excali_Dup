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
  type: "rectangle" | "square";
  x: number;
  y: number;
  width: number;
  height: number;
};

type CircleShape = {
  type: "circle";
  x: number;
  y: number;
  radius: number;
};

type Shape = PencilShape | RectangleShape | CircleShape;

type Props = {
  tool: Tool;
};

export default function DrawCanvas({ tool }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawing = useRef(false);
  const shapesRef = useRef<Shape[]>([]);
  const currentShape = useRef<Shape | null>(null);

  const selectedShape = useRef<number | null>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // 🎯 INIT CANVAS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    drawShapes(shapesRef.current);
  }, []);

  // 🎯 DRAW ALL SHAPES
  function drawShapes(shapes: Shape[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;

    shapes.forEach((shape) => {
      ctx.beginPath();

      if (shape.type === "pencil") {
        shape.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }

      if (shape.type === "rectangle" || shape.type === "square") {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      }

      if (shape.type === "circle") {
        ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  // 🎯 FIND SHAPE FOR SELECT / ERASE
  function findShapeAt(x: number, y: number): number | null {
    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      const shape = shapesRef.current[i];

      if (shape.type === "rectangle" || shape.type === "square") {
        if (
          x >= shape.x &&
          x <= shape.x + shape.width &&
          y >= shape.y &&
          y <= shape.y + shape.height
        ) return i;
      }

      if (shape.type === "circle") {
        const dx = x - shape.x;
        const dy = y - shape.y;
        if (dx * dx + dy * dy <= shape.radius * shape.radius) return i;
      }

      if (shape.type === "pencil") {
        for (const p of shape.points) {
          if (Math.abs(p.x - x) < 5 && Math.abs(p.y - y) < 5) return i;
        }
      }
    }

    return null;
  }

  // 🖱️ MOUSE DOWN
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const x = e.clientX;
    const y = e.clientY;

    // ERASER
    if (tool === "eraser") {
      const index = findShapeAt(x, y);
      if (index !== null) {
        shapesRef.current.splice(index, 1);
        drawShapes(shapesRef.current);
      }
      return;
    }

    // SELECT
    if (tool === "select") {
      const index = findShapeAt(x, y);

      if (index !== null) {
        selectedShape.current = index;
        isDragging.current = true;

        const shape = shapesRef.current[index];

        if (shape.type !== "pencil") {
          dragOffset.current = {
            x: x - shape.x,
            y: y - shape.y,
          };
        }
      } else {
        selectedShape.current = null;
      }

      return;
    }

    // DRAWING START
    isDrawing.current = true;

    if (tool === "pencil") {
      currentShape.current = {
        type: "pencil",
        points: [{ x, y }],
      };
    }

    if (tool === "rectangle") {
      currentShape.current = {
        type: "rectangle",
        x,
        y,
        width: 0,
        height: 0,
      };
    }

    if (tool === "square") {
      currentShape.current = {
        type: "square",
        x,
        y,
        width: 0,
        height: 0,
      };
    }

    if (tool === "circle") {
      currentShape.current = {
        type: "circle",
        x,
        y,
        radius: 0,
      };
    }
  }

  // 🖱️ MOUSE MOVE
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const x = e.clientX;
    const y = e.clientY;

    // DRAGGING
    if (
      tool === "select" &&
      isDragging.current &&
      selectedShape.current !== null
    ) {
      const shape = shapesRef.current[selectedShape.current];

      if (shape.type === "pencil") {
        const dx = x - shape.points[0].x;
        const dy = y - shape.points[0].y;

        shape.points = shape.points.map((p) => ({
          x: p.x + dx,
          y: p.y + dy,
        }));
      } else {
        shape.x = x - dragOffset.current.x;
        shape.y = y - dragOffset.current.y;
      }

      drawShapes(shapesRef.current);
      return;
    }

    // DRAWING
    if (!isDrawing.current || !currentShape.current) return;

    if (currentShape.current.type === "pencil") {
      currentShape.current.points.push({ x, y });
    }

    if (
      currentShape.current.type === "rectangle" ||
      currentShape.current.type === "square"
    ) {
      const dx = x - currentShape.current.x;
      const dy = y - currentShape.current.y;

      if (currentShape.current.type === "square") {
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        currentShape.current.width = size * Math.sign(dx);
        currentShape.current.height = size * Math.sign(dy);
      } else {
        currentShape.current.width = dx;
        currentShape.current.height = dy;
      }
    }

    if (currentShape.current.type === "circle") {
      const dx = x - currentShape.current.x;
      const dy = y - currentShape.current.y;
      currentShape.current.radius = Math.sqrt(dx * dx + dy * dy);
    }

    drawShapes([...shapesRef.current, currentShape.current]);
  }

  // 🖱️ MOUSE UP
  function handleMouseUp() {
    isDrawing.current = false;
    isDragging.current = false;

    if (currentShape.current) {
      shapesRef.current.push(currentShape.current);
      currentShape.current = null;
    }

    drawShapes(shapesRef.current);
  }

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        display: "block",
        cursor:
          tool === "pencil"
            ? "crosshair"
            : tool === "eraser"
            ? "pointer"
            : tool === "select"
            ? "default"
            : "crosshair",
      }}
    />
  );
}