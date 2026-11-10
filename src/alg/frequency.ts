import type { Cv, Mat, PlainPixels } from '../core/types';
import { grayOf, num, str, type Runner } from './common';

/** Quadrant swap so the zero frequency sits in the middle. `inverse` undoes it (matters for odd sizes). Pure. */
export function fftShift<T extends Float32Array | Float64Array>(a: T, W: number, H: number, inverse = false): T {
  const out = new (a.constructor as new (n: number) => T)(a.length);
  const sx = inverse ? Math.ceil(W / 2) : Math.floor(W / 2);
  const sy = inverse ? Math.ceil(H / 2) : Math.floor(H / 2);
  for (let y = 0; y < H; y++) {
    const ny = (y + sy) % H;
    for (let x = 0; x < W; x++) out[ny * W + ((x + sx) % W)] = a[y * W + x];
  }
  return out;
}

/** Frequency-domain filter mask (centered). Pure. */
export function filterMask(kind: 'ideal' | 'gaussian', pass: 'low' | 'high', d0: number, W: number, H: number): Float32Array {
  const m = new Float32Array(W * H);
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      const low = kind === 'ideal' ? (d2 <= d0 * d0 ? 1 : 0) : Math.exp(-d2 / (2 * d0 * d0));
      m[y * W + x] = pass === 'low' ? low : 1 - low;
    }
  return m;
}

export interface Spectrum {
  re: Float32Array;
  im: Float32Array;
  W: number;
  H: number;
  w: number;
  h: number;
}

/** Forward DFT of a gray 8-bit mat: zero-pad to the optimal size, cv.dft, split, shift. Pure data out. */
export function forwardDft(cv: Cv, gray: Mat): Spectrum {
  const w = gray.cols, h = gray.rows;
  const W = cv.getOptimalDFTSize(w), H = cv.getOptimalDFTSize(h);
  const padded = new cv.Mat();
  const f32 = new cv.Mat();
  const cplx = new cv.Mat();
  try {
    cv.copyMakeBorder(gray, padded, 0, H - h, 0, W - w, cv.BORDER_CONSTANT, new cv.Scalar(0));
    padded.convertTo(f32, cv.CV_32F);
    cv.dft(f32, cplx, cv.DFT_COMPLEX_OUTPUT);
    const d = cplx.data32F;
    const re = new Float32Array(W * H), im = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      re[i] = d[2 * i];
      im[i] = d[2 * i + 1];
    }
    return { re: fftShift(re, W, H), im: fftShift(im, W, H), W, H, w, h };
  } finally {
    padded.delete();
    f32.delete();
    cplx.delete();
  }
}

/** Inverse DFT with cv.dft(DFT_INVERSE | DFT_SCALE) (cv.idft is not exported by this build). Returns float image w×h. */
export function inverseDft(cv: Cv, s: Spectrum, mask: Float32Array): Float32Array {
  const { W, H } = s;
  const re = new Float32Array(W * H), im = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    re[i] = s.re[i] * mask[i];
    im[i] = s.im[i] * mask[i];
  }
  const ur = fftShift(re, W, H, true), ui = fftShift(im, W, H, true);
  const inter = new Float32Array(2 * W * H);
  for (let i = 0; i < W * H; i++) {
    inter[2 * i] = ur[i];
    inter[2 * i + 1] = ui[i];
  }
  const cplx = cv.matFromArray(H, W, cv.CV_32FC2, Array.from(inter));
  const out = new cv.Mat();
  try {
    cv.dft(cplx, out, cv.DFT_INVERSE | cv.DFT_SCALE | cv.DFT_REAL_OUTPUT);
    const d = out.data32F;
    const res = new Float32Array(s.w * s.h);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) res[y * s.w + x] = d[y * W + x];
    return res;
  } finally {
    cplx.delete();
    out.delete();
  }
}

/** log(1 + |F|) scaled so the largest value is 255 (stated in the Exact text). */
export function logSpectrumPixels(s: Spectrum): PlainPixels {
  const n = s.W * s.H;
  const lm = new Float32Array(n);
  let max = 0;
  for (let i = 0; i < n; i++) {
    lm[i] = Math.log(1 + Math.hypot(s.re[i], s.im[i]));
    if (lm[i] > max) max = lm[i];
  }
  const data = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const v = max > 0 ? (lm[i] / max) * 255 : 0;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { w: s.W, h: s.H, data };
}

/** Radius (in frequency pixels, DC excluded) that contains `frac` of the spectral energy. Pure. */
export function energyRadius(s: Spectrum, frac = 0.95): number {
  const cx = Math.floor(s.W / 2), cy = Math.floor(s.H / 2);
  const bins = new Float64Array(Math.ceil(Math.hypot(s.W, s.H)) + 2);
  let total = 0;
  for (let y = 0; y < s.H; y++)
    for (let x = 0; x < s.W; x++) {
      const r = Math.round(Math.hypot(x - cx, y - cy));
      if (r === 0) continue;
      const e = s.re[y * s.W + x] ** 2 + s.im[y * s.W + x] ** 2;
      bins[r] += e;
      total += e;
    }
  let acc = 0;
  for (let r = 1; r < bins.length; r++) {
    acc += bins[r];
    if (acc >= frac * total) return r;
  }
  return bins.length;
}

function toGray8(f: Float32Array, w: number, h: number, offset: number): { mat: Float32Array; clipped: Uint8ClampedArray; min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < f.length; i++) { if (f[i] < min) min = f[i]; if (f[i] > max) max = f[i]; }
  const clipped = new Uint8ClampedArray(w * h);
  for (let i = 0; i < f.length; i++) clipped[i] = Math.round(f[i] + offset);
  return { mat: f, clipped, min, max };
}

