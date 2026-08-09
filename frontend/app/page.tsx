"use client";

import { useRef, useState } from "react";
import Toolbar from "./components/Toolbar";
import DrawCanvas from "./components/DrawCanvas";
import BottomBar from "./components/BottomBar";
import type { DrawCanvasHandle } from "./components/DrawCanvas";
import { Tool } from "@/app/types/Tool";

export default function Home() {
  const [tool, setTool] =
    useState<Tool>("pencil");

  // Imperative handle to the canvas, so the BottomBar buttons can trigger
  // undo/redo that live next to the shapes inside DrawCanvas.
  const canvasApi =
    useRef<DrawCanvasHandle>(null);

  return (
    <>
      <Toolbar
        tool={tool}
        setTool={setTool}
      />

      <DrawCanvas
        ref={canvasApi}
        tool={tool}
      />

      <BottomBar
        onUndo={() => canvasApi.current?.undo()}
        onRedo={() => canvasApi.current?.redo()}
      />
    </>
  );
}
