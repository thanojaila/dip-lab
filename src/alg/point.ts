import type { Cv, Mat } from '../core/types';
import { applyLutT, bool, domainOf, grayOf, num, str, type Runner } from './common';

/** Percentile bounds from the gray histogram: smallest v whose CDF reaches p% of pixels. Pure. */
export function percentileBounds(data: ArrayLike<number>, pLow: number, pHigh: number): { lo: number; hi: number } {
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i++) hist[data[i]]++;
  const n = data.length;
  const at = (p: number): number => {
    const target = (p / 100) * n;
    let c = 0;
    for (let v = 0; v < 256; v++) {
      c += hist[v];
      if (c >= target && c > 0) return v;
    }
    return 255;
  };
  let lo = at(pLow);
  let hi = at(pHigh);
  if (hi <= lo) hi = Math.min(255, lo + 1);
  if (hi <= lo) lo = Math.max(0, hi - 1);
  return { lo, hi };
}

function stretchBounds(cv: Cv, input: Mat, pLow: number, pHigh: number) {
  const g = grayOf(cv, input);
  try {
    return percentileBounds(g.data, pLow, pHigh);
  } finally {
    g.delete();
  }
}

export const point: Record<string, Runner> = {
  P01: ({ cv, input }) => {
    const { mat, table } = applyLutT(cv, input, (r) => 255 - r);
    return { mat, curve: table, vars: { domain: domainOf(input) } };
  },

  P02: ({ cv, input, params }) => {
    const b = num(params, 'b');
    const clip = bool(params, 'clip');
    const { mat, table } = applyLutT(cv, input, clip ? (r) => r + b : (r) => (((r + b) % 256) + 256) % 256);
    return {
      mat,
      curve: table,
      vars: {
        b: b >= 0 ? `+${b}` : `${b}`,
        rule: clip ? 'clip(r + b, 0, 255) (saturating)' : '(r + b) mod 256 (wraps around)',
        domain: domainOf(input),
      },
      warnings: clip ? [] : ['Clip is OFF: values that leave 0–255 wrap around, so bright areas turn dark.'],
    };
  },

  P03: ({ cv, input, params }) => {
    const pLow = num(params, 'pLow');
    const pHigh = num(params, 'pHigh');
    const { lo, hi } = stretchBounds(cv, input, pLow, pHigh);
    const { mat, table } = applyLutT(cv, input, (r) => ((r - lo) / (hi - lo)) * 255);
    return { mat, curve: table, vars: { pLow, pHigh, lo, hi, domain: domainOf(input) } };
  },

  P04: ({ cv, input, params }) => {
    const a = num(params, 'alpha');
    const c = 255 / Math.log(1 + a * 255);
    const { mat, table } = applyLutT(cv, input, (r) => c * Math.log(1 + a * r));
    return { mat, curve: table, vars: { alpha: a, c: c.toFixed(3), domain: domainOf(input) } };
  },

  P05: ({ cv, input, params }) => {
    const g = num(params, 'gamma');
    const { mat, table } = applyLutT(cv, input, (r) => Math.pow(r / 255, g) * 255);
    return { mat, curve: table, vars: { gamma: g, domain: domainOf(input) } };
  },

  P06: ({ cv, input, params }) => {
    const mode = str(params, 'mode');
    const T = num(params, 'T');
    const g = grayOf(cv, input);
    const mat = new cv.Mat();
    try {
      let used = T;
      if (mode === 'otsu') {
        used = cv.threshold(g, mat, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
      } else {
        cv.threshold(g, mat, T, 255, mode === 'binary_inv' ? cv.THRESH_BINARY_INV : cv.THRESH_BINARY);
      }
      const rule =
        mode === 'otsu'
          ? `Otsu picks T = ${used} by maximising between-class variance of the gray histogram; out = 255 if r > T else 0`
          : mode === 'binary_inv'
            ? `out = 0 if r > T else 255, with T = ${T}`
            : `out = 255 if r > T else 0, with T = ${T}`;
      return { mat, vars: { rule, T: used }, warnings: input.channels() === 3 ? ['Color input was converted to gray first.'] : [] };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      g.delete();
    }
  },
};
