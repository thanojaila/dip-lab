import { psnr } from '../core/metrics';
import type { Cv, Mat, RunContext, RunResult } from '../core/types';

function lumaBytes(cv: Cv, m: Mat): Uint8Array {
  if (m.channels() === 1) return Uint8Array.from(m.data);
  const g = new cv.Mat();
  try {
    cv.cvtColor(m, g, cv.COLOR_RGB2GRAY);
    return Uint8Array.from(g.data);
  } finally {
    g.delete();
  }
}

/** PSNR (dB, on gray) of the result and of the input against the clean bundled image, when one is known. */
export function psnrMetric(ctx: RunContext, r: RunResult): Record<string, number> {
  const ref = ctx.reference;
  if (!ref || ref.rows !== r.mat.rows || ref.cols !== r.mat.cols) return {};
  const a = lumaBytes(ctx.cv, ref);
  return { psnr: psnr(lumaBytes(ctx.cv, r.mat), a), psnrInput: psnr(lumaBytes(ctx.cv, ctx.input), a) };
}
