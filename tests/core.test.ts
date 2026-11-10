import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/prng';
import { planResize, sniffImageType, validateUpload, MAX_BYTES } from '../src/core/resizePolicy';
import { missingApis, probe } from '../src/core/capability';
import { exportConfig, importConfig } from '../src/core/config';
import { TECHNIQUES } from '../src/registry';
import { TEST_PATTERNS as SAMPLES, TP_IDS } from '../src/core/testPatterns';
import { diffPixels, histogramFromPixels, resizeNearest } from '../src/core/imageOps';
import { fillTemplate } from '../src/exact/templates';
import { percentileBounds } from '../src/alg/point';
import { gaussianNoise, saltPepper } from '../src/alg/noise';

describe('prng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = createRng(0), b = createRng(0), c = createRng(1);
    const sa = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(sa);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(sa);
  });
  it('gauss has ≈ zero mean and unit variance', () => {
    const r = createRng(42);
    const xs = Array.from({ length: 20000 }, () => r.gauss());
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const v = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(v - 1)).toBeLessThan(0.05);
  });
});

describe('noise helpers', () => {
  it('seeded noise is reproducible and saturates', () => {
    const src = new Uint8Array(1000).fill(250);
    const a = gaussianNoise(src, 30, 0), b = gaussianNoise(src, 30, 0);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Math.max(...a)).toBe(255);
  });
  it('salt-pepper corrupts about `amount` of pixels with only 0/255', () => {
    const src = new Uint8Array(20000).fill(100);
    const out = saltPepper(src, 1, 0.1, 0);
    const bad = out.filter((v) => v !== 100);
    expect(bad.length / out.length).toBeGreaterThan(0.08);
    expect(bad.length / out.length).toBeLessThan(0.12);
    expect(bad.every((v) => v === 0 || v === 255)).toBe(true);
  });
});

describe('upload policy', () => {
  it('plans resize with longest side limit', () => {
    expect(planResize(800, 600)).toEqual({ w: 800, h: 600, resized: false });
    expect(planResize(4000, 3000)).toEqual({ w: 1024, h: 768, resized: true });
  });
  it('sniffs real types and rejects SVG/GIF', () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]))).toBe('image/png');
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode('GIF89a......'))).toBeNull();
  });
  it('validateUpload enforces size, declared type and contents', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
    expect(validateUpload(1000, 'image/png', png).ok).toBe(true);
    expect(validateUpload(MAX_BYTES + 1, 'image/png', png).ok).toBe(false);
    expect(validateUpload(10, 'image/svg+xml', png).ok).toBe(false);
    expect(validateUpload(10, 'image/png', new Uint8Array([1, 2, 3])).ok).toBe(false); // spoofed type
  });
});

describe('capability probe', () => {
  it('marks missing APIs unavailable', () => {
    const caps = probe({ blur: () => 0 }, ['blur', 'bilateralFilter']);
    expect(caps).toEqual({ blur: true, bilateralFilter: false });
    const spec = TECHNIQUES.find((t) => t.id === 'S04')!;
    expect(missingApis(spec, caps)).toEqual(['bilateralFilter']);
  });
});

describe('config share', () => {
  it('round-trips params and contains no image data', () => {
    const cfg = exportConfig('P05', { gamma: 0.5 }, 'tp-low-contrast');
    const text = JSON.stringify(cfg);
    expect(text).not.toMatch(/data:image|base64/);
    const back = importConfig(text, TECHNIQUES, TP_IDS);
    expect(back).toEqual({ ok: true, technique: 'P05', params: { gamma: 0.5 }, sample: 'tp-low-contrast' });
  });
  it('clamps, drops unknown keys and rejects bad input', () => {
    const r = importConfig(JSON.stringify({ app: 'dip-lab', version: '1.2.3', technique: 'P05', params: { gamma: 99, evil: 1 } }), TECHNIQUES);
    expect(r.ok && r.params).toEqual({ gamma: 4 });
    expect(importConfig('nope', TECHNIQUES).ok).toBe(false);
    expect(importConfig(JSON.stringify({ app: 'x' }), TECHNIQUES).ok).toBe(false);
    expect(importConfig(JSON.stringify({ app: 'dip-lab', version: '9.0.0', technique: 'P05' }), TECHNIQUES).ok).toBe(false);
    expect(importConfig(JSON.stringify({ app: 'dip-lab', version: '1.0.0', technique: 'ZZZ' }), TECHNIQUES).ok).toBe(false);
  });
});

