"use client";

import { memo, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";

import { Tool } from "@/app/types/Tool";
import type { Shape } from "@/app/types/Shape";
import type { Camera } from "@/app/utils/camera";

import { screenToWorld } from "@/app/utils/coordinates";
import { syncCanvas } from "@/app/utils/canvas";

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
  getShapeBounds,
  getDragAnchor,
  snapAngle,
} from "@/app/utils/geometry";
import type { ResizeHandleId } from "@/app/utils/geometry";

import {
  translateShape,
  resizeShape,
  normalizeRect,
} from "@/app/utils/shapes";

export type DrawCanvasHandle = {
  undo: () => void;
  redo: () => void;
  setZoom: (zoom: number) => void;
  zoomBy: (factor: number) => void;
  fitToScreen: () => void;
};

type Props = {
  tool: Tool;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  ref?: Ref<DrawCanvasHandle>;
};

type Gesture = "draw" | "drag" | "resize" | "pan" | null;

// Zoom limits and step sizes. Step is a fixed ratio: each notch multiplies
// the zoom by ZOOM_SCROLL_STEP, so zooming feels consistent at any level.
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;
const ZOOM_SCROLL_STEP = 1.1;

// Eraser hit radius (world units) - also the radius of the drawn cursor.
const ERASER_RADIUS = 12;
// Minimum distance between pencil points; keeps fast strokes light.
const PENCIL_MIN_DISTANCE = 1.5;

// Static cursor for a tool, before any hover/pan overrides:
//   - pencil: custom pencil SVG, hotspot at the tip (3, 28)
//   - eraser: OS cursor hidden; a circle is drawn on the canvas instead
//   - select: default arrow
//   - shapes (rectangle/square/circle): crosshair
function baseCursorForTool(t: Tool): string {
  switch (t) {
    case "pencil":
      return "url('/cursors/pencil.svg') 3 28, crosshair";
    case "eraser":
      return "none";
    case "select":
      return "default";
    default:
      return "crosshair";
  }
}

