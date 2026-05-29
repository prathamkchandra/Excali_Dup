"use client";

import React, { useRef, useEffect } from "react";

type Props = {
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  className?: string;
};

export default function DrawCanvas({
  width = 800,
  height = 400,
  strokeColor = "#000",
  strokeWidth = 2,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [width, height]);

  function getPos(e: PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function pointerDown(e: PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPos.current = getPos(e);
  }

  function pointerMove(e: PointerEvent) {
    if (!drawing.current || !lastPos.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = getPos(e);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPos.current = p;
  }

  function pointerUp(e: PointerEvent) {
    drawing.current = false;
    lastPos.current = null;
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
  }

  useEffect(() => {
    const c = canvasRef.current!;
    c.addEventListener("pointerdown", pointerDown);
    c.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);
    c.addEventListener("pointercancel", pointerUp);
    return () => {
      c.removeEventListener("pointerdown", pointerDown);
      c.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      c.removeEventListener("pointercancel", pointerUp);
    };
  }, [strokeColor, strokeWidth]);

  function clearCanvas() {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
  }

  function saveImage() {
    const data = canvasRef.current!.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = data;
    a.download = "drawing.png";
    a.click();
  }

  return (
    <div className={className}>
      <canvas ref={canvasRef} />
      <div style={{ marginTop: 8 }}>
        <button onClick={clearCanvas} style={{ marginRight: 8 }}>
          Clear
        </button>
        <button onClick={saveImage}>Save PNG</button>
      </div>
    </div>
  );
}