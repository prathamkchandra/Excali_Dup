// Canvas expansion helpers.
//
// This module implements the "expandable canvas" approach: instead of a
// camera, the single HTML canvas element simply grows taller whenever the
// user draws near its bottom edge. Because the canvas is a normal block
// element in the document flow, the page becomes naturally scrollable as
// the canvas grows.

// How close (in CSS pixels) the mouse must be to the bottom edge before we
// expand the canvas.
export const EXPAND_MARGIN = 300;

// How many pixels we add to the canvas height on every expansion.
export const EXPAND_STEP = 1000;

// Synchronizes the canvas's pixel buffer with its CSS size.
//
// IMPORTANT: the buffer and the CSS box are two different things:
//   - canvas.width / canvas.height  = raw pixel buffer (multiplied by the
//     devicePixelRatio so lines render crisply on HiDPI screens)
//   - canvas.clientWidth/Height     = CSS size on screen
// Every drawing command runs in CSS pixels thanks to ctx.setTransform(dpr...).
//
// Setting canvas.width/height CLEARS the whole canvas, so we only write them
// when they actually changed, and callers must redraw immediately after.
export function syncBufferToCss(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
) {
  const dpr = window.devicePixelRatio || 1;
  const bufferWidth = Math.floor(canvas.clientWidth * dpr);
  const bufferHeight = Math.floor(canvas.clientHeight * dpr);

  if (canvas.width !== bufferWidth) {
    canvas.width = bufferWidth;
  }
  if (canvas.height !== bufferHeight) {
    canvas.height = bufferHeight;
  }

  // Any write to canvas.width/height resets the transform, so re-apply it
  // so drawing can keep using CSS pixel coordinates.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Checks whether the mouse is close to the bottom of the canvas and, if so,
// grows the canvas height by EXPAND_STEP.
//
// Responsibilities (as requested):
//   - Check whether expansion is needed (within EXPAND_MARGIN of the bottom).
//   - Increase the canvas height.
//   - Prevent repeated unnecessary expansion: after one growth step the
//     mouse is far from the new bottom edge, so the next mousemove will not
//     trigger another resize. It only expands again once the user actually
//     reaches the new bottom - one resize per threshold crossing.
//   - Redraw existing shapes (the height change clears the canvas, so the
//     caller's redraw callback is invoked).
//
// Returns true when an expansion + redraw happened, false otherwise.
export function expandCanvasIfNeeded(
  canvas: HTMLCanvasElement,
  heightRef: { current: number },
  mouseY: number,
  redraw: () => void
): boolean {
  const distanceToBottom = heightRef.current - mouseY;

  if (distanceToBottom <= EXPAND_MARGIN) {
    heightRef.current += EXPAND_STEP;
    // Growing the CSS box makes the page taller (scrollable) and makes the
    // next render's buffer sync pick up the new height.
    canvas.style.height = `${heightRef.current}px`;
    redraw();
    return true;
  }

  return false;
}
