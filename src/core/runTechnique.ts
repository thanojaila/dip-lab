import { fillTemplate } from '../exact/templates';
import { techniqueById } from '../registry/techniques';
import { isGrayPixels } from './imageOps';
import { matToPixels, pixelsToMat, prepareInput, withMats, type Pixels } from './matIO';
import type { Cv, ImageMeta, Params, PlainPixels, RunResult } from './types';

/** Everything needed to run one technique; plain data so it can cross a Worker boundary. */
export interface RunRequest {
  id: string;
  params: Params;
  working: Pixels;
  meta: ImageMeta;
  imageId?: string;
  /** Clean bundled image (same size as `working`) for PSNR, if any. */
  reference?: Pixels;
  refPixels?: PlainPixels;
  pipeline?: string[];
}

export interface RunOutput {
  pixels: Pixels;
  exact: string;
  warnings: string[];
  /** Visible notes about how the image was adapted to the technique. */
  adapt: string[];
  ms: number;
  overlay?: RunResult['overlay'];
  metrics?: Record<string, number>;
  intermediates?: RunResult['intermediates'];
  curve?: number[];
  spectrum?: RunResult['spectrum'];
  heatmap?: RunResult['heatmap'];
  summary?: string;
  domain: string;
}

/** Run a technique on plain pixels, adapting the input to its `needs` and saying so. Deletes every Mat it makes. */
export function executeRun(cv: Cv, req: RunRequest): RunOutput {
  const spec = techniqueById(req.id);
  if (!spec) throw new Error(`Unknown technique ${req.id}`);
  if (spec.explainerOnly) throw new Error(`${spec.title} is an explainer-only concept and has no demo.`);
  const t0 = performance.now();
  const sourceGray = isGrayPixels(req.working);
  const needs = spec.needs ?? 'any';
  if (needs === 'color' && sourceGray) throw new Error('This concept needs a colour image.');
  const gray = needs === 'gray' || needs === 'binary' ? true : sourceGray;
  const adapt: string[] = [];
  if (gray && !sourceGray) adapt.push('Converted to gray for this technique.');
  if (needs === 'binary') adapt.push('This technique works on a binary image, so the picture is thresholded first. The threshold used is in the Exact panel; change it with the threshold control.');

  return withMats((track) => {
    const rgba = track(pixelsToMat(cv, req.working));
    const input = track(prepareInput(cv, rgba, gray));
    let reference;
    if (req.reference && req.reference.w === req.working.w && req.reference.h === req.working.h) {
      const refRgba = track(pixelsToMat(cv, req.reference));
      reference = track(prepareInput(cv, refRgba, gray));
    }
    const ctx = { cv, rgba, input, grayMode: gray, params: req.params, meta: req.meta, imageId: req.imageId, reference, refPixels: req.refPixels, pipeline: req.pipeline ?? [] };
    const res = spec.run(ctx);
    track(res.mat);
    const metrics = { ...(res.metrics ?? {}), ...(spec.metrics ? spec.metrics(ctx, res) : {}) };
    const domain = input.channels() === 1 ? 'uint8 gray' : 'uint8 RGB';
    const exact = fillTemplate(spec.exactTemplate, { domain, ...res.vars }, req.params);
    return {
      pixels: matToPixels(cv, res.mat),
      exact,
      warnings: (res.warnings ?? []).filter((w) => !(gray && !sourceGray && /converted to gray/i.test(w))),
      adapt,
      ms: Math.round(performance.now() - t0),
      overlay: res.overlay,
      metrics: Object.keys(metrics).length ? metrics : undefined,
      intermediates: res.intermediates,
      curve: res.curve,
      spectrum: res.spectrum,
      heatmap: res.heatmap,
      summary: res.summary,
      domain,
    };
  });
}
