"use client";

import { useState } from "react";
import Toolbar from "./components/Toolbar";
import DrawCanvas from "./components/DrawCanvas";
import { tool } from "@/app/types/Tool";

export default function Home() {

  const [tool, setTool] =
    useState<tool>("pencil");

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