describe('image ops', () => {
  it('histogram sums to pixel count', () => {
    const p = SAMPLES[3].make();
    const h = histogramFromPixels(p);
    expect(h.reduce((a, b) => a + b, 0)).toBe(p.w * p.h);
  });
  it('diff of identical images is zero; resize handles size mismatch', () => {
    const p = SAMPLES[0].make();
    expect(diffPixels(p, p).data.filter((v, i) => i % 4 !== 3 && v !== 0).length).toBe(0);
    const small = resizeNearest(p, 64, 64);
    expect(diffPixels(p, small).w).toBe(p.w);
  });
  it('percentile bounds', () => {
    const d = new Uint8Array(100);
    for (let i = 0; i < 100; i++) d[i] = 100 + i; // 100..199
    expect(percentileBounds(d, 0, 100)).toEqual({ lo: 100, hi: 199 });
  });
  it('template filling leaves unknown names visible', () => {
    expect(fillTemplate('a {x} {y} {z}', { x: 1 }, { y: 'two' })).toBe('a 1 two {z}');
  });
});

describe('samples', () => {
  it('ships at least 5 samples with blurbs and valid RGBA data', () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(5);
    for (const s of SAMPLES) {
      const p = s.make();
      expect(s.teaches.length).toBeGreaterThan(20);
      expect(p.data.length).toBe(p.w * p.h * 4);
    }
  });
  it('is deterministic', () => {
    expect(Array.from(SAMPLES[6].make().data)).toEqual(Array.from(SAMPLES[6].make().data));
  });
});

describe('curriculum content (Definition of Done)', () => {
  const mvpSegments = ['foundations', 'point', 'histogram', 'noise', 'sharpen', 'edges', 'morphology'];
  for (const seg of mvpSegments) {
    const ts = TECHNIQUES.filter((t) => t.segment === seg && t.tier === 'mvp');
    it(`${seg}: has MVP techniques, ≥1 misconception and ≥1 self-check`, () => {
      expect(ts.length).toBeGreaterThan(0);
      expect(ts.some((t) => t.misconception)).toBe(true);
      expect(ts.some((t) => t.selfCheck)).toBe(true);
    });
  }
  it('every technique has 3–5 effect notes, a blurb and a valid exact template', () => {
    for (const t of TECHNIQUES) {
      expect(t.effectNotes.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.effectNotes.length, t.id).toBeLessThanOrEqual(5);
      expect(t.exactTemplate, t.id).toMatch(/^Exact: .*Parameters: .*Domain: .*Border: .*Display mapping: /);
      expect(t.blurb.length).toBeGreaterThan(10);
    }
  });
  it('self-check presets reference real samples and valid params', () => {
    for (const t of TECHNIQUES) {
      const sc = t.selfCheck;
      if (!sc) continue;
      expect(sc.correct).toBeLessThan(sc.options.length);
      if (sc.preset.sample) expect(TP_IDS, t.id).toContain(sc.preset.sample);
      for (const [k, v] of Object.entries(sc.preset.params)) {
        const p = t.params.find((x) => x.key === k);
        expect(p, `${t.id}.${k}`).toBeDefined();
        if (p!.type === 'range') {
          expect(Number(v)).toBeGreaterThanOrEqual(p!.min!);
          expect(Number(v)).toBeLessThanOrEqual(p!.max!);
        }
      }
    }
  });
  it('does not claim marks or endorsement', () => {
    const all = JSON.stringify(TECHNIQUES.map((t) => [t.blurb, t.effectNotes, t.misconception, t.selfCheck]));
    expect(all).not.toMatch(/extra credit|bonus points|endorsed by/i);
  });
});

import { parseInstructor, INSTRUCTOR } from '../src/lessons/instructor';
import { SEGMENTS } from '../src/registry';

describe('instructor content', () => {
  it('parses scenarios and has notes for every segment', () => {
    expect(INSTRUCTOR.main).toMatch(/10-minute live demo/);
    expect(INSTRUCTOR.main).toMatch(/Homework warm-up/);
    for (const s of SEGMENTS) expect(INSTRUCTOR.segments[s.id], s.id).toBeTruthy();
  });
  it('splits a minimal document', () => {
    const r = parseInstructor('# T\n\n## Segment guide\n\n### a\nhello\n\n### b\nworld');
    expect(r.segments).toEqual({ a: 'hello', b: 'world' });
  });
});
