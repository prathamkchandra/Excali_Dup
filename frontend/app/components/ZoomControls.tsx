"use client";

import { ZoomIn, ZoomOut, Scan } from "lucide-react";

type ZoomControlsProps = {
  zoom: number;
  setZoom: (zoom: number) => void;
  zoomBy: (factor: number) => void;
  fitToScreen: () => void;
};

const iconButtonClass = [
  "flex h-8 w-8 items-center justify-center rounded-lg text-white/80",
  "transition-colors hover:bg-white/10 hover:text-white sm:h-9 sm:w-9",
].join(" ");

export default function ZoomControls({
  zoom,
  setZoom,
  zoomBy,
  fitToScreen,
}: ZoomControlsProps) {
  const display = `${Math.round(zoom * 100)}%`;

  return (
    <>
      <div
        className="mx-0.5 h-6 w-px bg-white/10 sm:mx-1"
        role="separator"
        aria-hidden="true"
      />

      <button
        className={iconButtonClass}
        onClick={() => zoomBy(1 / 1.25)}
        title="Zoom out (Ctrl+-)"
        aria-label="Zoom out"
      >
        <ZoomOut size={16} aria-hidden="true" />
      </button>

      <button
        className="h-8 min-w-12 rounded-lg px-1.5 text-xs font-medium tabular-nums text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:h-9 sm:min-w-14 sm:text-sm"
        onClick={() => setZoom(1)}
        title="Reset to 100% (Ctrl+0)"
        aria-label="Reset zoom"
      >
        {display}
      </button>

      <button
        className={iconButtonClass}
        onClick={() => zoomBy(1.25)}
        title="Zoom in (Ctrl++)"
        aria-label="Zoom in"
      >
        <ZoomIn size={16} aria-hidden="true" />
      </button>

      <button
        className={iconButtonClass}
        onClick={fitToScreen}
        title="Fit to screen"
        aria-label="Fit to screen"
      >
        <Scan size={16} aria-hidden="true" />
      </button>
    </>
  );
}
