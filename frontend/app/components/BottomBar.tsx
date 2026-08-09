"use client";

import { Undo2, Redo2 } from "lucide-react";

type BottomBarProps = {
  onUndo: () => void;
  onRedo: () => void;
};

const iconButtonClass = [
  "flex h-8 w-8 items-center justify-center rounded-lg text-white/80",
  "transition-colors hover:bg-white/10 hover:text-white sm:h-9 sm:w-9",
].join(" ");

export default function BottomBar({
  onUndo,
  onRedo,
}: BottomBarProps) {
  return (
    <div
      className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-white/10 bg-[#1e1e1e]/95 p-1 shadow-lg backdrop-blur sm:bottom-5 sm:gap-1 sm:p-1.5"
      role="toolbar"
      aria-label="Canvas controls"
    >
      <button
        className={iconButtonClass}
        onClick={onUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <Undo2 size={16} aria-hidden="true" />
      </button>

      <button
        className={iconButtonClass}
        onClick={onRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        <Redo2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
