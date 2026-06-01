"use client";

import { useRef, useEffect } from "react";

function DrawCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;

    canvas.height = window.innerHeight;

    ctx.fillStyle = "white";

    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 3;

    ctx.lineCap = "round";

    ctx.strokeStyle = "black";
  }, []);

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawing.current = true;

    ctx.beginPath();

    ctx.moveTo(e.clientX, e.clientY);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
    if (!isDrawing.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(e.clientX, e.clientY);

    ctx.stroke();
  }

  function handleMouseUp() {
    isDrawing.current = false;
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

export default DrawCanvas;

