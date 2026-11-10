import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import type { Pixels } from '../src/core/matIO';
import { patternById } from '../src/core/testPatterns';
import { imageById } from '../src/core/sampleRegistry';

const ROOT = path.resolve(__dirname, '../public/samples');

/** Decode a bundled image (or test pattern) to RGBA pixels under node. */
export function loadImage(id: string): Pixels {
  const pat = patternById(id);
  if (pat) return pat.make();
  const e = imageById(id);
  if (!e) throw new Error(`no image ${id}`);
  const buf = fs.readFileSync(path.join(ROOT, e.file));
  if (e.file.endsWith('.png')) {
    const p = PNG.sync.read(buf);
    return { w: p.width, h: p.height, data: new Uint8ClampedArray(p.data) };
  }
  const j = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { w: j.width, h: j.height, data: new Uint8ClampedArray(j.data) };
}
export const ROOT_DIR = ROOT;
