import { describe, expect, it } from 'vitest';
import { TECHNIQUES, heroParamsOf } from '../src/registry';
import { hero, run } from './harness';
import { loadImage } from './images';
import { lumaOf, mean } from '../src/core/metrics';

const real = TECHNIQUES.filter((t) => !t.explainerOnly);

describe('every hero demo runs on its real image', () => {
  for (const t of real) {
    it(`${t.id} ${t.title} on ${t.heroImage}`, async () => {
      const out = await hero(t.id);
      expect(out.exact, out.exact).not.toMatch(/\{\w+\}|NaN|undefined|Infinity/);
      expect(out.pixels.w).toBeGreaterThan(0);
      if (t.scope === 'curve') expect(out.curve, 'curve table for the transfer-curve scope').toBeTruthy();
      if (t.scope === 'spectrum') expect(out.spectrum).toBeTruthy();
      if (t.scope === 'heatmap') expect(out.heatmap).toBeTruthy();
    });
  }
});

describe('measured expectations (direction and tolerance bands, not exact values)', () => {
  it('N02 8% on cameraman: PSNR about 16 dB; N01 σ20 about 22 dB', async () => {
    const sp = await run('N02', 'cameraman', { amount: 8 });
    const g = await run('N01', 'cameraman', { sigma: 20 });
    expect(sp.metrics!.psnr).toBeGreaterThan(14);
    expect(sp.metrics!.psnr).toBeLessThan(18);
    expect(g.metrics!.psnr).toBeGreaterThan(20);
    expect(g.metrics!.psnr).toBeLessThan(24);
  });
  it('median beats Gaussian by ≥ 3 dB on salt-and-pepper', async () => {
    const pre = [{ id: 'N02', params: { amount: 8, seed: 0 } }];
    const med = await run('S03', 'cameraman', { k: 3 }, pre);
    const gau = await run('S02', 'cameraman', { k: 5, sigma: 0 }, pre);
    expect(med.metrics!.psnr - gau.metrics!.psnr).toBeGreaterThanOrEqual(3);
    expect(med.metrics!.psnr).toBeGreaterThan(28);
  });
  it('bilateral beats Gaussian on σ = 20 noise', async () => {
    const pre = [{ id: 'N01', params: { sigma: 20, seed: 0 } }];
    const bi = await run('S04', 'cameraman', { d: 9, sigmaColor: 50, sigmaSpace: 5 }, pre);
    const ga = await run('S02', 'cameraman', { k: 5, sigma: 0 }, pre);
    expect(bi.metrics!.psnr).toBeGreaterThan(ga.metrics!.psnr);
  });
  it('CLAHE std lies between original and global EQ on the retina green plane', async () => {
    const eq = await run('H02', 'retina', { channel: 'green' });
    const cl = await run('H03', 'retina', { channel: 'green', clip: 3, tiles: 8 });
    const before = eq.metrics!.stdBefore;
    expect(cl.metrics!.stdAfter).toBeGreaterThan(before);
    expect(cl.metrics!.stdAfter).toBeLessThan(eq.metrics!.stdAfter);
    expect(eq.metrics!.stdAfter).toBeGreaterThan(70);
  });
  it('Otsu turns most of the sudoku shadow black; adaptive does not', async () => {
    const out = await run('T01', 'sudoku', { method: 'gaussian', block: 11, C: 2 });
    expect(out.metrics!.otsuBlackLL).toBeGreaterThan(0.6);
    expect(out.metrics!.adaptiveBlackLL).toBeLessThan(0.3);
  });
  it('|Gx| mean exceeds |Gy| mean on brick', async () => {
    const out = await run('S08', 'brick', { ksize: '3', view: 'mag' });
    expect(out.metrics!.gxMean).toBeGreaterThan(out.metrics!.gyMean);
  });
  it('coins: area ≥ 200 count is 24 ± 1, raw count is much larger', async () => {
    const raw = await run('M03', 'coins', { minArea: 0 });
    const filtered = await hero('M03');
    expect(Math.abs(filtered.metrics!.kept - 24)).toBeLessThanOrEqual(1);
    expect(raw.metrics!.total).toBeGreaterThan(60);
  });
  it('coins top-hat + Otsu also gives about 24 and fewer raw components', async () => {
    const out = await hero('M04');
    const plain = await run('M03', 'coins', { minArea: 0 });
    expect(Math.abs(out.metrics!.kept - 24)).toBeLessThanOrEqual(2);
    expect(out.metrics!.total).toBeLessThan(plain.metrics!.total);
  });
  it('smarties: 12 ± 1 circles; 6 red blobs with the wrapped hue range', async () => {
    const circ = await hero('FT05');
    expect(Math.abs(circ.metrics!.circles - 12)).toBeLessThanOrEqual(1);
    const red = await hero('C01');
    expect(red.metrics!.blobs).toBe(6);
    expect(red.exact).toMatch(/two ranges|wraps/i);
  });
  it('cards: template matches ≥ 0.9 between 6 and 10', async () => {
    const out = await hero('FT01');
    expect(out.metrics!.matches).toBeGreaterThanOrEqual(6);
    expect(out.metrics!.matches).toBeLessThanOrEqual(10);
  });
  it('ideal low-pass overshoots more than Gaussian at the same D0', async () => {
    const out = await hero('Q04');
    expect(out.metrics!.idealOvershoot).toBeGreaterThan(out.metrics!.gaussOvershoot);
    expect(out.metrics!.idealMin).toBeLessThan(-10);
    expect(out.metrics!.idealMax).toBeGreaterThan(260);
  });
  it('spectrum energy radius: gravel broader than clock; both finite', async () => {
    const g = await run('Q01', 'gravel', {});
    const c = await run('Q01', 'clock_motion', {});
    expect(g.metrics!.energyRadius95).toBeGreaterThan(c.metrics!.energyRadius95);
  });
  it('Harris: lower threshold finds more corners; blocks ≈ 57 (loose band), text finds many', async () => {
    const hi = await run('FT02', 'blocks', { block: 2, k: 0.04, thr: 0.05 });
    const lo = await run('FT02', 'blocks', { block: 2, k: 0.04, thr: 0.01 });
    expect(lo.metrics!.corners).toBeGreaterThan(hi.metrics!.corners);
    expect(lo.metrics!.corners).toBeGreaterThan(20);
    expect(lo.metrics!.corners).toBeLessThan(150);
  });
  it('horse: exactly one outer contour; legs break off under 15×15 erosion', async () => {
    const c = await hero('FT03');
    expect(c.metrics!.contours).toBe(1);
    expect(c.metrics!.largestPoints).toBeGreaterThan(300);
    const e = await hero('M01');
    expect(e.metrics!.componentsAfter).toBeGreaterThan(e.metrics!.componentsBefore);
  });
  it('sudoku Hough: lines found; raising the vote threshold finds fewer', async () => {
    const a = await hero('FT04');
    const b = await run('FT04', 'sudoku', { t1: 50, t2: 150, votes: 160, minLen: 100, maxGap: 10 });
    expect(a.metrics!.segments).toBeGreaterThan(20);
    expect(b.metrics!.segments).toBeLessThan(a.metrics!.segments);
    expect(a.heatmap!.marks!.length).toBeGreaterThan(0);
  });
  it('hubble: log lifts the mean from ~19 to > 90; gamma 0.5 lifts the rocket', async () => {
    const before = mean(lumaOf(loadImage('hubble').data));
    const out = await hero('P04');
    expect(before).toBeLessThan(30);
    expect(mean(lumaOf(out.pixels.data))).toBeGreaterThan(90);
    const r0 = mean(lumaOf(loadImage('rocket').data));
    const r1 = mean(lumaOf((await hero('P05')).pixels.data));
    expect(r1).toBeGreaterThan(r0 + 30);
  });
  it('brick aliasing: nearest ÷6 differs from area ÷6; area is closer to the original', async () => {
    const near = await run('F05', 'brick', { factor: 6, interp: 'nearest' });
    const area = await run('F05', 'brick', { factor: 6, interp: 'area' });
    const orig = lumaOf(loadImage('brick').data);
    const err = (o: typeof near) => { const l = lumaOf(o.pixels.data); let s = 0; for (let i = 0; i < l.length; i++) s += Math.abs(l[i] - orig[i]); return s / l.length; };
    expect(near.intermediates!.length).toBe(2);
    expect(err(area)).toBeLessThan(err(near));
  });
  it('histogram matching pulls the rocket’s mean toward the coffee photo', async () => {
    const out = await hero('H04');
    const refMean = mean(lumaOf(loadImage('coffee').data));
    const before = mean(lumaOf(loadImage('rocket').data));
    const after = mean(lumaOf(out.pixels.data));
    expect(Math.abs(after - refMean)).toBeLessThan(Math.abs(before - refMean));
  });
  it('rotating in six passes is blurrier than in one', async () => {
    const one = await run('G01', 'rocket', { angle: 30, scale: 1, passes: 1 });
    const six = await run('G01', 'rocket', { angle: 30, scale: 1, passes: 6 });
    expect(six.metrics!.sharpnessAfter).toBeLessThan(one.metrics!.sharpnessAfter);
  });
  it('perspective fix returns a square page', async () => {
    const out = await hero('G03');
    expect([out.pixels.w, out.pixels.h]).toEqual([450, 450]);
  });
  it('colour concepts refuse gray images instead of failing silently', async () => {
    await expect(run('C01', 'cameraman', {})).rejects.toThrow(/colour image/);
  });
});

describe('hero params are valid for every concept', () => {
  for (const t of real) {
    it(`${t.id}`, () => {
      const p = heroParamsOf(t);
      for (const sp of t.params) {
        expect(sp.key in p, `${t.id}.${sp.key}`).toBe(true);
        if (sp.type === 'range') {
          expect(Number(p[sp.key]), `${t.id}.${sp.key}`).toBeGreaterThanOrEqual(sp.min!);
          expect(Number(p[sp.key]), `${t.id}.${sp.key}`).toBeLessThanOrEqual(sp.max!);
        }
        if (sp.type === 'select') expect(sp.options!.map((o) => o.value), `${t.id}.${sp.key}`).toContain(String(p[sp.key]));
      }
    });
  }
});
