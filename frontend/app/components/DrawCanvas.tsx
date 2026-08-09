"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  memo,
} from "react";

import type { Ref } from "react";
import { Tool } from "@/app/types/Tool";
import type { Shape } from "@/app/types/Shape";
import type { Camera } from "@/app/utils/camera";

import { screenToWorld } from "@/app/utils/coordinates";
import { syncBufferToCss } from "@/app/utils/canvas";

import {
  fillBackground,
  drawGrid,
  drawShapes,
  drawSelection,
  drawEraserCursor,
} from "@/app/utils/draw";

import {
  shapeContainsPoint,
  hitTestResizeHandle,
  resizeCursor,
} from "@/app/utils/geometry";

import {
  translateShape,
  resizeShape,
  normalizeRect,
} from "@/app/utils/shapes";

import type { ResizeHandleId } from "@/app/utils/geometry";

export type DrawCanvasHandle = {
  undo: () => void;
  redo: () => void;
};

type Props = {
  tool: Tool;
  ref?: Ref<DrawCanvasHandle>;
};

type Gesture = "draw" | "drag" | "resize" | "pan" | null;

function DrawCanvas({ tool, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const shapesRef = useRef<Shape[]>([]);
  const currentShape = useRef<Shape | null>(null);
  const selectedShape = useRef<number | null>(null);

  const cameraRef = useRef<Camera>({ x: 0, y: 0 });

  const gestureRef = useRef<Gesture>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const mousePos = useRef({ x: 0, y: 0 });
  const mouseOverCanvas = useRef(false);

  const history = useRef<Shape[][]>([]);
  const redoStack = useRef<Shape[][]>([]);

  const rafId = useRef<number | null>(null);
  const needsRender = useRef(false);

  const toolRef = useRef(tool);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // 🎯 RENDER LOOP
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    syncBufferToCss(canvas);

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    fillBackground(ctx, width, height);
    drawGrid(ctx, cameraRef.current, width, height);

    const allShapes = currentShape.current
      ? [...shapesRef.current, currentShape.current]
      : shapesRef.current;

    drawShapes(ctx, allShapes, cameraRef.current, selectedShape.current);

    if (selectedShape.current !== null) {
      const shape = shapesRef.current[selectedShape.current];
      if (shape) drawSelection(ctx, cameraRef.current, shape);
    }

    if (
      mouseOverCanvas.current &&
      toolRef.current === "eraser"
    ) {
      drawEraserCursor(ctx, mousePos.current.x, mousePos.current.y);
    }

    needsRender.current = false;
  }, []);

  const scheduleRender = useCallback(() => {
    needsRender.current = true;
    if (rafId.current) return;

    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (needsRender.current) render();
    });
  }, [render]);

  // 🧠 HISTORY
  const commitHistory = () => {
    history.current.push(JSON.parse(JSON.stringify(shapesRef.current)));
    redoStack.current = [];
  };

  const undo = () => {
    if (!history.current.length) return;

    redoStack.current.push(shapesRef.current);
    shapesRef.current = history.current.pop()!;
    scheduleRender();
  };

  const redo = () => {
    if (!redoStack.current.length) return;

    history.current.push(shapesRef.current);
    shapesRef.current = redoStack.current.pop()!;
    scheduleRender();
  };

  useImperativeHandle(ref, () => ({
    undo,
    redo,
  }));

  // 🧠 HELPERS
  const screenPoint = (x: number, y: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: x - rect.left, y: y - rect.top };
  };

  const worldPoint = (x: number, y: number) => {
    const s = screenPoint(x, y);
    return screenToWorld(cameraRef.current, s.x, s.y);
  };

  const findShapeAt = (x: number, y: number) => {
    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      if (shapeContainsPoint(shapesRef.current[i], x, y)) return i;
    }
    return null;
  };

  // 🎯 EVENTS
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const w = worldPoint(e.clientX, e.clientY);

    if (tool === "eraser") {
      const index = findShapeAt(w.x, w.y);
      if (index !== null) {
        shapesRef.current.splice(index, 1);
        commitHistory();
        scheduleRender();
      }
      return;
    }

    if (tool === "select") {
      const index = findShapeAt(w.x, w.y);
      if (index !== null) {
        selectedShape.current = index;
        const shape = shapesRef.current[index];

        const anchor =
          shape.type === "pencil"
            ? shape.points[0]
            : { x: shape.x, y: shape.y };

        dragOffset.current = {
          x: w.x - anchor.x,
          y: w.y - anchor.y,
        };

        gestureRef.current = "drag";
      } else {
        selectedShape.current = null;
        gestureRef.current = "pan";
      }

      scheduleRender();
      return;
    }

    // DRAW
    if (tool === "pencil") {
      currentShape.current = { type: "pencil", points: [w] };
    }

    if (tool === "rectangle") {
      currentShape.current = {
        type: "rectangle",
        x: w.x,
        y: w.y,
        width: 0,
        height: 0,
      };
    }

    if (tool === "circle") {
      currentShape.current = {
        type: "circle",
        x: w.x,
        y: w.y,
        radius: 0,
      };
    }

    gestureRef.current = "draw";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    mousePos.current = screenPoint(e.clientX, e.clientY);

    const w = worldPoint(e.clientX, e.clientY);

    if (gestureRef.current === "drag" && selectedShape.current !== null) {
      const shape = shapesRef.current[selectedShape.current];
      const anchor =
        shape.type === "pencil"
          ? shape.points[0]
          : { x: shape.x, y: shape.y };

      const dx = w.x - dragOffset.current.x - anchor.x;
      const dy = w.y - dragOffset.current.y - anchor.y;

      translateShape(shape, dx, dy);
      scheduleRender();
      return;
    }

    if (gestureRef.current === "pan") {
      cameraRef.current.x -= e.movementX;
      cameraRef.current.y -= e.movementY;
      scheduleRender();
      return;
    }

    if (!currentShape.current) return;

    const shape = currentShape.current;

    if (shape.type === "pencil") {
      shape.points.push(w);
    }

    if (shape.type === "rectangle") {
      shape.width = w.x - shape.x;
      shape.height = w.y - shape.y;
    }

    if (shape.type === "circle") {
      shape.radius = Math.hypot(w.x - shape.x, w.y - shape.y);
    }

    scheduleRender();
  };

  const handleMouseUp = () => {
    if (gestureRef.current === "draw" && currentShape.current) {
      if (currentShape.current.type === "rectangle") {
        normalizeRect(currentShape.current);
      }

      shapesRef.current.push(currentShape.current);
      currentShape.current = null;
      commitHistory();
    }

    gestureRef.current = null;
    scheduleRender();
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseEnter={() => (mouseOverCanvas.current = true)}
      onMouseLeave={() => (mouseOverCanvas.current = false)}
      style={{
        position: "fixed",
        inset: 0,
        display: "block",
      }}
    />
  );
}

export default memo(DrawCanvas);