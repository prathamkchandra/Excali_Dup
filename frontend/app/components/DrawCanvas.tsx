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

type SquareShape = {
  type: "square";
  x: number;
  y: number;
  size: number;
};
type CircleShape = {
  type: "circle";
  x: number;
  y: number;
  radius: number;
};

type Shape = PencilShape | RectangleShape | SquareShape | CircleShape;

type DrawCanvasProps = {
  tool: Tool;
};

export default function DrawCanvas({ tool }: DrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawing = useRef(false);

  const shapesRef = useRef<Shape[]>([]);

  const currentShape = useRef<Shape | null>(null);

  const selectedShape = useRef<number | null>(null);

  const isDraggingShape = useRef(false);

  const dragOffset = useRef({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = window.innerWidth;

    canvas.height = window.innerHeight;

    ctx.fillStyle = "black";

    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;

    ctx.lineCap = "round";

    ctx.strokeStyle = "white";
  }, []);

  function drawShapes(shapes: Shape[]) {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "black";

    ctx.fillRect(0, 0, canvas.width, canvas.height);

    shapes.forEach((shape, index) => {
      ctx.strokeStyle = selectedShape.current === index ? "yellow" : "white";
      if (shape.type === "pencil") {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        shape.points.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });

        ctx.stroke();
      }

      if (shape.type === "rectangle") {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
      }

      if (shape.type === "square") {
        ctx.strokeRect(shape.x, shape.y, shape.size, shape.size);
      }
      if (shape.type === "circle") {
        ctx.beginPath();

        ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);

        ctx.stroke();
      }

      if (selectedShape.current === index) {
        ctx.strokeStyle = "yellow";
      } else {
        ctx.strokeStyle = "white";
      }
    });
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool === "eraser") {
      const index = findShapeAt(e.clientX, e.clientY);

      if (index !== null) {
        shapesRef.current.splice(index, 1);

        drawShapes(shapesRef.current);
      }

      return;
    }
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
    if (tool === "square") {
      currentShape.current = {
        type: "square",
        x: e.clientX,
        y: e.clientY,
        size: 0,
      };
    }
    if (tool === "circle") {
      currentShape.current = {
        type: "circle",
        x: e.clientX,
        y: e.clientY,
        radius: 0,
      };
    }
    if (tool === "select") {
      const index = findShapeAt(e.clientX, e.clientY);

      selectedShape.current = index;

      if (index !== null) {
        const shape = shapesRef.current[index];

        if (
          shape.type === "rectangle" ||
          shape.type === "circle" ||
          shape.type === "square"
        ) {
          dragOffset.current = {
            x: e.clientX - shape.x,
            y: e.clientY - shape.y,
          };

          isDraggingShape.current = true;
        }
      }

      drawShapes(shapesRef.current);

      return;
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    // SELECT + DRAG MODE

    if (tool === "eraser") {
      const index = findShapeAt(e.clientX, e.clientY);

      if (index !== null) {
        shapesRef.current.splice(index, 1);

        drawShapes(shapesRef.current);
      }

      return;
    }
    if (
      tool === "select" &&
      isDraggingShape.current &&
      selectedShape.current !== null
    ) {
      const shape = shapesRef.current[selectedShape.current];

      if (shape.type === "rectangle") {
        shape.x = e.clientX - dragOffset.current.x;

        shape.y = e.clientY - dragOffset.current.y;
      }

      if (shape.type === "circle") {
        shape.x = e.clientX - dragOffset.current.x;

        shape.y = e.clientY - dragOffset.current.y;
      }
      if (shape.type === "square") {
        shape.x = e.clientX - dragOffset.current.x;

        shape.y = e.clientY - dragOffset.current.y;
      }

      drawShapes(shapesRef.current);

      return;
    }

    // DRAWING MODE
    if (!isDrawing.current || !currentShape.current) {
      return;
    }

    if (currentShape.current.type === "pencil") {
      console.log("pencil");
      currentShape.current.points.push({
        x: e.clientX,
        y: e.clientY,
      });
    }

    if (currentShape.current.type === "rectangle") {
      currentShape.current.width = e.clientX - currentShape.current.x;

      currentShape.current.height = e.clientY - currentShape.current.y;
    }

    if (currentShape.current.type === "square") {
      const dx = e.clientX - currentShape.current.x;

      const dy = e.clientY - currentShape.current.y;

      currentShape.current.size = Math.max(Math.abs(dx), Math.abs(dy));
    }

    if (currentShape.current.type === "circle") {
      const dx = e.clientX - currentShape.current.x;

      const dy = e.clientY - currentShape.current.y;

      currentShape.current.radius = Math.sqrt(dx * dx + dy * dy);
    }

    const temp = [...shapesRef.current, currentShape.current];

    drawShapes(temp);
  }
  function handleMouseUp() {
    if (!isDrawing.current || !currentShape.current) return;
    isDraggingShape.current = false;

    isDrawing.current = true;
    console.log("Dragging started");

    shapesRef.current.push(currentShape.current);

    currentShape.current = null;

    drawShapes(shapesRef.current);
  }

  function findShapeAt(x: number, y: number) {
    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      const shape = shapesRef.current[i];

      if (shape.type === "pencil") {
        const xs = shape.points.map((point) => point.x);

        const ys = shape.points.map((point) => point.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);

        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          return i;
        }

        return (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              border: "1px solid black",
              display: "block",
            }}
          />
        );
      }

      if (shape.type === "rectangle") {
        if (
          x >= shape.x &&
          x <= shape.x + shape.width &&
          y >= shape.y &&
          y <= shape.y + shape.height
        ) {
          return i;
        }
      }

      if (shape.type === "square") {
        if (
          x >= shape.x &&
          x <= shape.x + shape.size &&
          y >= shape.y &&
          y <= shape.y + shape.size
        ) {
          return i;
        }
      }

      if (shape.type === "circle") {
        const dx = x - shape.x;

        const dy = y - shape.y;

        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= shape.radius) {
          return i;
        }
      }
    }

    return null;
  }
  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        border: "2px solid white",
        display: "block",
        cursor:
          tool === "select"
            ? "grab"
            : ["eraser", "rectangle", "circle", "square"].includes(tool)
              ? "crosshair"
              : "default",
      }}
    />
  );
}
