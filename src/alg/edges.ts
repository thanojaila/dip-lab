import type { Cv, Mat } from '../core/types';
import { BORDER_NOTE, bool, grayOf, num, odd, str, type Runner } from './common';

/** Gradient magnitude of float gx, gy, scaled so the max maps to 255. Returns {mat, max}. Caller deletes mat. */
function magnitudeTo8U(cv: Cv, gx: Mat, gy: Mat): { mat: Mat; max: number } {
  const mag = new cv.Mat();
  const out = new cv.Mat();
  try {
    cv.magnitude(gx, gy, mag);
    let max = 0;
    const f = mag.data32F;
    for (let i = 0; i < f.length; i++) if (f[i] > max) max = f[i];
    mag.convertTo(out, cv.CV_8U, max > 0 ? 255 / max : 1, 0);
    return { mat: out, max };
  } catch (e) {
    out.delete();
    throw e;
  } finally {
    mag.delete();
  }
}

export const edges: Record<string, Runner> = {
  S08: ({ cv, input, params }) => {
    const ksize = Math.round(num(params, 'ksize'));
    const g = grayOf(cv, input);
    const gx = new cv.Mat();
    const gy = new cv.Mat();
    try {
      cv.Sobel(g, gx, cv.CV_32F, 1, 0, ksize, 1, 0, cv.BORDER_REFLECT_101);
      cv.Sobel(g, gy, cv.CV_32F, 0, 1, ksize, 1, 0, cv.BORDER_REFLECT_101);
      const { mat, max } = magnitudeTo8U(cv, gx, gy);
      return { mat, vars: { ksize, max: max.toFixed(1), border: BORDER_NOTE } };
    } finally {
      g.delete();
      gx.delete();
      gy.delete();
    }
  },

  S07: ({ cv, input, params }) => {
    const op = str(params, 'op');
    const g = grayOf(cv, input);
    const gx = new cv.Mat();
    const gy = new cv.Mat();
    const kx = cv.matFromArray(op === 'roberts' ? 2 : 3, op === 'roberts' ? 2 : 3, cv.CV_32F, op === 'roberts' ? [1, 0, 0, -1] : [-1, 0, 1, -1, 0, 1, -1, 0, 1]);
    const ky = cv.matFromArray(op === 'roberts' ? 2 : 3, op === 'roberts' ? 2 : 3, cv.CV_32F, op === 'roberts' ? [0, 1, -1, 0] : [-1, -1, -1, 0, 0, 0, 1, 1, 1]);
    try {
      const anchor = op === 'roberts' ? new cv.Point(0, 0) : new cv.Point(-1, -1);
      cv.filter2D(g, gx, cv.CV_32F, kx, anchor, 0, cv.BORDER_REFLECT_101);
      cv.filter2D(g, gy, cv.CV_32F, ky, anchor, 0, cv.BORDER_REFLECT_101);
      const { mat, max } = magnitudeTo8U(cv, gx, gy);
      return { mat, vars: { op: op === 'roberts' ? 'Roberts cross (2×2 diagonal differences)' : 'Prewitt (3×3 unweighted smoothing + difference)', max: max.toFixed(1), border: BORDER_NOTE } };
    } finally {
      g.delete();
      gx.delete();
      gy.delete();
      kx.delete();
      ky.delete();
    }
  },

  E01: ({ cv, input, params }) => {
    const t1 = num(params, 't1');
    const t2 = num(params, 't2');
    const l2 = bool(params, 'l2');
    const pre = Math.round(num(params, 'preblur'));
    const g = grayOf(cv, input);
    const sm = new cv.Mat();
    const mat = new cv.Mat();
    try {
      if (pre > 0) cv.GaussianBlur(g, sm, new cv.Size(odd(pre), odd(pre)), 0, 0, cv.BORDER_REFLECT_101);
      else g.copyTo(sm);
      cv.Canny(sm, mat, Math.min(t1, t2), Math.max(t1, t2), 3, l2);
      const warnings: string[] = [];
      if (t1 > t2) warnings.push('Low threshold was above the high one; they were swapped.');
      return {
        mat,
        vars: { t1: Math.min(t1, t2), t2: Math.max(t1, t2), norm: l2 ? 'L2 (√(Gx²+Gy²))' : 'L1 (|Gx|+|Gy|)', pre: pre > 0 ? `Gaussian ${odd(pre)}×${odd(pre)}` : 'none' },
        warnings,
      };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      g.delete();
      sm.delete();
    }
  },
};
