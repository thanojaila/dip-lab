import type { Cv, Mat } from '../core/types';
import { laplacianVariance } from '../core/metrics';
import { grayOf, num, str, type Runner } from './common';

const BORDERS: Record<string, [string, (cv: Cv) => number]> = {
  constant: ['constant (black)', (cv) => cv.BORDER_CONSTANT],
  replicate: ['replicate the edge pixel', (cv) => cv.BORDER_REPLICATE],
  reflect: ['mirror (REFLECT_101)', (cv) => cv.BORDER_REFLECT_101],
};

function sharpness(cv: Cv, m: Mat): number {
  const g = grayOf(cv, m);
  try {
    return laplacianVariance(g.data, g.cols, g.rows);
  } finally {
    g.delete();
  }
}

export const geometry: Record<string, Runner> = {
  G01: ({ cv, input, params }) => {
    const angle = num(params, 'angle');
    const scale = num(params, 'scale');
    const passes = Math.max(1, Math.round(num(params, 'passes')));
    const cx = input.cols / 2, cy = input.rows / 2;
    const M = cv.getRotationMatrix2D(new cv.Point(cx, cy), angle / passes, Math.pow(scale, 1 / passes));
    let cur = input.clone();
    try {
      for (let i = 0; i < passes; i++) {
        const next = new cv.Mat();
        cv.warpAffine(cur, next, M, new cv.Size(input.cols, input.rows), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 255));
        cur.delete();
        cur = next;
      }
      const out = cur.clone();
      return {
        mat: out,
        vars: { angle, scale, passes, step: (angle / passes).toFixed(2), w: input.cols, h: input.rows },
        metrics: { sharpnessBefore: sharpness(cv, input), sharpnessAfter: sharpness(cv, out) },
      };
    } finally {
      cur.delete();
      M.delete();
    }
  },

  G02: ({ cv, input, params }) => {
    const tx = num(params, 'tx'), ty = num(params, 'ty'), shear = num(params, 'shear');
    const border = str(params, 'border');
    const [name, flag] = BORDERS[border] ?? BORDERS.constant;
    const M = cv.matFromArray(2, 3, cv.CV_64F, [1, shear, tx, 0, 1, ty]);
    const mat = new cv.Mat();
    try {
      cv.warpAffine(input, mat, M, new cv.Size(input.cols, input.rows), cv.INTER_LINEAR, flag(cv), new cv.Scalar(0, 0, 0, 255));
      return { mat, vars: { tx, ty, shear, borderName: name, w: input.cols, h: input.rows } };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      M.delete();
    }
  },

  G03: ({ cv, input, params }) => {
    const out = Math.round(num(params, 'size'));
    const pts = [0, 1, 2, 3].flatMap((i) => [num(params, `x${i}`), num(params, `y${i}`)]);
    const src = cv.matFromArray(4, 1, cv.CV_32FC2, pts);
    const dst = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, out - 1, 0, out - 1, out - 1, 0, out - 1]);
    const M = cv.getPerspectiveTransform(src, dst);
    const mat = new cv.Mat();
    try {
      cv.warpPerspective(input, mat, M, new cv.Size(out, out), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 255));
      return { mat, vars: { size: out, corners: [0, 1, 2, 3].map((i) => `(${Math.round(num(params, `x${i}`))}, ${Math.round(num(params, `y${i}`))})`).join(', ') } };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      src.delete();
      dst.delete();
      M.delete();
    }
  },
};
