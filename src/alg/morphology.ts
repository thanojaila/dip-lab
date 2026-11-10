import type { Cv, Mat, Params } from '../core/types';
import { bool, grayOf, num, odd, str, type Runner } from './common';

function shapeFlag(cv: Cv, s: string): number {
  return s === 'ellipse' ? cv.MORPH_ELLIPSE : s === 'cross' ? cv.MORPH_CROSS : cv.MORPH_RECT;
}

/** Gray (+ optional Otsu binarisation). Returns {mat, T}. Caller deletes mat. */
function prep(cv: Cv, input: Mat, binarize: boolean): { mat: Mat; T: number | null } {
  const g = grayOf(cv, input);
  if (!binarize) return { mat: g, T: null };
  const bin = new cv.Mat();
  try {
    const T = cv.threshold(g, bin, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
    return { mat: bin, T };
  } catch (e) {
    bin.delete();
    throw e;
  } finally {
    g.delete();
  }
}

function morph(cv: Cv, input: Mat, params: Params, opName: string, op: number) {
  const k = odd(num(params, 'k'));
  const iters = Math.round(num(params, 'iters') || 1);
  const shape = str(params, 'shape');
  const { mat: src, T } = prep(cv, input, bool(params, 'binarize'));
  const se = cv.getStructuringElement(shapeFlag(cv, shape), new cv.Size(k, k));
  const mat = new cv.Mat();
  try {
    cv.morphologyEx(src, mat, op, se, new cv.Point(-1, -1), iters, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
    return {
      mat,
      vars: {
        opName, shape, k, iters,
        pre: T === null ? 'none (grayscale morphology: min/max)' : `Otsu threshold T = ${T} first (binary image)`,
      },
      warnings: [] as string[],
    };
  } catch (e) {
    mat.delete();
    throw e;
  } finally {
    src.delete();
    se.delete();
  }
}

export const morphology: Record<string, Runner> = {
  M01: ({ cv, input, params }) => {
    const erode = str(params, 'op') === 'erode';
    return morph(cv, input, params, erode ? 'Erosion (minimum under the structuring element)' : 'Dilation (maximum under the structuring element)', erode ? cv.MORPH_ERODE : cv.MORPH_DILATE);
  },

  M02: ({ cv, input, params }) => {
    const op = str(params, 'op');
    const table: Record<string, [string, number]> = {
      open: ['Opening = erosion then dilation', cv.MORPH_OPEN],
      close: ['Closing = dilation then erosion', cv.MORPH_CLOSE],
      gradient: ['Morphological gradient = dilation − erosion', cv.MORPH_GRADIENT],
    };
    const [name, flag] = table[op] ?? table.open;
    return morph(cv, input, params, name, flag);
  },

  M03: ({ cv, input, params }) => {
    const minArea = Math.round(num(params, 'minArea'));
    const { mat: bin, T } = prep(cv, input, true);
    const labels = new cv.Mat();
    const stats = new cv.Mat();
    const cents = new cv.Mat();
    const mat = new cv.Mat(bin.rows, bin.cols, cv.CV_8UC1, new cv.Scalar(0));
    try {
      const count = cv.connectedComponentsWithStats(bin, labels, stats, cents, 8, cv.CV_32S);
      const keep = new Uint8Array(count);
      let kept = 0;
      for (let i = 1; i < count; i++) {
        if (stats.intAt(i, 4) >= minArea) {
          keep[i] = 1;
          kept++;
        }
      }
      const lab = labels.data32S;
      const out = mat.data;
      for (let p = 0; p < lab.length; p++) out[p] = keep[lab[p]] ? 255 : 0;
      return { mat, vars: { T: T ?? 0, total: count - 1, kept, minArea, removed: count - 1 - kept }, warnings: [] };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      bin.delete();
      labels.delete();
      stats.delete();
      cents.delete();
    }
  },
};
