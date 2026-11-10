import type { Cv, Mat } from '../core/types';
import { BORDER_NOTE, grayOf, num, type Runner } from './common';

export function histogramJS(data: ArrayLike<number>): Uint32Array {
  const h = new Uint32Array(256);
  for (let i = 0; i < data.length; i++) h[data[i]]++;
  return h;
}

/** Same histogram through OpenCV's calcHist (used by H01 and cross-checked in tests). */
export function histogramCv(cv: Cv, gray: Mat): Float32Array {
  const vec = new cv.MatVector();
  const mask = new cv.Mat();
  const hist = new cv.Mat();
  try {
    vec.push_back(gray);
    cv.calcHist(vec, [0], mask, hist, [256], [0, 255]);
    return new Float32Array(hist.data32F);
  } finally {
    vec.delete();
    mask.delete();
    hist.delete();
  }
}

export function cdf(hist: ArrayLike<number>): Float64Array {
  const out = new Float64Array(256);
  let c = 0;
  let total = 0;
  for (let i = 0; i < 256; i++) total += hist[i];
  for (let i = 0; i < 256; i++) {
    c += hist[i];
    out[i] = total ? c / total : 0;
  }
  return out;
}

export function histStats(hist: ArrayLike<number>) {
  let n = 0, sum = 0, min = -1, max = -1, occupied = 0;
  for (let i = 0; i < 256; i++) {
    const c = hist[i];
    if (c > 0) {
      occupied++;
      if (min < 0) min = i;
      max = i;
    }
    n += c;
    sum += c * i;
  }
  const mean = n ? sum / n : 0;
  let v = 0;
  for (let i = 0; i < 256; i++) v += hist[i] * (i - mean) ** 2;
  return { n, mean, std: n ? Math.sqrt(v / n) : 0, min, max, occupied };
}

export const histogram: Record<string, Runner> = {
  H01: ({ cv, input }) => {
    const g = grayOf(cv, input);
    try {
      const h = histogramCv(cv, g);
      const s = histStats(h);
      return {
        mat: input.clone(),
        vars: { n: s.n, min: s.min, max: s.max, mean: s.mean.toFixed(1), std: s.std.toFixed(1), occupied: s.occupied },
      };
    } finally {
      g.delete();
    }
  },

  H02: ({ cv, input }) => {
    const g = grayOf(cv, input);
    const mat = new cv.Mat();
    try {
      cv.equalizeHist(g, mat);
      return { mat, vars: {}, warnings: input.channels() === 3 ? ['Color input was converted to gray first (equalizeHist is single-channel).'] : [] };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      g.delete();
    }
  },

  H03: ({ cv, input, params }) => {
    const clip = num(params, 'clip');
    const tiles = Math.round(num(params, 'tiles'));
    const g = grayOf(cv, input);
    const mat = new cv.Mat();
    const size = new cv.Size(tiles, tiles);
    const clahe = new cv.CLAHE(clip, size);
    try {
      clahe.apply(g, mat);
      return { mat, vars: { clip, tiles, border: BORDER_NOTE }, warnings: input.channels() === 3 ? ['Color input was converted to gray first.'] : [] };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      clahe.delete();
      g.delete();
    }
  },
};
