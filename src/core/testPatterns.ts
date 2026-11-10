import { createRng } from './prng';
import type { Pixels } from './matIO';

export interface TestPattern {
  id: string;
  title: string;
  /** One-line "teaches …" blurb (SRS §6.4). */
  teaches: string;
  make: () => Pixels;
}

const S = 256;

function blank(w = S, h = S): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { w, h, data };
}
function set(p: Pixels, x: number, y: number, r: number, g: number, b: number) {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
  const o = (y * p.w + x) * 4;
  p.data[o] = r;
  p.data[o + 1] = g;
  p.data[o + 2] = b;
}
function disc(p: Pixels, cx: number, cy: number, rad: number, r: number, g: number, b: number) {
  for (let y = Math.floor(cy - rad); y <= cy + rad; y++)
    for (let x = Math.floor(cx - rad); x <= cx + rad; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) set(p, x, y, r, g, b);
}
function rect(p: Pixels, x0: number, y0: number, w: number, h: number, r: number, g: number, b: number) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(p, x, y, r, g, b);
}
function addNoise(p: Pixels, sigma: number, seed: number) {
  const rng = createRng(seed);
  for (let i = 0; i < p.data.length; i += 4) {
    const n = sigma * rng.gauss(); // same offset on R,G,B: luminance noise
    p.data[i] += n;
    p.data[i + 1] += n;
    p.data[i + 2] += n;
  }
}
function saltPepperPixels(p: Pixels, amount: number, seed: number) {
  const rng = createRng(seed);
  for (let i = 0; i < p.w * p.h; i++) {
    const r = rng.next();
    if (r < amount) {
      const v = r < amount / 2 ? 0 : 255;
      p.data[i * 4] = p.data[i * 4 + 1] = p.data[i * 4 + 2] = v;
    }
  }
}

function smoothScene(): Pixels {
  const p = blank();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = 70 + (x / S) * 60 + (y / S) * 30;
    set(p, x, y, v, v, v);
  }
  disc(p, 90, 100, 45, 215, 215, 215);
  rect(p, 150, 50, 70, 120, 40, 40, 40);
  disc(p, 170, 200, 25, 160, 160, 160);
  return p;
}

export const TEST_PATTERNS: TestPattern[] = [
  {
    id: 'tp-ramp',
    title: 'Gray ramp',
    teaches: 'quantization banding and clipping: a perfectly smooth 0→255 gradient shows every artifact.',
    make: () => {
      const p = blank();
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(p, x, y, x, x, x);
      return p;
    },
  },
  {
    id: 'tp-checker',
    title: 'Checkerboard + fine stripes',
    teaches: 'sampling/aliasing and interpolation: hard edges and 1-pixel stripes expose how resizing treats detail.',
    make: () => {
      const p = blank();
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let v: number;
        if (y >= 200) v = x % 2 === 0 ? 235 : 20;
        else v = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 225 : 30;
        set(p, x, y, v, v, v);
      }
      return p;
    },
  },
  {
    id: 'tp-step-edge',
    title: 'Noisy step edge',
    teaches: 'edge preservation: Gaussian blur smears the step, bilateral keeps it while still cleaning the flat areas.',
    make: () => {
      const p = blank();
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const v = x < S / 2 ? 80 : 170;
        set(p, x, y, v, v, v);
      }
      addNoise(p, 10, 7);
      return p;
    },
  },
  {
    id: 'tp-low-contrast',
    title: 'Low-contrast scene',
    teaches: 'point processing and histograms: all values sit in a narrow band, so stretch, gamma, equalisation and CLAHE all help.',
    make: () => {
      const p = blank();
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const v = 95 + (x / S) * 25 + (y / S) * 10;
        set(p, x, y, v, v, v);
      }
      disc(p, 85, 95, 42, 132, 132, 132);
      rect(p, 150, 50, 70, 120, 98, 98, 98);
      disc(p, 170, 205, 24, 118, 118, 118);
      addNoise(p, 2, 3);
      return p;
    },
  },
  {
    id: 'tp-impulse-noise',
    title: 'Salt-and-pepper scene',
    teaches: 'nonlinear filtering: 8% of pixels are exactly 0 or 255, so median removes them and Gaussian smears them.',
    make: () => {
      const p = smoothScene();
      saltPepperPixels(p, 0.08, 11);
      return p;
    },
  },
  {
    id: 'tp-blobs',
    title: 'Particles with speckles',
    teaches: 'thresholding and morphology: bright blobs on a dark field, plus 1–2 px speckles and holes for opening, closing and counting.',
    make: () => {
      const p = blank();
      rect(p, 0, 0, S, S, 25, 25, 25);
      const rng = createRng(5);
      for (let i = 0; i < 22; i++) {
        const r = 7 + rng.next() * 11;
        disc(p, r + rng.next() * (S - 2 * r), r + rng.next() * (S - 2 * r), r, 205, 205, 205);
      }
      for (let i = 0; i < 140; i++) disc(p, rng.next() * S, rng.next() * S, rng.next() < 0.5 ? 0.6 : 1.4, 205, 205, 205); // bright specks
      for (let i = 0; i < 90; i++) disc(p, rng.next() * S, rng.next() * S, 1.2, 25, 25, 25); // holes (many land inside blobs)
      addNoise(p, 8, 9);
      return p;
    },
  },
  {
    id: 'tp-shapes',
    title: 'Colored shapes (mild noise)',
    teaches: 'edges and sharpening: clear boundaries with a little noise, so Sobel, Canny thresholds and unsharp masking behave visibly.',
    make: () => {
      const p = blank();
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(p, x, y, 60 + x * 0.25, 70 + y * 0.2, 90);
      rect(p, 30, 40, 80, 60, 220, 80, 70);
      disc(p, 185, 85, 40, 80, 150, 230);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - 90, y - 190);
        if (d > 26 && d < 40) set(p, x, y, 240, 220, 90);
      }
      rect(p, 170, 170, 60, 50, 235, 235, 235);
      addNoise(p, 6, 13);
      return p;
    },
  },
];

/** Only these three are offered on the shelf; the rest remain for tests and old config files. */
export const SHELF_PATTERN_IDS = ['tp-ramp', 'tp-checker', 'tp-step-edge'];
export const patternById = (id: string): TestPattern | undefined => TEST_PATTERNS.find((s) => s.id === id);

export const TP_IDS = TEST_PATTERNS.map((p) => p.id);
