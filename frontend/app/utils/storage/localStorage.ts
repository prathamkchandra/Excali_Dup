const ACTIVE_DRAWING_ID_KEY = "canvasforge:activeDrawingId";

export function setActiveDrawingId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_DRAWING_ID_KEY, id);
  } catch {
    console.warn("Failed to save active drawing ID to localStorage");
  }
}

export function getActiveDrawingId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_DRAWING_ID_KEY);
  } catch {
    return null;
  }
}

export function clearActiveDrawingId(): void {
  try {
    localStorage.removeItem(ACTIVE_DRAWING_ID_KEY);
  } catch {
    console.warn("Failed to clear active drawing ID from localStorage");
  }
}
