import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMAGES, ALL_SAMPLE_IDS, normalizeSampleId } from '../src/core/sampleRegistry';
import { loadImage, ROOT_DIR } from './images';

describe('image manifest', () => {
  it('lists 24 photographs', () => expect(IMAGES.length).toBe(24));
  it('every file exists, decodes, and matches its declared size', () => {
    for (const e of IMAGES) {
      expect(fs.existsSync(path.join(ROOT_DIR, e.file)), e.file).toBe(true);
      const p = loadImage(e.id);
      expect([p.w, p.h], e.id).toEqual([e.width, e.height]);
    }
  });
  it('every image has licence, credit, origin and a teaches line; ids are unique', () => {
    const ids = new Set<string>();
    for (const e of IMAGES) {
      expect(e.licence.length, e.id).toBeGreaterThan(2);
      expect(e.credit.length, e.id).toBeGreaterThan(2);
      expect(e.origin.length, e.id).toBeGreaterThan(2);
      expect(e.teaches.length, e.id).toBeGreaterThan(10);
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
    }
  });
  it('every image has a build-time thumbnail and an ATTRIBUTION row', () => {
    const attr = fs.readFileSync(path.join(ROOT_DIR, 'ATTRIBUTION.md'), 'utf8');
    for (const e of IMAGES) {
      expect(fs.existsSync(path.join(ROOT_DIR, 'thumbs', `${e.id}.png`)), e.id).toBe(true);
      expect(attr, e.id).toContain(e.file.replace('images/', ''));
    }
  });
  it('maps legacy v1 sample ids', () => {
    expect(normalizeSampleId('ramp')).toBe('tp-ramp');
    expect(ALL_SAMPLE_IDS).toContain('cameraman');
  });
});
