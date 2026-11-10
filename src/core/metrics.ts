/** PSNR between two equal-length 8-bit arrays (dB). Infinity for identical inputs. */
export function psnr(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || a.length === 0) return NaN;
  let se = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    se += d * d;
  }
  const mse = se / a.length;
  return mse === 0 ? 99 : 10 * Math.log10((255 * 255) / mse);
}

/** Luma bytes from RGBA. */
export function lumaOf(rgba: ArrayLike<number>): Uint8Array {
  const n = Math.floor(rgba.length / 4);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  return out;
}

export function mean(a: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return a.length ? s / a.length : 0;
}

export function std(a: ArrayLike<number>): number {
  const m = mean(a);
  let v = 0;
  for (let i = 0; i < a.length; i++) v += (a[i] - m) ** 2;
  return a.length ? Math.sqrt(v / a.length) : 0;
}

/** Variance of the Laplacian response, a cheap "sharpness" number. Input: gray, w, h. */
export function laplacianVariance(g: ArrayLike<number>, w: number, h: number): number {
  const vals: number[] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      vals.push(4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]);
    }
  const m = mean(vals);
  let v = 0;
  for (const x of vals) v += (x - m) ** 2;
  return vals.length ? v / vals.length : 0;
}
