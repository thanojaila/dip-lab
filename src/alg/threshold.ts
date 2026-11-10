import { matToPixels } from '../core/matIO';
import { BORDER_NOTE, grayOf, num, str, type Runner } from './common';

function blackFractionLL(data: Uint8Array | Uint8ClampedArray, w: number, h: number): number {
  let black = 0, n = 0;
  for (let y = Math.floor(h / 2); y < h; y++) for (let x = 0; x < Math.floor(w / 2); x++) { n++; if (data[y * w + x] === 0) black++; }
  return n ? black / n : 0;
}

export const threshold: Record<string, Runner> = {
  /** T01: adaptive threshold, compared with a global Otsu on the same image. */
  T01: ({ cv, input, params }) => {
    const block = Math.max(3, Math.round(num(params, 'block')) | 1);
    const C = num(params, 'C');
    const method = str(params, 'method');
    const g = grayOf(cv, input);
    const mat = new cv.Mat();
    const otsu = new cv.Mat();
    try {
      cv.adaptiveThreshold(g, mat, 255, method === 'mean' ? cv.ADAPTIVE_THRESH_MEAN_C : cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, block, C);
      const T = cv.threshold(g, otsu, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
      const w = g.cols, h = g.rows;
      return {
        mat,
        vars: { block, C, method: method === 'mean' ? 'the plain mean' : 'a Gaussian-weighted mean', T, border: BORDER_NOTE },
        metrics: { otsuT: T, adaptiveBlackLL: blackFractionLL(mat.data, w, h), otsuBlackLL: blackFractionLL(otsu.data, w, h) },
        intermediates: [{ label: `Otsu (one global T = ${T})`, pixels: matToPixels(cv, otsu) }],
        warnings: block % 2 === 0 ? [] : [],
      };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      g.delete();
      otsu.delete();
    }
  },
};
