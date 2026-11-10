import type { Pixels } from '../../core/matIO';

/** Paint RGBA pixels into a canvas (resizing the canvas to the image size). */
export function drawPixels(canvas: HTMLCanvasElement, px: Pixels | null): void {
  if (!px) {
    canvas.width = 1;
    canvas.height = 1;
    canvas.getContext('2d')?.clearRect(0, 0, 1, 1);
    return;
  }
  if (canvas.width !== px.w || canvas.height !== px.h) {
    canvas.width = px.w;
    canvas.height = px.h;
  }
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.w, px.h), 0, 0);
}

/** Pointer position as 0..1 inside an `object-fit: contain` image of the given size, or null if in the letterbox. */
export function uvInContain(e: { clientX: number; clientY: number }, el: Element, imgW: number, imgH: number): { u: number; v: number } | null {
  const r = el.getBoundingClientRect();
  const a = imgW / imgH;
  const cw = Math.min(r.width, r.height * a);
  const ch = cw / a;
  const left = r.left + (r.width - cw) / 2;
  const top = r.top + (r.height - ch) / 2;
  const u = (e.clientX - left) / cw;
  const v = (e.clientY - top) / ch;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { u, v };
}
