import { matToPixels } from '../core/matIO';
import type { Cv, Mat, Params } from '../core/types';
import { binaryOf, bool, countComponents, grayOf, num, odd, str, type Runner } from './common';

function shapeFlag(cv: Cv, s: string): number {
  return s === 'ellipse' ? cv.MORPH_ELLIPSE : s === 'cross' ? cv.MORPH_CROSS : cv.MORPH_RECT;
}

/** Gray, or binary (explicit T or Otsu; `invert` for dark foreground). Returns {mat, T}. Caller deletes mat. */
function prep(cv: Cv, input: Mat, params: Params): { mat: Mat; T: number | null; note: string } {
  if (!bool(params, 'binarize')) return { mat: grayOf(cv, input), T: null, note: 'none (grayscale morphology: min/max)' };
  const { mat, T, invert } = binaryOf(cv, input, params);
  const how = num(params, 'thr') > 0 ? 'fixed threshold' : 'Otsu threshold';
  return { mat, T, note: `${how} T = ${T}${invert ? ', inverted so dark objects become white' : ''}, giving a binary image` };
}

function seSize(params: Params): [number, number] {
  const kw = odd(num(params, 'k'));
  const kh = num(params, 'kh') > 0 ? odd(num(params, 'kh')) : kw;
  return [kw, kh];
}

function morph(cv: Cv, input: Mat, params: Params, opName: string, op: number) {
  const [kw, kh] = seSize(params);
  const iters = Math.round(num(params, 'iters') || 1);
  const shape = str(params, 'shape');
  const { mat: src, T, note } = prep(cv, input, params);
  const se = cv.getStructuringElement(shapeFlag(cv, shape), new cv.Size(kw, kh));
  const mat = new cv.Mat();
  try {
    cv.morphologyEx(src, mat, op, se, new cv.Point(-1, -1), iters, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
    const before = countComponents(cv, src, 1);
    const after = countComponents(cv, mat, 1);
    return {
      mat,
      vars: { opName, shape, k: kw === kh ? `${kw}` : `${kw}×${kh}`, se: `${kw}×${kh}`, iters, pre: note },
      metrics: { componentsBefore: before.total, componentsAfter: after.total, threshold: T ?? -1 },
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
    const open = Math.round(num(params, 'open'));
    const { mat: bin0, T, invert } = binaryOf(cv, input, params);
    let bin = bin0;
    let cleaned: Mat | null = null;
    const mat = new cv.Mat(bin0.rows, bin0.cols, cv.CV_8UC1, new cv.Scalar(0));
    try {
      if (open > 0) {
        cleaned = new cv.Mat();
        const se = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(odd(open), odd(open)));
        try {
          cv.morphologyEx(bin0, cleaned, cv.MORPH_OPEN, se);
        } finally {
          se.delete();
        }
        bin = cleaned;
      }
      const cc = countComponents(cv, bin, minArea);
      const out = mat.data;
      for (let p = 0; p < cc.labels.length; p++) out[p] = cc.keepMask[cc.labels[p]] ? 255 : 0;
      return {
        mat,
        vars: { T, polarity: invert ? 'inverted (dark objects white)' : 'bright objects white', open: open > 0 ? `${odd(open)}×${odd(open)} opening first` : 'no clean-up opening', total: cc.total, kept: cc.kept, minArea, removed: cc.total - cc.kept },
        metrics: { total: cc.total, kept: cc.kept, removed: cc.total - cc.kept, threshold: T },
        summary: `${cc.kept} objects counted (${cc.total} raw components before the area filter).`,
      };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      bin0.delete();
      cleaned?.delete();
    }
  },

  M04: ({ cv, input, params }) => {
    const [kw, kh] = seSize(params);
    const black = str(params, 'op') === 'blackhat';
    const shape = str(params, 'shape');
    const g = grayOf(cv, input);
    const se = cv.getStructuringElement(shapeFlag(cv, shape), new cv.Size(kw, kh));
    const th = new cv.Mat();
    const mat = new cv.Mat();
    try {
      cv.morphologyEx(g, th, black ? cv.MORPH_BLACKHAT : cv.MORPH_TOPHAT, se);
      const thresholded = bool(params, 'otsu');
      let T = 0;
      const intermediates = [{ label: `${black ? 'Black' : 'White'} top-hat (before threshold)`, pixels: matToPixels(cv, th) }];
      if (thresholded) T = cv.threshold(th, mat, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
      else th.copyTo(mat);
      const cc = countComponents(cv, thresholded ? mat : th, Math.round(num(params, 'minArea')));
      return {
        mat,
        vars: { opName: black ? 'Black-hat = closing − image (small dark things)' : 'White top-hat = image − opening (small bright things)', se: `${kw}×${kh}`, shape, post: thresholded ? `then Otsu T = ${T}` : 'no threshold', total: cc.total, kept: cc.kept, minArea: Math.round(num(params, 'minArea')) },
        metrics: { total: cc.total, kept: cc.kept, threshold: T },
        intermediates,
        summary: `${cc.kept} objects of at least ${Math.round(num(params, 'minArea'))} pixels (${cc.total} raw components).`,
      };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      g.delete();
      se.delete();
      th.delete();
    }
  },
};
