import { createRequire } from 'node:module';
import { resolveCv } from '../src/core/opencvLoader';
import type { Cv } from '../src/core/types';

let cached: Promise<Cv> | null = null;

/** Real OpenCV.js (WASM) loaded under node, so algorithm tests exercise the actual library. */
export function getCv(): Promise<Cv> {
  if (!cached) {
    const require = createRequire(import.meta.url);
    cached = resolveCv(require('@techstark/opencv-js'));
  }
  return cached;
}
