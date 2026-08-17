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
  const [zoom, setZoom] =
    useState(1);

  // Imperative handle to the canvas, so the BottomBar buttons can trigger
  // undo/redo/zoom that live next to the shapes inside DrawCanvas.
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
        zoom={zoom}
        onZoomChange={setZoom}
      />

      <BottomBar
        zoom={zoom}
        onUndo={() => canvasApi.current?.undo()}
        onRedo={() => canvasApi.current?.redo()}
        setZoom={(z) => canvasApi.current?.setZoom(z)}
        zoomBy={(f) => canvasApi.current?.zoomBy(f)}
        fitToScreen={() => canvasApi.current?.fitToScreen()}
      />
    </>
  );
}
