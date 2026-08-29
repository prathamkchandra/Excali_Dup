"use client";

import type { Dispatch, SetStateAction } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Pencil,
  RectangleHorizontal,
  Square,
  Circle,
  Minus,
  ArrowRight,
  MousePointer2,
  Eraser,
} from "lucide-react";
import { Tool } from "@/app/types/Tool";

type ToolbarProps = {
  tool: Tool;
  setTool: Dispatch<SetStateAction<Tool>>;
};

type ToolEntry = {
  id: Tool;
  icon: LucideIcon;
  label: string;
};

const TOOLS: ToolEntry[] = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "pencil", icon: Pencil, label: "Pencil" },
  { id: "rectangle", icon: RectangleHorizontal, label: "Rectangle" },
  { id: "square", icon: Square, label: "Square" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "line", icon: Minus, label: "Line" },
  { id: "arrow", icon: ArrowRight, label: "Arrow" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
];

export default function Toolbar({
  tool,
  setTool,
}: ToolbarProps) {
  return (
    <div
      className="fixed left-1/2 z-50 flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-1.5 overflow-x-auto overscroll-contain rounded-2xl border border-white/10 bg-[#1e1e1e]/95 p-2 shadow-xl backdrop-blur sm:top-6 sm:gap-2.5 sm:rounded-2xl sm:border sm:p-2.5 md:top-6"
      style={{
        top: "calc(12px + var(--safe-top, 0px))",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
      }}
      role="toolbar"
      aria-label="Drawing tools"
    >
      {TOOLS.map(({ id, icon: Icon, label }) => {
        const active = tool === id;
        return (
          <button
            key={id}
            onClick={() => setTool(id)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-11 sm:w-11 md:h-12 md:w-12",
              active
                ? "bg-amber-400 text-black shadow-md"
                : "text-white/80 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            <Icon
              size={20}
              strokeWidth={2}
              aria-hidden="true"
              className="sm:w-[22px] sm:h-[22px]"
            />
          </button>
        );
      })}
    </div>
  );
}
