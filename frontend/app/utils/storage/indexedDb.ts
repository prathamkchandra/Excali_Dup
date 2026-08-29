import Dexie, { type EntityTable } from "dexie";
import type { Drawing } from "@/app/types/Drawing";

const DB_NAME = "CanvasForgeDB";
const DB_VERSION = 1;

class CanvasForgeDatabase extends Dexie {
  drawings!: EntityTable<Drawing, "id">;

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({
      drawings: "id, name, createdAt, updatedAt",
    });
  }
}

let dbInstance: CanvasForgeDatabase | null = null;

function getDb(): CanvasForgeDatabase {
  if (!dbInstance) {
    dbInstance = new CanvasForgeDatabase();
  }
  return dbInstance;
}

export async function addDrawing(drawing: Drawing): Promise<string> {
  const db = getDb();
  await db.drawings.add(drawing);
  return drawing.id;
}

export async function getDrawingFromDb(id: string): Promise<Drawing | undefined> {
  const db = getDb();
  return db.drawings.get(id);
}

export async function getAllDrawingsFromDb(): Promise<Drawing[]> {
  const db = getDb();
  return db.drawings.toArray();
}

export async function updateDrawingInDb(drawing: Drawing): Promise<void> {
  const db = getDb();
  await db.drawings.put(drawing);
}

export async function deleteDrawingFromDb(id: string): Promise<void> {
  const db = getDb();
  await db.drawings.delete(id);
}
