import { createRng } from '../core/prng';
import { domainOf, num, type Runner } from './common';

/** Add N(0, σ²) per channel value, saturating to 0..255. Pure and seeded. */
export function gaussianNoise(src: ArrayLike<number>, sigma: number, seed: number): Uint8ClampedArray {
  const rng = createRng(seed);
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i++) out[i] = Math.round(src[i] + sigma * rng.gauss());
  return out;
}

/** Salt-and-pepper: each pixel (all channels together) becomes 0 or 255 with total probability `amount`. */
export function saltPepper(src: ArrayLike<number>, channels: number, amount: number, seed: number): Uint8ClampedArray {
  const rng = createRng(seed);
  const out = new Uint8ClampedArray(src.length);
  const n = src.length / channels;
  for (let p = 0; p < n; p++) {
    const r = rng.next();
    const base = p * channels;
    if (r < amount / 2) for (let c = 0; c < channels; c++) out[base + c] = 0;
    else if (r < amount) for (let c = 0; c < channels; c++) out[base + c] = 255;
    else for (let c = 0; c < channels; c++) out[base + c] = src[base + c];
  }
  return out;
}

export const noise: Record<string, Runner> = {
  N01: ({ input, params }) => {
    const sigma = num(params, 'sigma');
    const seed = Math.round(num(params, 'seed'));
    const mat = input.clone();
    mat.data.set(gaussianNoise(input.data, sigma, seed));
    return { mat, vars: { sigma, seed, domain: domainOf(input) } };
  },

  N02: ({ input, params }) => {
    const pct = num(params, 'amount');
    const seed = Math.round(num(params, 'seed'));
    const mat = input.clone();
    mat.data.set(saltPepper(input.data, input.channels(), pct / 100, seed));
    const n = input.rows * input.cols;
    return { mat, vars: { amount: pct, half: pct / 2, seed, corrupted: Math.round((pct / 100) * n), domain: domainOf(input) } };
  },
};
