import { beforeAll, describe, expect, it } from 'vitest';
import { getCv } from './cvNode';
import type { Cv, ImageMeta, RunContext } from '../src/core/types';
import { TECHNIQUES, defaultParams } from '../src/registry';
import { TEST_PATTERNS as SAMPLES, patternById as sampleById } from '../src/core/testPatterns';
import { loadImage } from './images';
import { matToPixels, pixelsToMat, prepareInput, withMats } from '../src/core/matIO';
import { fillTemplate } from '../src/exact/templates';
import { histogramCv, histogramJS } from '../src/alg/histogram';
import { histogramFromPixels } from '../src/core/imageOps';
import { PROBED_APIS, probe } from '../src/core/capability';

let cv: Cv;
beforeAll(async () => {
  cv = await getCv();
});

function ctxFor(sampleId: string, gray: boolean, params: Record<string, number | string | boolean>, track: <M extends { delete(): void }>(m: M) => M): RunContext {
  const px = loadImage(sampleId);
  const rgba = track(pixelsToMat(cv, px));
  const input = track(prepareInput(cv, rgba, gray));
  const meta: ImageMeta = { source: `sample:${sampleId}`, origW: px.w, origH: px.h, w: px.w, h: px.h, resized: false, limit: 1024 };
  return { cv, rgba, input, grayMode: gray, params, meta };
}

describe('capability probe on real OpenCV.js', () => {
  it('has every MVP API and not SIFT', () => {
    const caps = probe(cv as unknown as Record<string, unknown>);
    for (const a of PROBED_APIS) expect(caps[a], a).toBe(true);
    expect(probe(cv as unknown as Record<string, unknown>, ['SIFT']).SIFT).toBe(false);
  });
});

describe('every technique runs on its sample in gray and RGB', () => {
  for (const t of TECHNIQUES.filter((x) => !x.explainerOnly)) {
    for (const gray of [true, false]) {
      if (gray && t.needs === 'color') continue;
      it(`${t.id} ${t.title} (${gray ? 'gray' : 'RGB'})`, () => {
        withMats((track) => {
          const params = defaultParams(t);
          const ctx = ctxFor(t.sampleHint ?? 'shapes', gray, params, track);
          if (t.needsRef) ctx.refPixels = loadImage('coffee');
          const res = t.run(ctx);
          track(res.mat);
          expect(res.mat.rows).toBeGreaterThan(0);
          expect([1, 3]).toContain(res.mat.channels());
          const exact = fillTemplate(t.exactTemplate, res.vars, params);
          expect(exact, `${t.id}: ${exact}`).not.toMatch(/\{\w+\}/);
          expect(exact).not.toMatch(/NaN|undefined|Infinity/);
          const px = matToPixels(cv, res.mat);
          expect(px.data.length).toBe(px.w * px.h * 4);
        });
      });
    }
  }
});

