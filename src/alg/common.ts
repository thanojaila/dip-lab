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

/** Like applyLut but also returns the 256-entry table (for the transfer-curve scope). */
export function applyLutT(cv: Cv, src: Mat, fn: (r: number) => number): { mat: Mat; table: number[] } {
  const table: number[] = [];
  for (let r = 0; r < 256; r++) table.push(Math.min(255, Math.max(0, Math.round(fn(r)))));
  const lut = cv.matFromArray(1, 256, cv.CV_8UC1, table);
  const dst = new cv.Mat();
  try {
    cv.LUT(src, lut, dst);
  } finally {
    lut.delete();
  }
  return { mat: dst, table };
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

/** Single 8-bit plane from the input: luma, or one of R/G/B (colour input only). Caller deletes. */
export function pickChannel(cv: Cv, input: Mat, which: string): Mat {
  if (input.channels() === 1 || which === 'gray') return grayOf(cv, input);
  const idx = which === 'red' ? 0 : which === 'green' ? 1 : 2;
  const planes = new cv.MatVector();
  try {
    cv.split(input, planes);
    return planes.get(idx).clone();
  } finally {
    planes.delete();
  }
}

/** Binary image with an explicit threshold (thr > 0) or Otsu (thr = 0); `invert` makes dark things white. */
export function binaryOf(cv: Cv, input: Mat, params: Params): { mat: Mat; T: number; invert: boolean } {
  const g = grayOf(cv, input);
  const bin = new cv.Mat();
  try {
    const thr = Math.round(num(params, 'thr') || 0);
    const invert = bool(params, 'invert');
    const type = invert ? cv.THRESH_BINARY_INV : cv.THRESH_BINARY;
    const T = thr > 0 ? (cv.threshold(g, bin, thr, 255, type), thr) : cv.threshold(g, bin, 0, 255, type | cv.THRESH_OTSU);
    return { mat: bin, T, invert };
  } catch (e) {
    bin.delete();
    throw e;
  } finally {
    g.delete();
  }
}

/** Count connected components (8-connected) in a binary mat; returns total and those with area >= minArea. */
export function countComponents(cv: Cv, bin: Mat, minArea: number): { total: number; kept: number; keepMask: Uint8Array; labels: Int32Array } {
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const cents = new cv.Mat();
  try {
    const count = cv.connectedComponentsWithStats(bin, labels, stats, cents, 8, cv.CV_32S);
    const keep = new Uint8Array(count);
    let kept = 0;
    for (let i = 1; i < count; i++) if (stats.intAt(i, 4) >= minArea) { keep[i] = 1; kept++; }
    return { total: count - 1, kept, keepMask: keep, labels: Int32Array.from(labels.data32S) };
  } finally {
    labels.delete();
    stats.delete();
    cents.delete();
  }
}
