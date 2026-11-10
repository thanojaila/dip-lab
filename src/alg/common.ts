import type { Cv, Mat, Params, RunContext } from '../core/types';

export const num = (p: Params, k: string): number => Number(p[k]);
export const str = (p: Params, k: string): string => String(p[k]);
export const bool = (p: Params, k: string): boolean => p[k] === true;

/** Force a positive odd integer (kernel sizes). */
export function odd(n: number): number {
  const r = Math.max(1, Math.round(n));
  return r % 2 === 1 ? r : r + 1;
}

export const domainOf = (m: Mat): string => (m.channels() === 1 ? 'uint8 gray' : 'uint8 RGB');

/** Build a 1×256 lookup table and apply it. Works on 1- and 3-channel 8U. Caller deletes result. */
export function applyLut(cv: Cv, src: Mat, fn: (r: number) => number): Mat {
  const table = new Uint8Array(256);
  for (let r = 0; r < 256; r++) table[r] = Math.min(255, Math.max(0, Math.round(fn(r))));
  const lut = cv.matFromArray(1, 256, cv.CV_8UC1, Array.from(table));
  const dst = new cv.Mat();
  try {
    cv.LUT(src, lut, dst);
  } finally {
    lut.delete();
  }
  return dst;
}

/** Gray version of the input (clone if already gray). Caller deletes. */
export function grayOf(cv: Cv, src: Mat): Mat {
  if (src.channels() === 1) return src.clone();
  const g = new cv.Mat();
  cv.cvtColor(src, g, cv.COLOR_RGB2GRAY);
  return g;
}

export const BORDER_NOTE = 'REFLECT_101 (mirror without repeating the edge pixel)';

export type Runner = (ctx: RunContext) => import('../core/types').RunResult;
