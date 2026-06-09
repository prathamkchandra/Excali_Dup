"use client";

import type { Dispatch, SetStateAction } from "react";
import { tool } from "@/app/types/Tool";

type ToolbarProps = {
  tool: tool;
  setTool: Dispatch<SetStateAction<tool>>;
};

export default function Toolbar({
  tool,
  setTool,
}: ToolbarProps) {

  const tools: tool[] = [
    "pencil",
    "rectangle",
    "square",
    "circle",
    "select",
    "eraser",
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "10px",
        padding: "10px",
        border: "1px solid gray",
        borderRadius: "10px",
        background: "red",
        zIndex: 1000,
      }}
    >
      {tools.map((item) => (
        <button
          key={item}
          onClick={() => setTool(item)}
          style={{
            fontWeight:
              tool === item
                ? "bold"
                : "normal",
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}