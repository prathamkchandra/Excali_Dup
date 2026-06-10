"use client";

import { useState } from "react";
import Toolbar from "./components/Toolbar";
import DrawCanvas from "./components/DrawCanvas";
import { Tool } from "@/app/types/Tool";

export default function Home() {

  const [tool, setTool] =
    useState<Tool>("pencil");

  return (
    <>
      <Toolbar
        tool={tool}
        setTool={setTool}
      />

      <DrawCanvas
        tool={tool}
      />
    </>
  );
}