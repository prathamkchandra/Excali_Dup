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
import type { ResizeHandleId } from "@/app/utils/geometry";
import {
  translateShape,
  resizeShape,
  normalizeRect,
} from "@/app/utils/shapes";

// --------------------------------------------------------------------------
// Imperative API exposed to the parent so the BottomBar can trigger
// undo/redo. The history and camera live next to the shapes in refs inside
// this component, so they are surfaced as methods instead of props.
// --------------------------------------------------------------------------
export type DrawCanvasHandle = {
  undo: () => void;
  redo: () => void;
};

type DrawCanvasProps = {
  tool: Tool;
  ref?: Ref<DrawCanvasHandle>;
};

// The active gesture. Everything is pointer-coordinate driven; each gesture
// type mutates a different thing (a new shape, a dragged shape, a resized
// shape, or the camera itself).
type Gesture = "draw" | "drag" | "resize" | "pan" | null;

// Static cursor for a tool, before any hover/pan overrides:
//   - pencil: a custom pencil SVG, hotspot at the tip (3, 28)
//   - eraser: the OS cursor is hidden; a circle is drawn on the canvas instead
//   - select: default arrow
//   - shapes (rectangle/square/circle): crosshair
function baseCursorForTool(t: Tool): string {
  switch (t) {
    case "pencil":
      return "url('/cursors/pencil.svg') 3 28, auto";
    case "eraser":
      return "none";
    case "select":
      return "default";
    default:
      return "crosshair";
  }
}

