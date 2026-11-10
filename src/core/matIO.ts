import type { Cv, Mat } from './types';

/** Plain pixel container: no cv.Mat held between runs (NFR-04). */
export interface Pixels {
  w: number;
  h: number;
  /** RGBA, length w*h*4 */
  data: Uint8ClampedArray;
}

export function pixelsToMat(cv: Cv, p: Pixels): Mat {
  const m = new cv.Mat(p.h, p.w, cv.CV_8UC4);
  m.data.set(p.data);
  return m;
}

/** Any 8U Mat (1, 3 or 4 channels) -> RGBA pixels. Does not delete `m`. */
export function matToPixels(cv: Cv, m: Mat): Pixels {
  const rgba = new cv.Mat();
  try {
    const ch = m.channels();
    if (ch === 1) cv.cvtColor(m, rgba, cv.COLOR_GRAY2RGBA);
    else if (ch === 3) cv.cvtColor(m, rgba, cv.COLOR_RGB2RGBA);
    else m.copyTo(rgba);
    return { w: rgba.cols, h: rgba.rows, data: new Uint8ClampedArray(rgba.data) };
  } finally {
    rgba.delete();
  }
}

/** Run `fn`, then delete every Mat it registered, even on throw. */
export function withMats<T>(fn: (track: <M extends { delete(): void }>(m: M) => M) => T): T {
  const owned: { delete(): void }[] = [];
  try {
    return fn((m) => {
      owned.push(m);
      return m;
    });
  } finally {
    for (const m of owned) {
      try {
        m.delete();
      } catch {
        /* already deleted */
      }
    }
  }
}

/** Prepare the run input from RGBA: gray (BT.601 weights via OpenCV) or RGB. Caller deletes. */
export function prepareInput(cv: Cv, rgba: Mat, gray: boolean): Mat {
  const out = new cv.Mat();
  cv.cvtColor(rgba, out, gray ? cv.COLOR_RGBA2GRAY : cv.COLOR_RGBA2RGB);
  return out;
}

export function pixelsLuma(p: Pixels): Uint8Array {
  const n = p.w * p.h;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    out[i] = Math.round(0.299 * p.data[o] + 0.587 * p.data[o + 1] + 0.114 * p.data[o + 2]);
  }
  return out;
}
