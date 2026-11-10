import type { Cv, Mat } from '../core/types';
import { BORDER_NOTE, pickChannel, num, str, type Runner } from './common';
import { histogramFromPixels } from '../core/imageOps';
import { std as stdOf } from '../core/metrics';

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

/** Smallest level j in the reference with CDF_ref(j) >= CDF_src(i), for every source level i. Pure. */
export function matchLut(srcHist: ArrayLike<number>, refHist: ArrayLike<number>): number[] {
  const cs = cdf(srcHist);
  const cr = cdf(refHist);
  const out: number[] = [];
  let j = 0;
  for (let i = 0; i < 256; i++) {
    while (j < 255 && cr[j] < cs[i] - 1e-12) j++;
    out.push(j);
  }
  return out;
}

/** Equalisation transfer table from a histogram (what cv.equalizeHist applies). */
export function equalizeTable(hist: ArrayLike<number>): number[] {
  let n = 0;
  for (let i = 0; i < 256; i++) n += hist[i];
  let c = 0, cmin = 0;
  const out: number[] = [];
  for (let v = 0; v < 256; v++) {
    c += hist[v];
    if (cmin === 0 && c > 0) cmin = c;
    out.push(n === cmin ? v : Math.round(((c - cmin) / (n - cmin)) * 255));
  }
  return out.map((x) => Math.max(0, Math.min(255, x)));
}

export const histogram: Record<string, Runner> = {
  H01: ({ cv, input, params }) => {
    const g = pickChannel(cv, input, str(params, 'channel'));
    try {
      const h = histogramCv(cv, g);
      const s = histStats(h);
      return {
        mat: input.clone(),
        vars: { n: s.n, min: s.min, max: s.max, mean: s.mean.toFixed(1), std: s.std.toFixed(1), occupied: s.occupied, chan: str(params, 'channel') === 'gray' || input.channels() === 1 ? 'luma' : str(params, 'channel') },
        metrics: { mean: s.mean, std: s.std, min: s.min, max: s.max, binsUsed: s.occupied },
      };
    } finally {
      g.delete();
    }
  },

  H02: ({ cv, input, params }) => {
    const g = pickChannel(cv, input, str(params, 'channel'));
    const mat = new cv.Mat();
    try {
      const table = equalizeTable(histogramJS(g.data));
      cv.equalizeHist(g, mat);
      return {
        mat,
        curve: table,
        vars: { chan: str(params, 'channel') === 'gray' || input.channels() === 1 ? 'luma' : str(params, 'channel') },
        metrics: { stdBefore: stdOf(g.data), stdAfter: stdOf(mat.data) },
        warnings: input.channels() === 3 ? ['equalizeHist works on one channel, so a single plane was equalised.'] : [],
      };
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
    const g = pickChannel(cv, input, str(params, 'channel'));
    const mat = new cv.Mat();
    const size = new cv.Size(tiles, tiles);
    const clahe = new cv.CLAHE(clip, size);
    try {
      clahe.apply(g, mat);
      return {
        mat,
        vars: { clip, tiles, border: BORDER_NOTE, chan: str(params, 'channel') === 'gray' || input.channels() === 1 ? 'luma' : str(params, 'channel') },
        metrics: { stdBefore: stdOf(g.data), stdAfter: stdOf(mat.data) },
        warnings: input.channels() === 3 ? ['CLAHE works on one channel, so a single plane was processed.'] : [],
      };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      clahe.delete();
      g.delete();
    }
  },

  H04: ({ cv, input, params, refPixels }) => {
    if (!refPixels) throw new Error('Choose a reference image first.');
    const refName = str(params, 'ref');
    const color = input.channels() === 3;
    const refGray = (() => {
      for (let i = 0; i < refPixels.data.length; i += 4) if (refPixels.data[i] !== refPixels.data[i + 1] || refPixels.data[i] !== refPixels.data[i + 2]) return false;
      return true;
    })();
    const planes: ('r' | 'g' | 'b' | 'gray')[] = color ? ['r', 'g', 'b'] : ['gray'];
    const tables = planes.map((pl) => {
      const refCh = color && !refGray ? histogramFromPixels(refPixels, pl) : histogramFromPixels(refPixels, 'gray');
      const srcHist = histogramJS(
        color
          ? (() => {
              const idx = pl === 'r' ? 0 : pl === 'g' ? 1 : 2;
              const a = new Uint8Array(input.rows * input.cols);
              for (let i = 0; i < a.length; i++) a[i] = input.data[i * 3 + idx];
              return a;
            })()
          : input.data,
      );
      return matchLut(srcHist, refCh);
    });
    const flat: number[] = [];
    for (let v = 0; v < 256; v++) for (const t of tables) flat.push(t[v]);
    const lut = cv.matFromArray(1, 256, color ? cv.CV_8UC3 : cv.CV_8UC1, flat);
    const mat = new cv.Mat();
    try {
      cv.LUT(input, lut, mat);
    } finally {
      lut.delete();
    }
    return {
      mat,
      curve: color ? undefined : tables[0],
      vars: { refName, domain: color ? 'uint8 RGB (each channel matched to the reference channel)' : 'uint8 gray' },
      metrics: { stdBefore: stdOf(input.data), stdAfter: stdOf(mat.data) },
    };
  },
};