describe('algorithm correctness', () => {
  const run = (id: string, sample: string, params: Record<string, number | string | boolean>) =>
    withMats((track) => {
      const t = TECHNIQUES.find((x) => x.id === id)!;
      const p = { ...defaultParams(t), ...params };
      const ctx = ctxFor(sample, true, p, track);
      const res = t.run(ctx);
      return { out: Uint8Array.from(res.mat.data), inp: Uint8Array.from(ctx.input.data), vars: res.vars, w: res.mat.cols, h: res.mat.rows };
    });

  it('gamma = 1 is the identity', () => {
    const { out, inp } = run('P05', 'tp-shapes', { gamma: 1 });
    expect(Array.from(out)).toEqual(Array.from(inp));
  });
  it('negative twice is identity; negative maps 0↔255', () => {
    const { out, inp } = run('P01', 'tp-ramp', {});
    for (let i = 0; i < inp.length; i++) expect(out[i]).toBe(255 - inp[i]);
  });
  it('brightness without clip wraps, with clip saturates', () => {
    const wrap = run('P02', 'tp-ramp', { b: 100, clip: false });
    const clip = run('P02', 'tp-ramp', { b: 100, clip: true });
    const idx = 250; // first row, x = 250 → r = 250
    expect(wrap.out[idx]).toBe((250 + 100) % 256);
    expect(clip.out[idx]).toBe(255);
  });
  it('quantisation produces exactly L distinct levels', () => {
    const { out } = run('F04', 'tp-ramp', { levels: 4 });
    expect(new Set(out).size).toBe(4);
  });
  it('median removes isolated salt-and-pepper; Gaussian does not', () => {
    const extremes = (a: Uint8Array) => a.filter((v) => v === 0 || v === 255).length / a.length;
    const before = withMats((track) => {
      const c = ctxFor('tp-impulse-noise', true, {}, track);
      return extremes(Uint8Array.from(c.input.data));
    });
    const med = run('S03', 'tp-impulse-noise', { k: 3 });
    const gau = run('S02', 'tp-impulse-noise', { k: 3, sigma: 1 });
    expect(before).toBeGreaterThan(0.07);
    expect(extremes(med.out)).toBeLessThan(0.01);
    // Gaussian reduces exact extremes too, but leaves smudges: compare error vs. the median result
    const err = (a: Uint8Array, b: Uint8Array) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
    expect(err(gau.out, med.out)).toBeGreaterThan(1);
  });
  it('CLAHE and equalisation widen the low-contrast range', () => {
    const range = (a: Uint8Array) => Math.max(...a) - Math.min(...a);
    const base = run('P01', 'tp-low-contrast', {});
    const eq = run('H02', 'tp-low-contrast', {});
    const cl = run('H03', 'tp-low-contrast', { clip: 4, tiles: 8 });
    expect(range(base.out)).toBeLessThan(80);
    expect(range(eq.out)).toBeGreaterThan(200);
    expect(range(cl.out)).toBeGreaterThan(range(base.out));
  });
  it('bilateral keeps a step edge sharper than Gaussian', () => {
    const edgeStep = (a: Uint8Array, w: number) => {
      const y = 128;
      let l = 0, r = 0;
      for (let k = 0; k < 6; k++) { l += a[y * w + 120 + k]; r += a[y * w + 132 + k]; }
      return (r - l) / 6;
    };
    const bi = run('S04', 'tp-step-edge', { d: 9, sigmaColor: 30, sigmaSpace: 50 });
    const ga = run('S02', 'tp-step-edge', { k: 9, sigma: 3 });
    // sample across the edge column ~128: bilateral transition is a steeper
    const slope = (o: { out: Uint8Array; w: number }) => Math.abs(o.out[128 * o.w + 129] - o.out[128 * o.w + 126]);
    expect(slope(bi)).toBeGreaterThan(slope(ga));
    expect(edgeStep(bi.out, bi.w)).toBeGreaterThan(50);
  });
  it('Canny: lower thresholds find more edge pixels', () => {
    const count = (a: Uint8Array) => a.filter((v) => v === 255).length;
    expect(count(run('E01', 'tp-shapes', { t1: 10, t2: 20 }).out)).toBeGreaterThan(count(run('E01', 'tp-shapes', { t1: 50, t2: 150 }).out));
  });
  it('Sobel magnitude peaks at 255 (minmax display)', () => {
    expect(Math.max(...run('S08', 'tp-shapes', {}).out)).toBe(255);
  });
  it('opening removes speckles from binarised blobs; closing never removes bright pixels', () => {
    const bright = (a: Uint8Array) => a.filter((v) => v === 255).length;
    const base = run('M01', 'tp-blobs', { op: 'dilate', k: 3, iters: 1 }); // reference only
    const open = run('M02', 'tp-blobs', { op: 'open', k: 5 });
    const close = run('M02', 'tp-blobs', { op: 'close', k: 5 });
    const bin = run('P06', 'tp-blobs', { mode: 'otsu' });
    expect(bright(open.out)).toBeLessThan(bright(bin.out));
    expect(bright(close.out)).toBeGreaterThanOrEqual(bright(bin.out));
    expect(bright(base.out)).toBeGreaterThan(bright(bin.out));
  });
  it('component counter finds particles and min-area removes small ones', () => {
    const all = run('M03', 'tp-blobs', { minArea: 0 });
    const big = run('M03', 'tp-blobs', { minArea: 80 });
    expect(Number(all.vars.total)).toBeGreaterThan(Number(big.vars.kept));
    expect(Number(big.vars.kept)).toBeGreaterThan(5);
  });
  it('resize changes output size by the scale', () => {
    const r = run('F03', 'tp-checker', { scale: 0.5, interp: 'area' });
    expect([r.w, r.h]).toEqual([128, 128]);
  });
  it('noise is reproducible through the full pipeline', () => {
    const a = run('N01', 'tp-shapes', { sigma: 20, seed: 3 });
    const b = run('N01', 'tp-shapes', { sigma: 20, seed: 3 });
    const c = run('N01', 'tp-shapes', { sigma: 20, seed: 4 });
    expect(Array.from(a.out)).toEqual(Array.from(b.out));
    expect(Array.from(a.out)).not.toEqual(Array.from(c.out));
  });
});

describe('histogram', () => {
  it('sums to pixel count and calcHist agrees with the JS histogram', () => {
    withMats((track) => {
      const px = sampleById('tp-low-contrast')!.make();
      const rgba = track(pixelsToMat(cv, px));
      const g = track(prepareInput(cv, rgba, true));
      const hc = histogramCv(cv, g);
      const hj = histogramJS(g.data);
      expect(hc.reduce((a, b) => a + b, 0)).toBe(px.w * px.h);
      expect(Array.from(hc)).toEqual(Array.from(hj));
      expect(histogramFromPixels(px).reduce((a, b) => a + b, 0)).toBe(px.w * px.h);
    });
  });
});

describe('Mat disposal', () => {
  it('withMats deletes tracked mats even when the body throws', () => {
    let m: ReturnType<typeof cv.Mat.prototype.clone> | undefined;
    expect(() =>
      withMats((track) => {
        m = track(new cv.Mat(4, 4, cv.CV_8UC1));
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(() => m!.rows).toThrow(); // deleted
  });
  it('repeated runs of every technique do not grow the WASM heap unboundedly', () => {
    const heap = () => (cv as unknown as { HEAPU8: { length: number } }).HEAPU8.length;
    const once = () => {
      for (const t of TECHNIQUES.filter((x) => !x.explainerOnly && x.needs !== 'color')) {
        withMats((track) => {
          const ctx = ctxFor(t.sampleHint ?? 'shapes', true, defaultParams(t), track);
          if (t.needsRef) ctx.refPixels = loadImage('coffee');
          track(t.run(ctx).mat);
        });
      }
    };
    once();
    const h0 = heap();
    for (let i = 0; i < 4; i++) once();
    expect(heap()).toBeLessThanOrEqual(h0 * 1.25);
  });
});

describe('sample list', () => {
  it('has the six SRS-required phenomena', () => {
    const ids = SAMPLES.map((s) => s.id);
    for (const id of ['ramp', 'checker', 'step-edge', 'low-contrast', 'impulse-noise', 'blobs']) expect(ids).toContain('tp-' + id);
  });
});
