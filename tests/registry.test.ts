import { describe, expect, it } from 'vitest';
import { TECHNIQUES, SEGMENTS, techniquesIn } from '../src/registry';
import { IMAGES, ALL_SAMPLE_IDS } from '../src/core/sampleRegistry';
import { importConfig } from '../src/core/config';
import { exportConfig } from '../src/core/config';
import { missingApis, probe } from '../src/core/capability';
import { getCv } from './cvNode';
import { hero } from './harness';
import { withMats } from '../src/core/matIO';

const real = TECHNIQUES.filter((t) => !t.explainerOnly);

describe('v2 registry contract', () => {
  it('has 10 worlds, 44 runnable concepts and 3 explainer-only cards', () => {
    expect(SEGMENTS.length).toBe(10);
    expect(real.length).toBe(44);
    expect(TECHNIQUES.filter((t) => t.explainerOnly).map((t) => t.id).sort()).toEqual(['HOG', 'SIFT', 'SNAKE']);
  });
  it('every concept has a question, watch-out, predict check, hero image and 3–5 notes', () => {
    for (const t of TECHNIQUES) {
      expect(t.question.length, t.id).toBeGreaterThan(15);
      expect(t.question, t.id).not.toBe(t.blurb);
      expect(t.misconception, t.id).toMatch(/^(Watch out|Misconception)/);
      expect(t.selfCheck, t.id).toBeTruthy();
      expect(IMAGES.map((i) => i.id), t.id).toContain(t.heroImage);
      expect(t.effectNotes.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.effectNotes.length, t.id).toBeLessThanOrEqual(5);
      for (const a of t.alsoGoodOn ?? []) expect(ALL_SAMPLE_IDS, `${t.id} alsoGoodOn ${a}`).toContain(a);
    }
  });
  it('every world has concepts; the geometry world is labelled as light coverage', () => {
    for (const s of SEGMENTS) expect(techniquesIn(s.id).length, s.id).toBeGreaterThan(0);
    expect(SEGMENTS.find((s) => s.id === 'geometry')!.note).toMatch(/covered lightly/);
  });
  it('manifest technique lists only name real concepts', () => {
    const ids = new Set(TECHNIQUES.map((t) => t.id));
    for (const i of IMAGES) for (const id of i.techniques) expect(ids.has(id), `${i.id} -> ${id}`).toBe(true);
  });
  it('challenges name a bundled image and a metric', () => {
    for (const t of TECHNIQUES) if (t.challenge) {
      expect(IMAGES.map((i) => i.id)).toContain(t.challenge.imageId);
      expect(t.challenge.metric.length).toBeGreaterThan(2);
    }
    expect(TECHNIQUES.filter((t) => t.challenge).length).toBeGreaterThanOrEqual(4);
  });
  it('each world’s misconception text avoids claims about marks', () => {
    expect(JSON.stringify(TECHNIQUES.map((t) => [t.question, t.misconception, t.selfCheck]))).not.toMatch(/extra credit|bonus points|endorsed/i);
  });
});

describe('capabilities against the vendored OpenCV.js 4.10', () => {
  it('every API a runnable concept needs is present', async () => {
    const cv = await getCv();
    const names = [...new Set(real.flatMap((t) => t.requiredCvApis))];
    const caps = probe(cv as unknown as Record<string, unknown>, names);
    for (const t of real) expect(missingApis(t, caps), t.id).toEqual([]);
  });
  it('SIFT and active contours are absent and never assumed (HOG is explainer-only regardless)', async () => {
    const cv = await getCv();
    const caps = probe(cv as unknown as Record<string, unknown>, ['SIFT', 'activeContour']);
    expect(Object.values(caps)).toEqual([false, false]);
  });
});

describe('config compatibility', () => {
  it('still imports a v1 config (old sample id, version 1.x)', () => {
    const r = importConfig(JSON.stringify({ app: 'dip-lab', version: '1.0.0', technique: 'P05', params: { gamma: 0.7 }, sample: 'ramp' }), TECHNIQUES, ALL_SAMPLE_IDS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sample).toBe('ramp');
  });
  it('exports version 2.0.0 and no pixels', () => {
    const text = JSON.stringify(exportConfig('P05', { gamma: 0.5 }, 'rocket'));
    expect(text).toContain('"version":"2.0.0"');
    expect(text).not.toMatch(/base64|data:image/);
  });
});

describe('memory discipline on the new techniques', () => {
  it('repeated hero runs do not grow the WASM heap unboundedly', async () => {
    const cv = await getCv();
    const heap = () => (cv as unknown as { HEAPU8: { length: number } }).HEAPU8.length;
    const ids = ['C01', 'T01', 'M04', 'H04', 'Q04', 'FT01', 'FT02', 'FT03', 'FT04', 'FT05', 'G01', 'G03', 'F05', 'E01', 'S04'];
    for (const id of ids) await hero(id);
    const h0 = heap();
    for (let i = 0; i < 3; i++) for (const id of ids) await hero(id);
    expect(heap()).toBeLessThanOrEqual(h0 * 1.3);
  });
  it('withMats still deletes on throw', async () => {
    const cv = await getCv();
    let m: InstanceType<typeof cv.Mat> | undefined;
    expect(() => withMats((track) => { m = track(new cv.Mat(2, 2, cv.CV_8UC1)); throw new Error('x'); })).toThrow('x');
    expect(() => m!.rows).toThrow();
  });
});
