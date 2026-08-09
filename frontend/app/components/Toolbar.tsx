"use client";

import type { Dispatch, SetStateAction } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Pencil,
  RectangleHorizontal,
  Square,
  Circle,
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
  { id: "eraser", icon: Eraser, label: "Eraser" },
];

export default function Toolbar({
  tool,
  setTool,
}: ToolbarProps) {
  return (
    <div
      className="fixed top-3 left-1/2 z-50 flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-[#1e1e1e]/95 p-1.5 shadow-lg backdrop-blur sm:top-4"
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
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors sm:h-10 sm:w-10",
              active
                ? "bg-amber-400 text-black"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            <Icon
              size={18}
              strokeWidth={2}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