function grayMat(cv: Cv, data: Uint8ClampedArray, w: number, h: number): Mat {
  const m = new cv.Mat(h, w, cv.CV_8UC1);
  m.data.set(data);
  return m;
}

function grayPixels(data: Uint8ClampedArray, w: number, h: number): PlainPixels {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = data[i]; out[i * 4 + 3] = 255; }
  return { w, h, data: out };
}

function runFilter(cv: Cv, input: Mat, kind: 'ideal' | 'gaussian', pass: 'low' | 'high', d0: number, offset: number) {
  const g = grayOf(cv, input);
  try {
    const s = forwardDft(cv, g);
    const mask = filterMask(kind, pass, d0, s.W, s.H);
    const f = inverseDft(cv, s, mask);
    const out = toGray8(f, s.w, s.h, offset);
    return { s, out, g };
  } catch (e) {
    g.delete();
    throw e;
  }
}

export const frequency: Record<string, Runner> = {
  Q01: ({ cv, input }) => {
    const g = grayOf(cv, input);
    try {
      const s = forwardDft(cv, g);
      const sp = logSpectrumPixels(s);
      const mat = new cv.Mat(s.H, s.W, cv.CV_8UC1);
      for (let i = 0; i < s.W * s.H; i++) mat.data[i] = sp.data[i * 4];
      const r95 = energyRadius(s);
      return {
        mat,
        vars: { W: s.W, H: s.H, w: s.w, h: s.h, r95 },
        metrics: { energyRadius95: r95, dcLog: Math.log(1 + Math.hypot(s.re[Math.floor(s.H / 2) * s.W + Math.floor(s.W / 2)], s.im[Math.floor(s.H / 2) * s.W + Math.floor(s.W / 2)])) },
        spectrum: { pixels: sp, kind: 'spectrum' },
        summary: `Spectrum ${s.W}×${s.H}; 95% of the non-DC energy lies within ${r95} pixels of the centre.`,
      };
    } finally {
      g.delete();
    }
  },

  Q02: ({ cv, input, params }) => {
    const kind = str(params, 'kind') as 'ideal' | 'gaussian';
    const d0 = num(params, 'd0');
    const { s, out, g } = runFilter(cv, input, kind, 'low', d0, 0);
    try {
      return {
        mat: grayMat(cv, out.clipped, s.w, s.h),
        vars: { kind: kind === 'ideal' ? 'ideal (1 inside the circle, 0 outside)' : 'Gaussian exp(−D²/(2·D0²))', d0, W: s.W, H: s.H },
        metrics: { min: out.min, max: out.max },
        spectrum: { pixels: logSpectrumPixels(s), cutoff: d0, kind },
        summary: `Low-pass, D0 = ${d0}; values before clipping ranged ${out.min.toFixed(0)} to ${out.max.toFixed(0)}.`,
      };
    } finally {
      g.delete();
    }
  },

  Q03: ({ cv, input, params }) => {
    const kind = str(params, 'kind') as 'ideal' | 'gaussian';
    const d0 = num(params, 'd0');
    const shifted = str(params, 'display') === 'offset';
    const { s, out, g } = runFilter(cv, input, kind, 'high', d0, shifted ? 128 : 0);
    try {
      return {
        mat: grayMat(cv, out.clipped, s.w, s.h),
        vars: { kind: kind === 'ideal' ? 'ideal (0 inside the circle, 1 outside)' : '1 − exp(−D²/(2·D0²))', d0, W: s.W, H: s.H, display: shifted ? 'add 128 so negative values are visible, then clip' : 'clip negatives to 0 (the image goes dark)' },
        metrics: { min: out.min, max: out.max },
        spectrum: { pixels: logSpectrumPixels(s), cutoff: d0, kind },
        summary: `High-pass, D0 = ${d0}; the signed result ranged ${out.min.toFixed(0)} to ${out.max.toFixed(0)}.`,
      };
    } finally {
      g.delete();
    }
  },

  Q04: ({ cv, input, params }) => {
    const d0 = num(params, 'd0');
    const show = str(params, 'show') as 'ideal' | 'gaussian';
    const a = runFilter(cv, input, 'ideal', 'low', d0, 0);
    const b = runFilter(cv, input, 'gaussian', 'low', d0, 0);
    try {
      const pick = show === 'ideal' ? a : b;
      return {
        mat: grayMat(cv, pick.out.clipped, pick.s.w, pick.s.h),
        vars: { d0, show, idealMin: a.out.min.toFixed(0), idealMax: a.out.max.toFixed(0), gaussMin: b.out.min.toFixed(0), gaussMax: b.out.max.toFixed(0) },
        metrics: { idealMin: a.out.min, idealMax: a.out.max, gaussMin: b.out.min, gaussMax: b.out.max, idealOvershoot: Math.max(0, -a.out.min, a.out.max - 255), gaussOvershoot: Math.max(0, -b.out.min, b.out.max - 255) },
        intermediates: [
          { label: 'Ideal low-pass', pixels: grayPixels(a.out.clipped, a.s.w, a.s.h) },
          { label: 'Gaussian low-pass', pixels: grayPixels(b.out.clipped, b.s.w, b.s.h) },
        ],
        spectrum: { pixels: logSpectrumPixels(a.s), cutoff: d0, kind: show },
        summary: `Ideal range ${a.out.min.toFixed(0)} to ${a.out.max.toFixed(0)}; Gaussian range ${b.out.min.toFixed(0)} to ${b.out.max.toFixed(0)}.`,
      };
    } finally {
      a.g.delete();
      b.g.delete();
    }
  },
};
