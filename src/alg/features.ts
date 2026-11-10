import type { Cv, Mat, OverlayShape } from '../core/types';
import { binaryOf, grayOf, num, odd, str, type Runner } from './common';

/** Greedy non-maximum suppression of score peaks: keep the best, drop others within (w/2, h/2). Pure. */
export function suppressPeaks(res: Float32Array, rw: number, rh: number, thr: number, sw: number, sh: number): { x: number; y: number; score: number }[] {
  const cand: { x: number; y: number; score: number }[] = [];
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) if (res[y * rw + x] >= thr) cand.push({ x, y, score: res[y * rw + x] });
  cand.sort((a, b) => b.score - a.score);
  const kept: typeof cand = [];
  for (const c of cand) {
    if (kept.every((k) => Math.abs(k.x - c.x) > sw / 2 || Math.abs(k.y - c.y) > sh / 2)) kept.push(c);
  }
  return kept;
}

/** Local maxima of a float map above `thr`, within a (2r+1)² window. Pure. */
export function localMaxima(map: Float32Array, w: number, h: number, thr: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = map[y * w + x];
      if (v <= thr) continue;
      let ok = true;
      for (let dy = -r; dy <= r && ok; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || (dx === 0 && dy === 0)) continue;
          const o = map[yy * w + xx];
          if (o > v || (o === v && (dy < 0 || (dy === 0 && dx < 0)))) { ok = false; break; }
        }
      }
      if (ok) pts.push([x, y]);
    }
  return pts;
}

/** Hough accumulator (rho × theta) from a binary edge map; peaks marked. Pure. */
export function houghAccumulator(edges: ArrayLike<number>, w: number, h: number, nTheta = 180): { acc: Float32Array; rows: number; cols: number; peaks: [number, number][] } {
  const rhoMax = Math.ceil(Math.hypot(w, h));
  const rows = 2 * rhoMax + 1;
  const acc = new Float32Array(rows * nTheta);
  const cos = new Float32Array(nTheta), sin = new Float32Array(nTheta);
  for (let t = 0; t < nTheta; t++) { cos[t] = Math.cos((t * Math.PI) / nTheta); sin[t] = Math.sin((t * Math.PI) / nTheta); }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (edges[y * w + x]) for (let t = 0; t < nTheta; t++) acc[(Math.round(x * cos[t] + y * sin[t]) + rhoMax) * nTheta + t]++;
  let max = 0;
  for (let i = 0; i < acc.length; i++) if (acc[i] > max) max = acc[i];
  const peaks = localMaxima(acc, nTheta, rows, max * 0.5, 8).slice(0, 12);
  return { acc, rows, cols: nTheta, peaks };
}

function clampRect(p: Record<string, unknown>, W: number, H: number) {
  const x = Math.max(0, Math.min(W - 2, Math.round(Number(p.tx))));
  const y = Math.max(0, Math.min(H - 2, Math.round(Number(p.ty))));
  const w = Math.max(2, Math.min(W - x, Math.round(Number(p.tw))));
  const h = Math.max(2, Math.min(H - y, Math.round(Number(p.th))));
  return { x, y, w, h };
}

function copyAs8(_cv: Cv, input: Mat): Mat {
  return input.clone();
}

