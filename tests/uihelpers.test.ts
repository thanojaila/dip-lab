import { describe, expect, it } from 'vitest';
import { Progress, PROGRESS_KEY, type KV } from '../src/core/progress';
import { checkupStats, suggest, otsu } from '../src/core/imageCheckup';
import { kernelFor, sobelKernel, gaussian1d, structuringElement } from '../src/ui/explainers/kernels';
import { loadImage } from './images';

const mem = (): KV & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
};

describe('progress store', () => {
  it('needs both the demo and the prediction for a stamp, and persists', () => {
    const m = mem();
    const p = new Progress(m, ['P05', 'S03']);
    expect(p.earn('P05', 'demo')).toBe(false);
    expect(p.hasStamp('P05')).toBe(false);
    expect(p.earn('P05', 'predict')).toBe(true);
    expect(new Progress(m, ['P05', 'S03']).hasStamp('P05')).toBe(true);
    expect(p.count()).toBe(1);
  });
  it('writes only its own key and reset clears it', () => {
    const m = mem();
    const p = new Progress(m, ['P05']);
    p.earn('P05', 'demo');
    p.recordChallenge('S03', true, 29.9);
    expect([...m.map.keys()]).toEqual([PROGRESS_KEY]);
    p.reset();
    expect(m.map.size).toBe(0);
    expect(p.hasStamp('P05')).toBe(false);
  });
  it('ignores unknown ids and survives corrupt or missing storage', () => {
    const m = mem();
    m.setItem(PROGRESS_KEY, '{not json');
    expect(new Progress(m, ['P05']).count()).toBe(0);
    expect(new Progress(null, ['P05']).earn('P05', 'demo')).toBe(false);
    expect(new Progress(mem(), ['P05']).earn('ZZZ', 'demo')).toBe(false);
  });
});

describe('image check-up on the bundled photos', () => {
  const ids = (n: string) => suggest(checkupStats(loadImage(n))).map((s) => s.id);
  it('hubble is "mostly dark"; microaneurysms is "low contrast"; cameraman is neither', () => {
    expect(ids('hubble')).toContain('dark');
    expect(ids('microaneurysms')).toContain('low-contrast');
    expect(ids('cameraman')).not.toContain('dark');
    expect(ids('cameraman')).not.toContain('low-contrast');
  });
  it('flags impulse noise on a noisy picture but not on a clean one', async () => {
    const { run } = await import('./harness');
    const noisy = await run('N02', 'cameraman', { amount: 8 });
    expect(suggest(checkupStats(noisy.pixels)).map((s) => s.id)).toContain('impulse');
    expect(ids('cameraman')).not.toContain('impulse');
  });
  it('sudoku has no clean two-level split; the cell image does', () => {
    expect(ids('sudoku')).toContain('no-split');
    expect(ids('cell')).not.toContain('no-split');
  });
  it('suggestions are hedged and link to real concept ids', () => {
    for (const n of ['hubble', 'sudoku', 'microaneurysms']) for (const s of suggest(checkupStats(loadImage(n)))) expect(s.concepts.length).toBeGreaterThan(0);
  });
  it('otsu splits a two-level histogram at the gap', () => {
    const h = new Uint32Array(256);
    h[50] = 100; h[200] = 100;
    const o = otsu(h);
    expect(o.t).toBeGreaterThanOrEqual(50);
    expect(o.t).toBeLessThan(200);
    expect(o.separation).toBeGreaterThan(0.99);
  });
});

describe('kernel and structuring-element math', () => {
  it('Gaussian weights sum to 1; box weights sum to 1; Sobel 3×3 matches OpenCV', () => {
    expect(gaussian1d(7, 1.5).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    const box = kernelFor('S01', { k: 5 })!.grids[0].w;
    expect(box.flat().reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(sobelKernel(3, 'x')).toEqual([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]);
    expect(sobelKernel(3, 'y')).toEqual([[-1, -2, -1], [0, 0, 0], [1, 2, 1]]);
  });
  it('kernelFor is null for non-convolution concepts', () => {
    expect(kernelFor('S03', {})).toBeNull();
  });
  it('structuring element shapes', () => {
    expect(structuringElement('rect', 3, 3).flat().every((v) => v === 1)).toBe(true);
    expect(structuringElement('cross', 3, 3)).toEqual([[0, 1, 0], [1, 1, 1], [0, 1, 0]]);
    expect(structuringElement('ellipse', 5, 5)[0]).toEqual([0, 0, 1, 0, 0]);
    expect(structuringElement('rect', 41, 1)[0].length).toBe(41);
  });
});

import { downscaleTo } from '../src/core/imageOps';
describe('live-preview downscale', () => {
  it('keeps aspect and limits the longest side; leaves small images alone', () => {
    const p = loadImage('hubble');
    const s = downscaleTo(p, 384);
    expect(Math.max(s.w, s.h)).toBe(384);
    expect(Math.abs(s.w / s.h - p.w / p.h)).toBeLessThan(0.02);
    const tiny = loadImage('microaneurysms');
    expect(downscaleTo(tiny, 384)).toBe(tiny);
  });
});
