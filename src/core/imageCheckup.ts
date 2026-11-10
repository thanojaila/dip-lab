import { lumaOf, laplacianVariance } from './metrics';
import type { Pixels } from './matIO';

export interface Suggestion {
  id: string;
  /** Friendly, hedged text (a suggestion, not a diagnosis). */
  text: string;
  /** Concept ids to try. */
  concepts: string[];
}

export interface CheckupStats {
  p1: number;
  p99: number;
  range: number;
  fracDark: number;
  fracExtreme: number;
  isolatedExtremeFrac: number;
  otsuT: number;
  otsuSeparation: number;
  lapVar: number;
}

/** Otsu threshold and normalised between-class variance (0..1, higher = cleaner two-level split). Pure. */
export function otsu(hist: ArrayLike<number>): { t: number; separation: number } {
  let n = 0, sum = 0;
  for (let i = 0; i < 256; i++) { n += hist[i]; sum += i * hist[i]; }
  if (!n) return { t: 0, separation: 0 };
  let wB = 0, sumB = 0, best = -1, t = 0;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; t = i; }
  }
  const mean = sum / n;
  let total = 0;
  for (let i = 0; i < 256; i++) total += hist[i] * (i - mean) ** 2;
  return { t, separation: total > 0 ? best / n / total : 0 };
}

export function checkupStats(p: Pixels): CheckupStats {
  const g = lumaOf(p.data);
  const n = g.length;
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[g[i]]++;
  const pct = (q: number) => {
    let c = 0;
    for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= q * n) return v; }
    return 255;
  };
  const p1 = pct(0.01), p99 = pct(0.99);
  let dark = 0;
  for (let v = 0; v < 40; v++) dark += hist[v];
  const extremes = hist[0] + hist[255];
  // An "isolated" extreme differs from all 4 neighbours by a lot: the signature of impulse noise.
  let isolated = 0;
  for (let y = 1; y < p.h - 1; y++)
    for (let x = 1; x < p.w - 1; x++) {
      const i = y * p.w + x, v = g[i];
      if (v !== 0 && v !== 255) continue;
      if (Math.abs(v - g[i - 1]) > 100 && Math.abs(v - g[i + 1]) > 100 && Math.abs(v - g[i - p.w]) > 100 && Math.abs(v - g[i + p.w]) > 100) isolated++;
    }
  const o = otsu(hist);
  return { p1, p99, range: p99 - p1, fracDark: dark / n, fracExtreme: extremes / n, isolatedExtremeFrac: isolated / n, otsuT: o.t, otsuSeparation: o.separation, lapVar: laplacianVariance(g, p.w, p.h) };
}

/** Friendly suggestions linking to concepts (SRS v2 §5.3). Thresholds follow the brief. */
export function suggest(s: CheckupStats): Suggestion[] {
  const out: Suggestion[] = [];
  if (s.range < 100) out.push({ id: 'low-contrast', text: 'Low contrast: most pixels sit in a narrow band. Try Contrast stretch or CLAHE.', concepts: ['P03', 'H03'] });
  if (s.fracDark > 0.6) out.push({ id: 'dark', text: 'Mostly dark: over 60% of pixels are very dark. Try Gamma below 1 or Log.', concepts: ['P05', 'P04'] });
  if (s.fracExtreme > 0.01 && s.isolatedExtremeFrac > 0.005) out.push({ id: 'impulse', text: 'Looks like it may have impulse noise (isolated black and white pixels). Try Median.', concepts: ['S03'] });
  if (s.otsuSeparation < 0.55) out.push({ id: 'no-split', text: 'No clean two-level split in the histogram, so one global threshold may struggle. Try Adaptive threshold.', concepts: ['T01'] });
  if (s.lapVar < 40) out.push({ id: 'soft', text: 'Soft image: little fine detail. Sharpening can crisp existing edges but cannot restore lost detail.', concepts: ['S05'] });
  else if (s.lapVar > 600) out.push({ id: 'detailed', text: 'Lots of fine detail. Smoothing will remove some of it; try Bilateral to keep edges.', concepts: ['S04'] });
  return out;
}
