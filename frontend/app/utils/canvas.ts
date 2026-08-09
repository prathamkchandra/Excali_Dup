// Canvas buffer helpers.
//
// The old "expandable canvas" system is gone. The canvas is now fixed to the
// viewport (it never grows) and infinite panniness comes from the camera in
// utils/camera.ts instead. This module only keeps the raw pixel buffer in
// sync with the element's CSS size and the device pixel ratio.

// Synchronizes the canvas's pixel buffer with its CSS size.
//
// IMPORTANT: the buffer and the CSS box are two different things:
//   - canvas.width / canvas.height  = raw pixel buffer (multiplied by the
//     devicePixelRatio so lines render crisply on HiDPI screens)
//   - canvas.clientWidth/Height     = CSS size on screen
//
// Setting canvas.width/height CLEARS the whole canvas, so we only write them
// when they actually changed, and callers must redraw immediately after.
//
// After this call the transform is reset to the dpr-only "screen space".
// The renderer then applies the camera transform on top of it to draw in
// world space.
export function syncBufferToCss(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const bufferWidth = Math.floor(canvas.clientWidth * dpr);
  const bufferHeight = Math.floor(canvas.clientHeight * dpr);

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