function DrawCanvas({
  tool,
  ref,
}: DrawCanvasProps) {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const ctxRef =
    useRef<CanvasRenderingContext2D | null>(null);

  const shapesRef =
    useRef<Shape[]>([]);

  const currentShape =
    useRef<Shape | null>(null);

  const selectedShape =
    useRef<number | null>(null);

  // ------------------------------------------------------------------
  // Camera (infinite pan only - no zoom).
  //
  // Shapes live in an infinite WORLD plane; this object maps that plane onto
  // the viewport by pure translation:
  //
  //   screenX = worldX - camera.x
  //   screenY = worldY - camera.y
  //
  // It is a ref (never React state) so pan floods mutate it without
  // triggering re-renders - the rAF-driven draw loop picks up the new values
  // every frame.
  // ------------------------------------------------------------------
  const cameraRef =
    useRef<Camera>({ x: 0, y: 0 });

  // ------------------------------------------------------------------
  // Undo / Redo history (deep copies via JSON round-trip, same as before).
  // ------------------------------------------------------------------
  const history =
    useRef<Shape[][]>([]);

  const redoStack =
    useRef<Shape[][]>([]);

  // ------------------------------------------------------------------
  // Render scheduling (rAF-coalesced, as before).
  // ------------------------------------------------------------------
  const needsRender =
    useRef(false);

  const rafId =
    useRef<number | null>(null);

  // The eraser cursor is drawn on the canvas (the OS cursor is hidden for
  // that tool), so the render loop needs the pointer's SCREEN position and
  // whether it is currently over the canvas.
  const mousePos =
    useRef({ x: 0, y: 0 });

  const mouseOverCanvas =
    useRef(false);

  const render = useCallback(() => {
    needsRender.current = false;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    // Size the pixel buffer to the CSS box * dpr. This leaves the transform
    // in "screen space"; nothing in the render loop changes it (no zoom), so
    // every shape below is drawn with the camera offset applied manually.
    syncBufferToCss(canvas);

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const camera = cameraRef.current;

    fillBackground(ctx, width, height);
    drawGrid(ctx, camera, width, height);

    // While drawing, the in-progress shape is shown on top of everything.
    const allShapes = currentShape.current
      ? [...shapesRef.current, currentShape.current]
      : shapesRef.current;
    drawShapes(ctx, allShapes, camera, selectedShape.current);

    if (selectedShape.current !== null) {
      const shape = shapesRef.current[selectedShape.current];
      if (shape) drawSelection(ctx, camera, shape);
    }

    // The eraser cursor is visual feedback only and is drawn last, on top of
    // everything. It never touches the shapes array - real erasing happens in
    // eraseAt() on mousedown.
    if (
      mouseOverCanvas.current &&
      mousePos.current.x > 0
    ) {
      drawEraserCursor(
        ctx,
        mousePos.current.x,
        mousePos.current.y
      );
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

  // The current tool is mirrored in a ref so the registered handlers always
  // see the latest value without needing to be re-registered.
  const toolRef =
    useRef<Tool>(tool);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // ------------------------------------------------------------------
  // Undo / Redo
  // ------------------------------------------------------------------
  const commitHistory = useCallback(() => {
    history.current.push(
      JSON.parse(JSON.stringify(shapesRef.current))
    );
    redoStack.current = [];
  }, []);

  const handleUndo = useCallback(() => {
    if (history.current.length === 0) return;

    redoStack.current.push(
      JSON.parse(JSON.stringify(shapesRef.current))
    );

    shapesRef.current =
      history.current.pop() || [];
    render();
  }, [render]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;

    history.current.push(
      JSON.parse(JSON.stringify(shapesRef.current))
    );

    shapesRef.current =
      redoStack.current.pop() || [];
    render();
  }, [render]);

  // ------------------------------------------------------------------
  // Gesture state
  // ------------------------------------------------------------------
  const gestureRef =
    useRef<Gesture>(null);

  const spaceDown =
    useRef(false);

  const dragOffset =
    useRef({ x: 0, y: 0 });

  const dragMoved =
    useRef(false);

  const resizeHandle =
    useRef<ResizeHandleId>("br");

  const resizeStart =
    useRef<string>("");

  const resizeChanged =
    useRef(false);

  const panLast =
    useRef({ x: 0, y: 0 });

  // True while a two-finger touch gesture is panning the camera.
  const touchPanActive =
    useRef(false);

  // ------------------------------------------------------------------
  // Coordinate helpers (screen <-> world).
  // ------------------------------------------------------------------
  const screenPoint = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  const worldPoint = useCallback(
    (clientX: number, clientY: number) => {
      const s = screenPoint(clientX, clientY);
      return screenToWorld(cameraRef.current, s.x, s.y);
    },
    [screenPoint]
  );

  const findShapeAt = useCallback(
    (x: number, y: number): number | null => {
      for (
        let i = shapesRef.current.length - 1;
        i >= 0;
        i--
      ) {
        if (shapeContainsPoint(shapesRef.current[i], x, y)) {
          return i;
        }
      }
      return null;
    },
    []
  );

  // ------------------------------------------------------------------
  // Cursor handling (mutates canvas.style.cursor - no React re-renders).
  // Space/pan overrides grab/grabbing; everything else uses the tool's
  // static cursor (custom pencil SVG, hidden eraser cursor, etc.).
  // ------------------------------------------------------------------
  const refreshCursor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.cursor =
      spaceDown.current || gestureRef.current === "pan"
        ? gestureRef.current === "pan"
          ? "grabbing"
          : "grab"
        : baseCursorForTool(toolRef.current);
  }, []);

  const updateCursor = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (
        spaceDown.current ||
        gestureRef.current === "pan"
      ) {
        canvas.style.cursor =
          gestureRef.current === "pan"
            ? "grabbing"
            : "grab";
        return;
      }

      const t = toolRef.current;

      if (t === "select") {
        if (selectedShape.current !== null) {
          const shape =
            shapesRef.current[selectedShape.current];
          if (shape) {
            const s = screenPoint(clientX, clientY);
            const handle = hitTestResizeHandle(
              shape,
              cameraRef.current,
              s.x,
              s.y
            );
            if (handle) {
              canvas.style.cursor = resizeCursor(handle);
              return;
            }
          }
          canvas.style.cursor = "grab";
          return;
        }

        const w = worldPoint(clientX, clientY);
        canvas.style.cursor =
          findShapeAt(w.x, w.y) !== null ? "grab" : "default";
        return;
      }

      canvas.style.cursor = baseCursorForTool(t);
    },
    [screenPoint, worldPoint, findShapeAt]
  );

  // ------------------------------------------------------------------
  // Tool change: refresh the cursor immediately (so switching to the eraser
  // hides the OS cursor / shows the drawn circle even before the mouse
  // moves) and repaint once.
  // ------------------------------------------------------------------
  useEffect(() => {
    refreshCursor();
    scheduleRender();
  }, [tool, refreshCursor, scheduleRender]);

  // ------------------------------------------------------------------
  // Gesture implementations
  // ------------------------------------------------------------------
  const beginDraw = useCallback(
    (point: { x: number; y: number }) => {
      const t = toolRef.current;

      if (t === "pencil") {
        currentShape.current = {
          type: "pencil",
          points: [{ x: point.x, y: point.y }],
        };
      } else if (t === "rectangle") {
        currentShape.current = {
          type: "rectangle",
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
        };
      } else if (t === "square") {
        currentShape.current = {
          type: "square",
          x: point.x,
          y: point.y,
          size: 0,
        };
      } else if (t === "circle") {
        currentShape.current = {
          type: "circle",
          x: point.x,
          y: point.y,
          radius: 0,
        };
      } else {
        return;
      }

      selectedShape.current = null;
      gestureRef.current = "draw";
      scheduleRender();
    },
    [scheduleRender]
  );

  const updateDraw = useCallback(
    (point: { x: number; y: number }) => {
      const shape = currentShape.current;
      if (!shape) return;

      if (shape.type === "pencil") {
        shape.points.push({ x: point.x, y: point.y });
      } else if (shape.type === "rectangle") {
        shape.width = point.x - shape.x;
        shape.height = point.y - shape.y;
      } else if (shape.type === "square") {
        shape.size = Math.max(
          Math.abs(point.x - shape.x),
          Math.abs(point.y - shape.y)
        );
      } else if (shape.type === "circle") {
        shape.radius = Math.hypot(
          point.x - shape.x,
          point.y - shape.y
        );
      }

      scheduleRender();
    },
    [scheduleRender]
  );

  const endDraw = useCallback(() => {
    const shape = currentShape.current;
    if (shape) {
      // Rectangles may have negative width/height from dragging up/left;
      // normalize so the stored shape always has a top-left origin.
      if (shape.type === "rectangle") normalizeRect(shape);
      shapesRef.current.push(shape);
      currentShape.current = null;
      commitHistory();
    }
    gestureRef.current = null;
    scheduleRender();
  }, [commitHistory, scheduleRender]);

  const beginDrag = useCallback(
    (index: number, point: { x: number; y: number }) => {
      selectedShape.current = index;

      const shape = shapesRef.current[index];
      const anchor =
        shape.type === "pencil"
          ? shape.points[0]
          : { x: shape.x, y: shape.y };

      dragOffset.current = {
        x: point.x - anchor.x,
        y: point.y - anchor.y,
      };
      dragMoved.current = false;
      gestureRef.current = "drag";
      scheduleRender();
    },
    [scheduleRender]
  );

  const updateDrag = useCallback(
    (point: { x: number; y: number }) => {
      if (selectedShape.current === null) return;
      const shape = shapesRef.current[selectedShape.current];
      if (!shape) return;

      const anchor =
        shape.type === "pencil"
          ? shape.points[0]
          : { x: shape.x, y: shape.y };

      const targetX = point.x - dragOffset.current.x;
      const targetY = point.y - dragOffset.current.y;
      const dx = targetX - anchor.x;
      const dy = targetY - anchor.y;

      if (dx !== 0 || dy !== 0) {
        translateShape(shape, dx, dy);
        dragMoved.current = true;
      }

      scheduleRender();
    },
    [scheduleRender]
  );

  const endDrag = useCallback(() => {
    if (dragMoved.current) commitHistory();
    dragMoved.current = false;
    gestureRef.current = null;
    scheduleRender();
  }, [commitHistory, scheduleRender]);

  const beginResize = useCallback(
    (handle: ResizeHandleId) => {
      if (selectedShape.current === null) return;
      const shape = shapesRef.current[selectedShape.current];
      if (!shape) return;

      resizeHandle.current = handle;
      resizeStart.current = JSON.stringify(shape);
      resizeChanged.current = false;
      gestureRef.current = "resize";
    },
    []
  );

  const updateResize = useCallback(
    (point: { x: number; y: number }) => {
      if (selectedShape.current === null) return;
      const shape = shapesRef.current[selectedShape.current];
      if (!shape) return;

      resizeShape(shape, resizeHandle.current, point);
      if (JSON.stringify(shape) !== resizeStart.current) {
        resizeChanged.current = true;
      }

      scheduleRender();
    },
    [scheduleRender]
  );

  const endResize = useCallback(() => {
    if (resizeChanged.current) commitHistory();
    resizeChanged.current = false;
    gestureRef.current = null;
    scheduleRender();
  }, [commitHistory, scheduleRender]);

  const beginPan = useCallback(
    (sx: number, sy: number) => {
      gestureRef.current = "pan";
      panLast.current = { x: sx, y: sy };
    },
    []
  );

  const updatePan = useCallback(
    (sx: number, sy: number) => {
      const camera = cameraRef.current;
      const dx = sx - panLast.current.x;
      const dy = sy - panLast.current.y;
      camera.x -= dx;
      camera.y -= dy;
      panLast.current = { x: sx, y: sy };
      scheduleRender();
    },
    [scheduleRender]
  );

  const endPan = useCallback(() => {
    gestureRef.current = null;
  }, []);

  const eraseAt = useCallback(
    (point: { x: number; y: number }) => {
      const index = findShapeAt(point.x, point.y);
      if (index === null) return;

      shapesRef.current.splice(index, 1);

      // Keep selection pointing at the right shape after the splice.
      if (selectedShape.current === index) {
        selectedShape.current = null;
      } else if (
        selectedShape.current !== null &&
        selectedShape.current > index
      ) {
        selectedShape.current -= 1;
      }

      commitHistory();
      scheduleRender();
    },
    [findShapeAt, commitHistory, scheduleRender]
  );

  // ------------------------------------------------------------------
  // Public gesture entry points (shared by mouse AND touch).
  // ------------------------------------------------------------------
  const beginGesture = useCallback(
    (clientX: number, clientY: number, forcePan: boolean) => {
      if (forcePan || spaceDown.current) {
        const s = screenPoint(clientX, clientY);
        beginPan(s.x, s.y);
        return;
      }

      const w = worldPoint(clientX, clientY);

      if (toolRef.current === "eraser") {
        eraseAt(w);
        return;
      }

      if (toolRef.current === "select") {
        const sel = selectedShape.current;
        if (sel !== null) {
          const shape = shapesRef.current[sel];
          if (shape) {
            const s = screenPoint(clientX, clientY);
            const handle = hitTestResizeHandle(
              shape,
              cameraRef.current,
              s.x,
              s.y
            );
            if (handle) {
              beginResize(handle);
              scheduleRender();
              return;
            }
          }
        }

        const index = findShapeAt(w.x, w.y);
        if (index !== null) {
          beginDrag(index, w);
        } else {
          selectedShape.current = null;
          scheduleRender();
        }
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
      scheduleRender,
    ]
  );

  const updateGesture = useCallback(
    (clientX: number, clientY: number) => {
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
          updateResize(w);
          break;
        case "draw":
          updateDraw(w);
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
  }, [endDraw, endDrag, endResize, endPan]);

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
  // Mount: set up context, viewport sizing, and native listeners.
  // ------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;

    const resizeCanvas = () => {
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      render();
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Window-level move/up so dragging keeps working when the pointer leaves
    // the canvas mid-gesture.
    const onWindowMouseMove = (e: MouseEvent) => {
      if (gestureRef.current) updateGesture(e.clientX, e.clientY);
    };
    const onWindowMouseUp = () => endGesture();
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);

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
          canvas.style.cursor = "grab";
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
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && spaceDown.current) {
        spaceDown.current = false;
        e.preventDefault();
        refreshCursor();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    refreshCursor();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onWindowMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [render, updateGesture, endGesture, handleUndo, handleRedo, refreshCursor]);

  // ------------------------------------------------------------------
  // Imperative API
  // ------------------------------------------------------------------
  useImperativeHandle(ref, () => ({
    undo: handleUndo,
    redo: handleRedo,
  }), [handleUndo, handleRedo]);

  // ------------------------------------------------------------------
  // React event handlers (canvas-level)
  // ------------------------------------------------------------------
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Right-click does nothing. Middle-click forces pan.
      if (e.button === 2) return;
      if (e.button === 1) e.preventDefault();

      // Make sure Space is not "clicking" the last focused toolbar button.
      (document.activeElement as HTMLElement | null)?.blur();

      beginGesture(e.clientX, e.clientY, e.button === 1);
    },
    [beginGesture]
  );

  // Tracks the pointer so the canvas-drawn eraser cursor can follow it, then
  // repaints. The eraser circle only repaints while the mouse is actually
  // moving over the canvas - it is idle otherwise.
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      mousePos.current = screenPoint(e.clientX, e.clientY);
      updateCursor(e.clientX, e.clientY);
      if (toolRef.current === "eraser") scheduleRender();
    },
    [screenPoint, updateCursor, scheduleRender]
  );

  const handleCanvasMouseEnter = useCallback(() => {
    mouseOverCanvas.current = true;
    scheduleRender();
  }, [scheduleRender]);

  const handleCanvasMouseLeave = useCallback(() => {
    mouseOverCanvas.current = false;
    scheduleRender();
  }, [scheduleRender]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.touches.length >= 2) {
        endGesture();
        startTouchPan(e.touches);
        return;
      }
      if (e.touches.length === 1) {
        beginGesture(e.touches[0].clientX, e.touches[0].clientY, false);
      }
    },
    [beginGesture, endGesture, startTouchPan]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (touchPanActive.current) {
        if (e.touches.length >= 2) {
          updateTouchPan(e.touches);
        } else {
          // Lifting one finger ends the pan instead of jumping the camera.
          endGesture();
          touchPanActive.current = false;
        }
        return;
      }
      if (e.touches.length === 1) {
        updateGesture(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [touchPanActive, updateTouchPan, endGesture, updateGesture]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (touchPanActive.current && e.touches.length < 2) {
        touchPanActive.current = false;
      }
      endGesture();
    },
    [touchPanActive, endGesture]
  );

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseEnter={handleCanvasMouseEnter}
      onMouseLeave={handleCanvasMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        inset: 0,
        display: "block",
        touchAction: "none",
      }}
    />
  );
}

export default memo(DrawCanvas);
