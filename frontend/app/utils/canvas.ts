// Canvas buffer helpers.
//
// The canvas is a fixed full-viewport element; infinite panniness comes from
// the camera in utils/camera.ts. This module keeps the raw pixel buffer in
// sync with the element's CSS size and the device pixel ratio.

// Synchronizes the canvas pixel buffer with its on-screen CSS size.
//
// IMPORTANT: the buffer and the CSS box are two different things:
//   - canvas.width / canvas.height  = raw pixel buffer (multiplied by the
//     devicePixelRatio so lines render crisply on HiDPI screens)
//   - the CSS box = element size on screen (canvas.clientWidth/Height)
//
// Setting canvas.width/height CLEARS the whole canvas, so they are only
// written when they actually changed, and callers must redraw immediately
// after. After this call the transform is reset to the dpr-only "screen
// space" that the render loop uses as its base.
export function syncCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Fall back to the viewport so a canvas that has not been laid out yet
  // still gets a real (full-screen) buffer instead of 0x0.
  const cssWidth = rect.width || window.innerWidth;
  const cssHeight = rect.height || window.innerHeight;

  const bufferWidth = Math.floor(cssWidth * dpr);
  const bufferHeight = Math.floor(cssHeight * dpr);

  if (canvas.width !== bufferWidth) {
    canvas.width = bufferWidth;
  }
  if (canvas.height !== bufferHeight) {
    canvas.height = bufferHeight;
  }

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}