function DrawCanvas({ tool, zoom, onZoomChange, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const shapesRef = useRef<Shape[]>([]);
  const currentShape = useRef<Shape | null>(null);
  const selectedShape = useRef<number | null>(null);

  const cameraRef = useRef<Camera>({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const history = useRef<Shape[][]>([]);
  const redoStack = useRef<Shape[][]>([]);

  const needsRender = useRef(false);
  const rafId = useRef<number | null>(null);

  const mousePos = useRef({ x: 0, y: 0 });
  const mouseOverCanvas = useRef(false);

  const gestureRef = useRef<Gesture>(null);
  const spaceDown = useRef(false);

  const dragOffset = useRef({ x: 0, y: 0 });
  const dragMoved = useRef(false);

  const resizeHandle = useRef<ResizeHandleId>("br");
  const resizeStart = useRef("");
  const resizeChanged = useRef(false);

  const panLast = useRef({ x: 0, y: 0 });
  const touchPanActive = useRef(false);

  const toolRef = useRef(tool);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // ------------------------------------------------------------------
  // Render loop. Everything is drawn here (background, grid, shapes,
  // selection, eraser cursor) - event handlers only mutate state and call
  // scheduleRender().
  // ------------------------------------------------------------------
  const render = useCallback(() => {
    needsRender.current = false;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    syncCanvas(canvas);

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const camera = cameraRef.current;
    const zoom = zoomRef.current;

    // Screen space: clear + background across the full viewport.
    ctx.clearRect(0, 0, width, height);
    fillBackground(ctx, width, height);

    // World space: grid, shapes, and selection drawn under the camera
    // transform (scale by zoom, then translate so camera sits at top-left).
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-camera.x, -camera.y);

    drawGrid(ctx, camera, zoom, width, height);

    const allShapes = currentShape.current
      ? [...shapesRef.current, currentShape.current]
      : shapesRef.current;
    drawShapes(ctx, allShapes, selectedShape.current);

    if (selectedShape.current !== null) {
      const shape = shapesRef.current[selectedShape.current];
      if (shape) drawSelection(ctx, shape, zoom);
    }

    ctx.restore();

    // Screen space (on top): the eraser cursor is pure visual feedback.
    if (mouseOverCanvas.current && toolRef.current === "eraser") {
      drawEraserCursor(ctx, mousePos.current.x, mousePos.current.y, ERASER_RADIUS);
    }
  }, []);

  const scheduleRender = useCallback(() => {
    needsRender.current = true;
    if (rafId.current !== null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (needsRender.current) render();
    });
  }, [render]);

  // ------------------------------------------------------------------
  // History.
  //
  // Every mutating gesture (draw / drag / resize) snapshots the state BEFORE
  // it mutates, so undo restores the pre-gesture state. If the gesture turns
  // out to be a no-op (pure click, no movement) the snapshot is discarded.
  // The eraser snapshots before each click-erase.
  // ------------------------------------------------------------------
  const cloneShapes = useCallback(
    () => JSON.parse(JSON.stringify(shapesRef.current)) as Shape[],
    []
  );

  const pushHistory = useCallback(() => {
    history.current.push(cloneShapes());
    redoStack.current = [];
  }, [cloneShapes]);

  const discardSnapshot = useCallback(() => {
    history.current.pop();
  }, []);

  const handleUndo = useCallback(() => {
    if (history.current.length === 0) return;
    redoStack.current.push(cloneShapes());
    shapesRef.current = history.current.pop() || [];
    selectedShape.current = null;
    render();
  }, [cloneShapes, render]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    history.current.push(cloneShapes());
    shapesRef.current = redoStack.current.pop() || [];
    selectedShape.current = null;
    render();
  }, [cloneShapes, render]);

  // ------------------------------------------------------------------
  // Coordinate helpers (screen <-> world).
  // ------------------------------------------------------------------
  const screenPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const worldPoint = useCallback(
    (clientX: number, clientY: number) => {
      const s = screenPoint(clientX, clientY);
      return screenToWorld(cameraRef.current, zoomRef.current, s.x, s.y);
    },
    [screenPoint]
  );

  const findShapeAt = useCallback(
    (x: number, y: number, padding = 0): number | null => {
      for (let i = shapesRef.current.length - 1; i >= 0; i--) {
        if (shapeContainsPoint(shapesRef.current[i], x, y, padding)) return i;
      }
      return null;
    },
    []
  );

  // ------------------------------------------------------------------
  // Cursor (mutates canvas.style.cursor directly - no React re-renders).
  // ------------------------------------------------------------------
  const refreshCursor = useCallback(
    (clientX?: number, clientY?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const gesture = gestureRef.current;

      if (spaceDown.current || gesture === "pan") {
        canvas.style.cursor = gesture === "pan" ? "grabbing" : "grab";
        return;
      }
      if (gesture === "drag") {
        canvas.style.cursor = "grabbing";
        return;
      }
      if (gesture === "resize") {
        canvas.style.cursor = resizeCursor(resizeHandle.current);
        return;
      }

      const t = toolRef.current;

      if (t === "select" && clientX !== undefined && clientY !== undefined) {
        const sel = selectedShape.current;
        if (sel !== null) {
          const shape = shapesRef.current[sel];
          if (shape) {
            const s = screenPoint(clientX, clientY);
            const handle = hitTestResizeHandle(
              shape,
              cameraRef.current,
              zoomRef.current,
              s.x,
              s.y
            );
            if (handle) {
              canvas.style.cursor = resizeCursor(handle);
              return;
            }
          }
          canvas.style.cursor = "move";
          return;
        }

        const w = worldPoint(clientX, clientY);
        canvas.style.cursor = findShapeAt(w.x, w.y) !== null ? "grab" : "default";
        return;
      }

      canvas.style.cursor = baseCursorForTool(t);
    },
    [screenPoint, worldPoint, findShapeAt]
  );

  // ------------------------------------------------------------------
  // Draw gesture.
  // ------------------------------------------------------------------
  const beginDraw = useCallback(
    (point: { x: number; y: number }) => {
      const t = toolRef.current;
      let shape: Shape | null = null;

      if (t === "pencil") {
        shape = { type: "pencil", points: [{ x: point.x, y: point.y }] };
      } else if (t === "rectangle") {
        shape = { type: "rectangle", x: point.x, y: point.y, width: 0, height: 0 };
      } else if (t === "square") {
        shape = { type: "square", x: point.x, y: point.y, size: 0 };
      } else if (t === "circle") {
        shape = { type: "circle", x: point.x, y: point.y, radius: 0 };
      } else if (t === "line" || t === "arrow") {
        // Both endpoints start at the press point; updateDraw moves the end
        // as the pointer drags.
        shape = {
          type: t,
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y,
        };
      }
      if (!shape) return;

      currentShape.current = shape;
      selectedShape.current = null;
      gestureRef.current = "draw";
      pushHistory();
      scheduleRender();
    },
    [pushHistory, scheduleRender]
  );

  const updateDraw = useCallback(
    (point: { x: number; y: number }, shiftKey: boolean) => {
      const shape = currentShape.current;
      if (!shape) return;

      if (shape.type === "pencil") {
        const last = shape.points[shape.points.length - 1];
        if (
          !last ||
          Math.hypot(point.x - last.x, point.y - last.y) >= PENCIL_MIN_DISTANCE
        ) {
          shape.points.push(point);
        }
      } else if (shape.type === "rectangle") {
        shape.width = point.x - shape.x;
        shape.height = point.y - shape.y;
      } else if (shape.type === "square") {
        shape.size = Math.max(
          Math.abs(point.x - shape.x),
          Math.abs(point.y - shape.y)
        );
      } else if (shape.type === "circle") {
        shape.radius = Math.hypot(point.x - shape.x, point.y - shape.y);
      } else if (shape.type === "line" || shape.type === "arrow") {
        // Shift constrains the segment to the nearest 45° ray from start.
        const end = shiftKey
          ? snapAngle({ x: shape.startX, y: shape.startY }, point)
          : point;
        shape.endX = end.x;
        shape.endY = end.y;
      }

      scheduleRender();
    },
    [scheduleRender]
  );

  const endDraw = useCallback(() => {
    const shape = currentShape.current;
    gestureRef.current = null;

    if (shape) {
      const degenerate =
        (shape.type === "rectangle" && shape.width === 0 && shape.height === 0) ||
        (shape.type === "square" && shape.size === 0) ||
        (shape.type === "circle" && shape.radius === 0) ||
        ((shape.type === "line" || shape.type === "arrow") &&
          shape.startX === shape.endX &&
          shape.startY === shape.endY);

      if (degenerate) {
        discardSnapshot();
      } else {
        if (shape.type === "rectangle") normalizeRect(shape);
        shapesRef.current.push(shape);
      }
      currentShape.current = null;
    }

    scheduleRender();
  }, [discardSnapshot, scheduleRender]);

  // ------------------------------------------------------------------
  // Drag gesture (select tool).
  // ------------------------------------------------------------------
  const beginDrag = useCallback(
    (index: number, point: { x: number; y: number }) => {
      selectedShape.current = index;
      const shape = shapesRef.current[index];
      const anchor = getDragAnchor(shape);

      dragOffset.current = {
        x: point.x - anchor.x,
        y: point.y - anchor.y,
      };
      dragMoved.current = false;
      gestureRef.current = "drag";
      pushHistory();
      scheduleRender();
    },
    [pushHistory, scheduleRender]
  );

  const updateDrag = useCallback(
    (point: { x: number; y: number }) => {
      if (selectedShape.current === null) return;
      const shape = shapesRef.current[selectedShape.current];
      if (!shape) return;

      // The anchor follows the shape as it moves, so the delta is always
      // relative to the grab point captured at beginDrag.
      const anchor = getDragAnchor(shape);

      const dx = point.x - dragOffset.current.x - anchor.x;
      const dy = point.y - dragOffset.current.y - anchor.y;

      if (dx !== 0 || dy !== 0) {
        translateShape(shape, dx, dy);
        dragMoved.current = true;
      }

      scheduleRender();
    },
    [scheduleRender]
  );

  const endDrag = useCallback(() => {
    if (!dragMoved.current) discardSnapshot();
    dragMoved.current = false;
    gestureRef.current = null;
    scheduleRender();
  }, [discardSnapshot, scheduleRender]);

  // ------------------------------------------------------------------
  // Resize gesture (select tool, on a corner handle).
  // ------------------------------------------------------------------
  const beginResize = useCallback(
    (handle: ResizeHandleId) => {
      if (selectedShape.current === null) return;
      const shape = shapesRef.current[selectedShape.current];
      if (!shape) return;

      resizeHandle.current = handle;
      resizeStart.current = JSON.stringify(shape);
      resizeChanged.current = false;
      gestureRef.current = "resize";
      pushHistory();
    },
    [pushHistory]
  );

  const updateResize = useCallback(
    (point: { x: number; y: number }, shiftKey: boolean) => {
      if (selectedShape.current === null) return;
      const shape = shapesRef.current[selectedShape.current];
      if (!shape) return;

      // Shift on an endpoint handle constrains the dragged endpoint to a
      // 45° ray from the anchored opposite endpoint.
      let target = point;
      if (
        shiftKey &&
        (shape.type === "line" || shape.type === "arrow")
      ) {
        const anchor =
          resizeHandle.current === "start"
            ? { x: shape.endX, y: shape.endY }
            : { x: shape.startX, y: shape.startY };
        target = snapAngle(anchor, point);
      }

      resizeShape(shape, resizeHandle.current, target);
      if (JSON.stringify(shape) !== resizeStart.current) {
        resizeChanged.current = true;
      }

      scheduleRender();
    },
    [scheduleRender]
  );

  const endResize = useCallback(() => {
    if (!resizeChanged.current) discardSnapshot();
    resizeChanged.current = false;
    gestureRef.current = null;
    scheduleRender();
  }, [discardSnapshot, scheduleRender]);

  // ------------------------------------------------------------------
  // Pan gesture (drag empty space, middle mouse, or space+drag).
  // ------------------------------------------------------------------
  const beginPan = useCallback((sx: number, sy: number) => {
    gestureRef.current = "pan";
    panLast.current = { x: sx, y: sy };
  }, []);

  const updatePan = useCallback(
    (sx: number, sy: number) => {
      const camera = cameraRef.current;
      camera.x -= sx - panLast.current.x;
      camera.y -= sy - panLast.current.y;
      panLast.current = { x: sx, y: sy };
      scheduleRender();
    },
    [scheduleRender]
  );

  const endPan = useCallback(() => {
    gestureRef.current = null;
  }, []);

  // ------------------------------------------------------------------
  // Zoom. Zooming keeps the world point under the cursor fixed on screen:
  // the camera re-aims so screenX stays under the cursor before and after
  // the zoom scale changes. These callbacks mutate zoomRef and schedule a
  // render; the actual zoom state lives in page.tsx (via onZoomChange).
  // ------------------------------------------------------------------
  const setZoom = useCallback(
    (nextZoom: number) => {
      const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
      if (clamped === zoomRef.current) return;

      // Keep the viewport center's world point fixed while the scale changes.
      const canvas = canvasRef.current;
      if (canvas) {
        const sx = canvas.clientWidth / 2;
        const sy = canvas.clientHeight / 2;
        const before = screenToWorld(cameraRef.current, zoomRef.current, sx, sy);
        cameraRef.current.x = before.x - sx / clamped;
        cameraRef.current.y = before.y - sy / clamped;
      }

      zoomRef.current = clamped;
      onZoomChange(clamped);
      scheduleRender();
    },
    [onZoomChange, scheduleRender]
  );

  const zoomBy = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const current = zoomRef.current;
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current * factor));
      if (next === current) return;

      // Cursor (or viewport center) in screen px and world units.
      const sx = cx ?? canvas.clientWidth / 2;
      const sy = cy ?? canvas.clientHeight / 2;
      const before = screenToWorld(cameraRef.current, current, sx, sy);

      cameraRef.current.x = before.x - sx / next;
      cameraRef.current.y = before.y - sy / next;
      zoomRef.current = next;
      onZoomChange(next);
      scheduleRender();
    },
    [onZoomChange, scheduleRender]
  );

  const fitToScreen = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const shapes = shapesRef.current;
    if (shapes.length === 0) {
      cameraRef.current = { x: 0, y: 0 };
      zoomRef.current = 1;
      onZoomChange(1);
      scheduleRender();
      return;
    }

    // Bounding box of all shapes.
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const shape of shapes) {
      const b = getShapeBounds(shape);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    if (minX > maxX) {
      cameraRef.current = { x: 0, y: 0 };
      zoomRef.current = 1;
      onZoomChange(1);
      scheduleRender();
      return;
    }

    const padding = 60;
    const availW = Math.max(1, canvas.clientWidth - padding * 2);
    const availH = Math.max(1, canvas.clientHeight - padding * 2);
    const boundsW = Math.max(1, maxX - minX);
    const boundsH = Math.max(1, maxY - minY);
    const next = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, Math.min(availW / boundsW, availH / boundsH))
    );

    cameraRef.current.x = (minX + maxX) / 2 - canvas.clientWidth / (2 * next);
    cameraRef.current.y = (minY + maxY) / 2 - canvas.clientHeight / (2 * next);
    zoomRef.current = next;
    onZoomChange(next);
    scheduleRender();
  }, [onZoomChange, scheduleRender]);

  // ------------------------------------------------------------------
  // Eraser. Removes a single shape under the pointer on click (mouse down
  // only - never on move/drag). History is snapshotted BEFORE the removal so
  // undo restores the erased shape.
  // ------------------------------------------------------------------
  const eraseAt = useCallback(
    (point: { x: number; y: number }) => {
      const index = findShapeAt(point.x, point.y, ERASER_RADIUS);
      if (index === null) return;

      pushHistory();

      shapesRef.current.splice(index, 1);

      if (selectedShape.current === index) {
        selectedShape.current = null;
      } else if (selectedShape.current !== null && selectedShape.current > index) {
        selectedShape.current -= 1;
      }

      scheduleRender();
    },
    [findShapeAt, pushHistory, scheduleRender]
  );

  // ------------------------------------------------------------------
  // Gesture entry points, shared by mouse AND touch.
  // ------------------------------------------------------------------
  const beginGesture = useCallback(
    (clientX: number, clientY: number, forcePan: boolean) => {
      if (forcePan || spaceDown.current) {
        const s = screenPoint(clientX, clientY);
        beginPan(s.x, s.y);
        refreshCursor();
        return;
      }

      const w = worldPoint(clientX, clientY);
      const t = toolRef.current;

      if (t === "eraser") {
        eraseAt(w);
        return;
      }

      if (t === "select") {
        const sel = selectedShape.current;
        if (sel !== null) {
          const shape = shapesRef.current[sel];
          if (shape) {
            const s = screenPoint(clientX, clientY);
            const handle = hitTestResizeHandle(
              shape,
              cameraRef.current,
              zoomRef.current,
              s.x,
              s.y
            );
            if (handle) {
              beginResize(handle);
              refreshCursor();
              return;
            }
          }
        }

        const index = findShapeAt(w.x, w.y);
        if (index !== null) {
          beginDrag(index, w);
        } else {
          // Empty space: clear the selection and pan the camera.
          selectedShape.current = null;
          const s = screenPoint(clientX, clientY);
          beginPan(s.x, s.y);
        }
        refreshCursor();
        scheduleRender();
        return;
      }

      beginDraw(w);
    },
    [
      screenPoint,
      worldPoint,
      beginPan,
      beginDrag,
      beginDraw,
      beginResize,
      eraseAt,
      findShapeAt,
      refreshCursor,
      scheduleRender,
    ]
  );

  const updateGesture = useCallback(
    (clientX: number, clientY: number, shiftKey: boolean) => {
      const s = screenPoint(clientX, clientY);
      const w = worldPoint(clientX, clientY);

      switch (gestureRef.current) {
        case "pan":
          updatePan(s.x, s.y);
          break;
        case "drag":
          updateDrag(w);
          break;
        case "resize":
          updateResize(w, shiftKey);
          break;
        case "draw":
          updateDraw(w, shiftKey);
          break;
        default:
          break;
      }
    },
    [screenPoint, worldPoint, updatePan, updateDrag, updateResize, updateDraw]
  );

  const endGesture = useCallback(() => {
    switch (gestureRef.current) {
      case "draw":
        endDraw();
        break;
      case "drag":
        endDrag();
        break;
      case "resize":
        endResize();
        break;
      case "pan":
        endPan();
        break;
      default:
        break;
    }
    refreshCursor();
  }, [endDraw, endDrag, endResize, endPan, refreshCursor]);

  // ------------------------------------------------------------------
  // Touch: two-finger drag pans the camera (no zoom).
  // ------------------------------------------------------------------
  const startTouchPan = useCallback(
    (touches: React.TouchList) => {
      const a = screenPoint(touches[0].clientX, touches[0].clientY);
      const b = screenPoint(touches[1].clientX, touches[1].clientY);
      touchPanActive.current = true;
      beginPan((a.x + b.x) / 2, (a.y + b.y) / 2);
    },
    [screenPoint, beginPan]
  );

  const updateTouchPan = useCallback(
    (touches: React.TouchList) => {
      const a = screenPoint(touches[0].clientX, touches[0].clientY);
      const b = screenPoint(touches[1].clientX, touches[1].clientY);
      updatePan((a.x + b.x) / 2, (a.y + b.y) / 2);
    },
    [screenPoint, updatePan]
  );

  // ------------------------------------------------------------------
  // Mount: get the 2D context, size/redraw on window resize, and register
  // window-level listeners so gestures keep working when the pointer leaves
  // the canvas mid-drag. All mouse logic lives here - the canvas element
  // only reports enter/leave and the initial press.
  // ------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;

    // Keep the buffer + redraw whenever the canvas element resizes (window
    // resize, DPR change, zoom, ...). ResizeObserver fires after layout, so
    // it also covers the initial size reliably.
    const resizeObserver = new ResizeObserver(() => render());
    resizeObserver.observe(canvas);
    render();

    const onWindowMouseMove = (e: MouseEvent) => {
      if (mouseOverCanvas.current) {
        mousePos.current = screenPoint(e.clientX, e.clientY);

        refreshCursor(e.clientX, e.clientY);

        // Repaint so the canvas-drawn eraser cursor circle follows the
        // pointer. This is visual feedback only - the eraser itself only
        // removes shapes on mouse down, never on move.
        if (toolRef.current === "eraser") scheduleRender();
      }

      if (gestureRef.current) updateGesture(e.clientX, e.clientY, e.shiftKey);
    };

    const onWindowMouseUp = () => endGesture();

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.code === "Space") {
        if (!typing && !spaceDown.current) {
          spaceDown.current = true;
          e.preventDefault();
          refreshCursor();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Zoom shortcuts: Ctrl/Cmd +/- and Ctrl/Cmd+0 (fit to screen).
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          zoomBy(ZOOM_STEP);
          return;
        }
        if (e.key === "-") {
          e.preventDefault();
          zoomBy(1 / ZOOM_STEP);
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          fitToScreen();
          return;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && spaceDown.current) {
        spaceDown.current = false;
        e.preventDefault();
        refreshCursor();
      }
    };

    // Native (non-passive) wheel listener so preventDefault reliably blocks
    // page/browser zoom and scrolling. Trackpad pinch-to-zoom arrives as
    // ctrlKey + wheel, which gets a gentler factor so it doesn't jump.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.ctrlKey
        ? Math.exp(-e.deltaY * 0.01)
        : Math.pow(ZOOM_SCROLL_STEP, -e.deltaY / 100);
      zoomBy(factor, e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onWindowMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("wheel", onWheel);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [
    render,
    screenPoint,
    refreshCursor,
    scheduleRender,
    updateGesture,
    endGesture,
    handleUndo,
    handleRedo,
    zoomBy,
    fitToScreen,
  ]);

  // ------------------------------------------------------------------
  // Imperative API for the BottomBar.
  // ------------------------------------------------------------------
  useImperativeHandle(
    ref,
    () => ({
      undo: handleUndo,
      redo: handleRedo,
      setZoom,
      zoomBy,
      fitToScreen,
    }),
    [handleUndo, handleRedo, setZoom, zoomBy, fitToScreen]
  );

  // ------------------------------------------------------------------
  // Tool change: refresh the cursor immediately (so switching to the eraser
  // shows the drawn circle before moving).
  // ------------------------------------------------------------------
  useEffect(() => {
    refreshCursor();
    scheduleRender();
  }, [tool, refreshCursor, scheduleRender]);

  // ------------------------------------------------------------------
  // Canvas-level React handlers. Gesture continuation happens on the window.
  // ------------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Right-click does nothing. Middle-click forces pan.
    if (e.button === 2) return;
    if (e.button === 1) e.preventDefault();

    // Stop Space from "clicking" the last focused toolbar button.
    (document.activeElement as HTMLElement | null)?.blur();

    beginGesture(e.clientX, e.clientY, e.button === 1);
  };

  const handleMouseEnter = () => {
    mouseOverCanvas.current = true;
    scheduleRender();
  };

  const handleMouseLeave = () => {
    mouseOverCanvas.current = false;
    scheduleRender();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length >= 2) {
      endGesture();
      startTouchPan(e.touches);
      return;
    }
    if (e.touches.length === 1) {
      beginGesture(e.touches[0].clientX, e.touches[0].clientY, false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (touchPanActive.current) {
      if (e.touches.length >= 2) {
        updateTouchPan(e.touches);
      } else {
        endGesture();
        touchPanActive.current = false;
      }
      return;
    }
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      updateGesture(touch.clientX, touch.clientY, false);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (touchPanActive.current && e.touches.length < 2) {
      touchPanActive.current = false;
    }
    endGesture();
  };

  // Scroll wheel zoom is handled by a native listener in the mount effect
  // (see onWheel above) - not as a React prop, to avoid passive-listener
  // preventDefault issues.

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        display: "block",
        touchAction: "none",
      }}
    />
  );
}

export default memo(DrawCanvas);
