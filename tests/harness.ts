import { executeRun, type RunOutput } from '../src/core/runTechnique';
import { defaultParams, heroParamsOf, techniqueById } from '../src/registry';
import type { ImageMeta, Params } from '../src/core/types';
import type { Pixels } from '../src/core/matIO';
import { getCv } from './cvNode';
import { loadImage } from './images';

export interface Step { id: string; params?: Params }

/** Run optional chained pre-steps, then a technique, on a bundled image. Mirrors what the app does. */
export async function run(id: string, imageId: string, params: Params = {}, pre: Step[] = [], opts: { refPixels?: Pixels; noReference?: boolean } = {}): Promise<RunOutput> {
  const cv = await getCv();
  const base = loadImage(imageId);
  let working: Pixels = base;
  const pipeline: string[] = [];
  const meta = (p: Pixels): ImageMeta => ({ source: `sample:${imageId}`, origW: p.w, origH: p.h, w: p.w, h: p.h, resized: false, limit: 1024 });
  for (const s of pre) {
    const spec = techniqueById(s.id)!;
    const out = executeRun(cv, { id: s.id, params: { ...defaultParams(spec), ...heroParamsOf(spec), ...(s.params ?? {}) }, working, meta: meta(working), imageId, reference: opts.noReference ? undefined : base, pipeline: [...pipeline] });
    working = out.pixels;
    pipeline.push(s.id);
  }
  const spec = techniqueById(id)!;
  return executeRun(cv, { id, params: { ...defaultParams(spec), ...params }, working, meta: meta(working), imageId, reference: opts.noReference ? undefined : base, refPixels: opts.refPixels, pipeline });
}

/** The concept's hero demo exactly as the app runs it. */
export async function hero(id: string): Promise<RunOutput> {
  const spec = techniqueById(id)!;
  const refPixels = id === 'H04' ? loadImage(String(heroParamsOf(spec).ref)) : undefined;
  return run(id, spec.heroImage, heroParamsOf(spec), (spec.heroPipeline ?? []).map((p) => ({ id: p.id, params: p.params })), { refPixels });
}