export const features: Record<string, Runner> = {
  FT01: ({ cv, input, params }) => {
    const g = grayOf(cv, input);
    const r = clampRect(params, g.cols, g.rows);
    const tpl = g.roi(new cv.Rect(r.x, r.y, r.w, r.h));
    const res = new cv.Mat();
    try {
      cv.matchTemplate(g, tpl, res, cv.TM_CCOEFF_NORMED);
      const thr = num(params, 'score');
      const data = new Float32Array(res.data32F);
      const hits = suppressPeaks(data, res.cols, res.rows, thr, r.w, r.h);
      const overlay: OverlayShape[] = hits.map((h) => ({ kind: 'rect', x: h.x, y: h.y, w: r.w, h: r.h, label: h.score.toFixed(2) }));
      return {
        mat: copyAs8(cv, input),
        vars: { x: r.x, y: r.y, w: r.w, h: r.h, score: thr, matches: hits.length },
        overlay,
        metrics: { matches: hits.length, best: hits.length ? hits[0].score : 0 },
        heatmap: { w: res.cols, h: res.rows, data, label: 'Match score (TM_CCOEFF_NORMED), −1 to 1' },
        summary: `${hits.length} matches at score ${thr} or higher.`,
      };
    } finally {
      g.delete();
      tpl.delete();
      res.delete();
    }
  },

  FT02: ({ cv, input, params }) => {
    const g = grayOf(cv, input);
    const dst = new cv.Mat();
    try {
      const block = Math.round(num(params, 'block'));
      const k = num(params, 'k');
      cv.cornerHarris(g, dst, block, 3, k);
      const d = dst.data32F;
      let max = 0;
      for (let i = 0; i < d.length; i++) if (d[i] > max) max = d[i];
      const frac = num(params, 'thr');
      const pts = localMaxima(new Float32Array(d), g.cols, g.rows, frac * max, 2);
      return {
        mat: copyAs8(cv, input),
        vars: { block, k, frac, n: pts.length },
        overlay: pts.map(([x, y]) => ({ kind: 'point', x, y }) as OverlayShape),
        metrics: { corners: pts.length },
        summary: `${pts.length} corners found.`,
      };
    } finally {
      g.delete();
      dst.delete();
    }
  },

  FT03: ({ cv, input, params }) => {
    const { mat: bin, T, invert } = binaryOf(cv, input, params);
    const contours = new cv.MatVector();
    const hier = new cv.Mat();
    try {
      cv.findContours(bin, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      const minArea = Math.round(num(params, 'minArea'));
      const overlay: OverlayShape[] = [];
      let largest = 0, count = 0;
      for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        try {
          if (cv.contourArea(c) < minArea) continue;
          count++;
          largest = Math.max(largest, c.rows);
          const pts: [number, number][] = [];
          const step = Math.max(1, Math.floor(c.rows / 400));
          for (let j = 0; j < c.rows; j += step) pts.push([c.data32S[j * 2], c.data32S[j * 2 + 1]]);
          overlay.push({ kind: 'poly', points: pts });
        } finally {
          c.delete();
        }
      }
      return {
        mat: copyAs8(cv, input),
        vars: { T, polarity: invert ? 'dark objects white' : 'bright objects white', count, largest, minArea },
        overlay,
        metrics: { contours: count, largestPoints: largest },
        summary: `${count} outer contours; the largest has ${largest} points.`,
      };
    } finally {
      bin.delete();
      contours.delete();
      hier.delete();
    }
  },

  FT04: ({ cv, input, params }) => {
    const g = grayOf(cv, input);
    const edges = new cv.Mat();
    const lines = new cv.Mat();
    try {
      const t1 = num(params, 't1'), t2 = num(params, 't2');
      cv.Canny(g, edges, t1, t2);
      const thr = Math.round(num(params, 'votes'));
      cv.HoughLinesP(edges, lines, 1, Math.PI / 180, thr, Math.round(num(params, 'minLen')), Math.round(num(params, 'maxGap')));
      const overlay: OverlayShape[] = [];
      const d = lines.data32S;
      for (let i = 0; i + 3 < d.length; i += 4) overlay.push({ kind: 'line', x1: d[i], y1: d[i + 1], x2: d[i + 2], y2: d[i + 3] });
      const acc = houghAccumulator(edges.data, edges.cols, edges.rows);
      return {
        mat: copyAs8(cv, input),
        vars: { t1, t2, votes: thr, minLen: Math.round(num(params, 'minLen')), maxGap: Math.round(num(params, 'maxGap')), n: overlay.length },
        overlay,
        metrics: { segments: overlay.length, edgePixels: edges.data.reduce((a, v) => a + (v ? 1 : 0), 0) },
        heatmap: { w: acc.cols, h: acc.rows, data: acc.acc, label: 'Hough accumulator: x = angle 0–180°, y = distance ρ; bright peaks are lines', marks: acc.peaks },
        summary: `${overlay.length} line segments found.`,
      };
    } finally {
      g.delete();
      edges.delete();
      lines.delete();
    }
  },

  FT05: ({ cv, input, params }) => {
    const g = grayOf(cv, input);
    const sm = new cv.Mat();
    const circles = new cv.Mat();
    try {
      const med = odd(num(params, 'median'));
      cv.medianBlur(g, sm, med);
      cv.HoughCircles(sm, circles, cv.HOUGH_GRADIENT, 1, num(params, 'minDist'), num(params, 'param1'), num(params, 'param2'), Math.round(num(params, 'rMin')), Math.round(num(params, 'rMax')));
      const overlay: OverlayShape[] = [];
      const d = circles.data32F;
      for (let i = 0; i + 2 < d.length; i += 3) overlay.push({ kind: 'circle', x: d[i], y: d[i + 1], r: d[i + 2] });
      return {
        mat: copyAs8(cv, input),
        vars: { med, minDist: num(params, 'minDist'), p1: num(params, 'param1'), p2: num(params, 'param2'), rMin: Math.round(num(params, 'rMin')), rMax: Math.round(num(params, 'rMax')), n: overlay.length },
        overlay,
        metrics: { circles: overlay.length },
        summary: `${overlay.length} circles found.`,
      };
    } finally {
      g.delete();
      sm.delete();
      circles.delete();
    }
  },
};
void str;
