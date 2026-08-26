import type { Drawing } from "@/app/types/Drawing";
import type { Shape } from "@/app/types/Shape";
import type { Camera } from "@/app/utils/camera";
import {
  addDrawing,
  getDrawingFromDb,
  getAllDrawingsFromDb,
  updateDrawingInDb,
  deleteDrawingFromDb,
} from "./indexedDb";
import {
  setActiveDrawingId as persistActiveDrawingId,
  getActiveDrawingId as loadActiveDrawingId,
  clearActiveDrawingId,
} from "./localStorage";

function generateId(): string {
  return `drawing-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function createDrawing(
  name = "Untitled"
): Promise<Drawing> {
  const now = Date.now();
  const drawing: Drawing = {
    id: generateId(),
    name,
    shapes: [],
    camera: { x: 0, y: 0 },
    zoom: 1,
    createdAt: now,
    updatedAt: now,
  };
  await addDrawing(drawing);
  persistActiveDrawingId(drawing.id);
  return drawing;
}

export async function getDrawing(id: string): Promise<Drawing | undefined> {
  return getDrawingFromDb(id);
}

export async function getAllDrawings(): Promise<Drawing[]> {
  return getAllDrawingsFromDb();
}

export async function saveDrawing(drawing: Drawing): Promise<void> {
  try {
    await updateDrawingInDb(drawing);
  } catch (error) {
    console.error("Failed to save drawing", error);
  }
}

export async function updateDrawing(
  id: string,
  updates: {
    name?: string;
    shapes?: Shape[];
    camera?: Camera;
    zoom?: number;
  }
): Promise<void> {
  const drawing = await getDrawingFromDb(id);
  if (!drawing) return;

  const updated: Drawing = {
    ...drawing,
    ...updates,
    updatedAt: Date.now(),
  };
  await saveDrawing(updated);
}

export async function deleteDrawing(id: string): Promise<void> {
  try {
    await deleteDrawingFromDb(id);
    const activeId = loadActiveDrawingId();
    if (activeId === id) {
      clearActiveDrawingId();
    }
  } catch (error) {
    console.error("Failed to delete drawing", error);
  }
}

export async function renameDrawing(
  id: string,
  name: string
): Promise<void> {
  await updateDrawing(id, { name });
}

export async function loadOrCreateActiveDrawing(): Promise<Drawing> {
  const activeId = loadActiveDrawingId();

  if (activeId) {
    const existing = await getDrawingFromDb(activeId);
    if (existing) return existing;
  }

  const drawing = await createDrawing();
  persistActiveDrawingId(drawing.id);
  return drawing;
}

export function setActiveDrawing(id: string): void {
  persistActiveDrawingId(id);
}

export { loadActiveDrawingId, clearActiveDrawingId };
