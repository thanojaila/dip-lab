import type { Pixels } from './matIO';

/** Nearest-neighbour resample of RGBA pixels (used only to compare different-sized images). */
export function resizeNearest(p: Pixels, w: number, h: number): Pixels {
  if (p.w === w && p.h === h) return p;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(p.h - 1, Math.floor((y * p.h) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(p.w - 1, Math.floor((x * p.w) / w));
      const s = (sy * p.w + sx) * 4;
      const o = (y * w + x) * 4;
      out[o] = p.data[s];
      out[o + 1] = p.data[s + 1];
      out[o + 2] = p.data[s + 2];
      out[o + 3] = 255;
    }
  }
  return { w, h, data: out };
}

/** |a − b| per channel, multiplied by `gain`, opaque. `b` is nearest-resized to a's size when needed. */
export function diffPixels(a: Pixels, b: Pixels, gain = 1): Pixels {
  const bb = resizeNearest(b, a.w, a.h);
  const out = new Uint8ClampedArray(a.w * a.h * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = Math.abs(a.data[i] - bb.data[i]) * gain;
    out[i + 1] = Math.abs(a.data[i + 1] - bb.data[i + 1]) * gain;
    out[i + 2] = Math.abs(a.data[i + 2] - bb.data[i + 2]) * gain;
    out[i + 3] = 255;
  }
  return { w: a.w, h: a.h, data: out };
}

export type HistChannel = 'gray' | 'r' | 'g' | 'b';

/** 256-bin histogram of an RGBA image for the chosen channel (gray = rounded BT.601 luma). */
export function histogramFromPixels(p: Pixels, channel: HistChannel = 'gray'): Uint32Array {
  const h = new Uint32Array(256);
  const n = p.w * p.h;
  const off = channel === 'r' ? 0 : channel === 'g' ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const v = channel === 'gray' ? Math.round(0.299 * p.data[o] + 0.587 * p.data[o + 1] + 0.114 * p.data[o + 2]) : p.data[o + off];
    h[v]++;
  }
  return h;
}

/** True when R=G=B everywhere (so channel histograms are redundant). */
export function isGrayPixels(p: Pixels): boolean {
  for (let i = 0; i < p.w * p.h * 4; i += 4) if (p.data[i] !== p.data[i + 1] || p.data[i] !== p.data[i + 2]) return false;
  return true;
}
