import type { Params } from '../../core/types';

export interface KernelInfo {
  title: string;
  /** One or more weight grids (e.g. Gx and Gy). */
  grids: { label: string; w: number[][] }[];
  note: string;
}

const num = (p: Params, k: string, d = 0): number => (p[k] === undefined ? d : Number(p[k]));

/** 1-D Gaussian weights of odd size k (normalised). Pure. */
export function gaussian1d(k: number, sigma: number): number[] {
  const s = sigma > 0 ? sigma : 0.3 * ((k - 1) * 0.5 - 1) + 0.8;
  const c = (k - 1) / 2;
  const w = Array.from({ length: k }, (_, i) => Math.exp(-((i - c) ** 2) / (2 * s * s)));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}

const outer = (a: number[], b: number[]): number[][] => a.map((x) => b.map((y) => x * y));

/** OpenCV's Sobel kernel of odd size 3, 5 or 7 (smoothing × derivative, binomial). Pure. */
export function sobelKernel(k: number, dir: 'x' | 'y'): number[][] {
  const smooth: Record<number, number[]> = { 3: [1, 2, 1], 5: [1, 4, 6, 4, 1], 7: [1, 6, 15, 20, 15, 6, 1] };
  const deriv: Record<number, number[]> = { 3: [-1, 0, 1], 5: [-1, -2, 0, 2, 1], 7: [-1, -4, -5, 0, 5, 4, 1] };
  const s = smooth[k] ?? smooth[3], d = deriv[k] ?? deriv[3];
  return dir === 'x' ? outer(s, d) : outer(d, s);
}

/** The weights a spatial-filter concept applies; null for concepts that are not a fixed convolution. Pure. */
export function kernelFor(id: string, p: Params): KernelInfo | null {
  switch (id) {
    case 'S01': {
      const k = num(p, 'k', 5);
      return { title: `Box ${k}×${k}`, grids: [{ label: 'weights', w: Array.from({ length: k }, () => Array(k).fill(1 / (k * k))) }], note: `Every weight is 1/${k * k}.` };
    }
    case 'S02': {
      const k = num(p, 'k', 7), g = gaussian1d(k, num(p, 'sigma', 0));
      return { title: `Gaussian ${k}×${k}`, grids: [{ label: 'weights', w: outer(g, g) }], note: 'Centre pixels count most; weights sum to 1.' };
    }
    case 'S05': {
      const sigma = num(p, 'sigma', 2), k = Math.max(3, 2 * Math.ceil(3 * sigma) + 1), g = gaussian1d(k, sigma);
      return { title: `Unsharp: blur kernel (σ ${sigma})`, grids: [{ label: 'blur weights', w: outer(g, g) }], note: `Output = ${(1 + num(p, 'k', 1.5)).toFixed(2)}·f − ${num(p, 'k', 1.5)}·(blur of f).` };
    }
    case 'S06':
      return { title: 'Laplacian sharpen', grids: [{ label: 'weights', w: p.neighbours === '8' ? [[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]] : [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] }], note: 'Centre minus the neighbours: a sharpened copy in one convolution.' };
    case 'S08': {
      const k = num(p, 'ksize', 3);
      return { title: `Sobel ${k}×${k}`, grids: [{ label: 'Gx (change along x)', w: sobelKernel(k, 'x') }, { label: 'Gy (change along y)', w: sobelKernel(k, 'y') }], note: 'Smooth across, difference along.' };
    }
    case 'S07':
      return p.op === 'roberts'
        ? { title: 'Roberts 2×2', grids: [{ label: 'Gx', w: [[1, 0], [0, -1]] }, { label: 'Gy', w: [[0, 1], [-1, 0]] }], note: 'Diagonal differences.' }
        : { title: 'Prewitt 3×3', grids: [{ label: 'Gx', w: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]] }, { label: 'Gy', w: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]] }], note: 'Like Sobel without extra weight on the centre row.' };
    default:
      return null;
  }
}

/** Structuring element as a 0/1 grid, same shapes as cv.getStructuringElement. Pure. */
export function structuringElement(shape: string, kw: number, kh: number): number[][] {
  const g: number[][] = Array.from({ length: kh }, () => Array(kw).fill(0));
  const cx = (kw - 1) / 2, cy = (kh - 1) / 2;
  for (let y = 0; y < kh; y++)
    for (let x = 0; x < kw; x++) {
      if (shape === 'rect') g[y][x] = 1;
      else if (shape === 'cross') g[y][x] = x === Math.floor(cx) || y === Math.floor(cy) ? 1 : 0;
      else {
        const rx = Math.max(cx, 0.5), ry = Math.max(cy, 0.5);
        g[y][x] = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + 1e-9 ? 1 : 0;
      }
    }
  return g;
}
