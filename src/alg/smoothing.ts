import { BORDER_NOTE, domainOf, num, odd, type Runner } from './common';

export const smoothing: Record<string, Runner> = {
  S01: ({ cv, input, params }) => {
    const k = odd(num(params, 'k'));
    const mat = new cv.Mat();
    cv.blur(input, mat, new cv.Size(k, k), new cv.Point(-1, -1), cv.BORDER_REFLECT_101);
    return { mat, vars: { k, area: k * k, w: (1 / (k * k)).toFixed(4), domain: domainOf(input), border: BORDER_NOTE } };
  },

  S02: ({ cv, input, params }) => {
    const k = odd(num(params, 'k'));
    const sigmaIn = num(params, 'sigma');
    const sigma = sigmaIn > 0 ? sigmaIn : 0.3 * ((k - 1) * 0.5 - 1) + 0.8;
    const mat = new cv.Mat();
    cv.GaussianBlur(input, mat, new cv.Size(k, k), sigmaIn, sigmaIn, cv.BORDER_REFLECT_101);
    const warnings: string[] = [];
    if (sigmaIn > 0 && k < 6 * sigmaIn - 1) warnings.push(`Kernel ${k}×${k} is narrower than ~6σ (${Math.ceil(6 * sigma)}); the Gaussian is truncated, so the blur is weaker than σ suggests.`);
    return { mat, vars: { k, sigma: sigma.toFixed(2), sigmaNote: sigmaIn > 0 ? 'as set' : 'auto from k (σ = 0.3·((k−1)/2 − 1) + 0.8)', domain: domainOf(input), border: BORDER_NOTE }, warnings };
  },

  S03: ({ cv, input, params }) => {
    const k = odd(num(params, 'k'));
    const mat = new cv.Mat();
    cv.medianBlur(input, mat, k);
    return { mat, vars: { k, area: k * k, mid: Math.floor((k * k) / 2) + 1, domain: domainOf(input), border: 'replicated edge pixels (OpenCV medianBlur)' } };
  },

  S04: ({ cv, input, params }) => {
    const d = Math.round(num(params, 'd'));
    const sc = num(params, 'sigmaColor');
    const ss = num(params, 'sigmaSpace');
    const mat = new cv.Mat();
    const warnings: string[] = [];
    if (d > 9 && input.rows * input.cols > 512 * 512) warnings.push(`d = ${d} on a ${input.cols}×${input.rows} image is slow (cost grows with d²). Try d ≤ 9.`);
    const t0 = performance.now();
    cv.bilateralFilter(input, mat, d, sc, ss, cv.BORDER_REFLECT_101);
    const ms = Math.round(performance.now() - t0);
    return { mat, vars: { d, sigmaColor: sc, sigmaSpace: ss, ms, domain: domainOf(input), border: BORDER_NOTE }, warnings };
  },

  S05: ({ cv, input, params }) => {
    const sigma = num(params, 'sigma');
    const k = num(params, 'k');
    const blur = new cv.Mat();
    const mat = new cv.Mat();
    try {
      cv.GaussianBlur(input, blur, new cv.Size(0, 0), sigma, sigma, cv.BORDER_REFLECT_101);
      cv.addWeighted(input, 1 + k, blur, -k, 0, mat);
      return { mat, vars: { sigma, k, k1: (1 + k).toFixed(2), domain: domainOf(input), border: BORDER_NOTE } };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      blur.delete();
    }
  },

  S06: ({ cv, input, params }) => {
    const eight = params.neighbours === '8';
    const kernel = cv.matFromArray(3, 3, cv.CV_32F, eight ? [-1, -1, -1, -1, 9, -1, -1, -1, -1] : [0, -1, 0, -1, 5, -1, 0, -1, 0]);
    const mat = new cv.Mat();
    try {
      cv.filter2D(input, mat, -1, kernel, new cv.Point(-1, -1), 0, cv.BORDER_REFLECT_101);
      return { mat, vars: { kernelRows: eight ? '[−1 −1 −1; −1 9 −1; −1 −1 −1]' : '[0 −1 0; −1 5 −1; 0 −1 0]', nb: eight ? 8 : 4, domain: domainOf(input), border: BORDER_NOTE } };
    } catch (e) {
      mat.delete();
      throw e;
    } finally {
      kernel.delete();
    }
  },
};
