import { applyLut, domainOf, num, str, type Runner } from './common';

const INTERP: Record<string, { name: string; behaviour: string }> = {
  nearest: { name: 'INTER_NEAREST', behaviour: 'copies the closest source pixel (blocky, no new values)' },
  linear: { name: 'INTER_LINEAR', behaviour: 'blends the 4 nearest pixels (smooth, slightly soft)' },
  cubic: { name: 'INTER_CUBIC', behaviour: 'fits a bicubic surface over 16 pixels (sharper, can overshoot)' },
  area: { name: 'INTER_AREA', behaviour: 'averages the source pixels covered by each output pixel (best for shrinking)' },
};

export const foundations: Record<string, Runner> = {
  F01: ({ input, meta }) => {
    const resizeNote = meta.resized
      ? `resized ${meta.origW}×${meta.origH}→${meta.w}×${meta.h} (INTER_AREA) because max side ${meta.limit}`
      : `no resize needed (longest side ≤ ${meta.limit})`;
    const src = meta.source.startsWith('sample:') ? 'synthetic sample, generated in your browser' : meta.source === 'chained' ? 'a previous Result you promoted to input' : 'your uploaded file';
    return {
      mat: input.clone(),
      vars: { origW: meta.origW, origH: meta.origH, resizeNote, srcNote: src, w: meta.w, h: meta.h, pixels: meta.w * meta.h },
    };
  },

  F02: ({ cv, rgba }) => {
    const mat = new cv.Mat();
    cv.cvtColor(rgba, mat, cv.COLOR_RGBA2GRAY);
    return { mat, vars: {} };
  },

  F03: ({ cv, input, params }) => {
    let scale = num(params, 'scale');
    const key = str(params, 'interp');
    const info = INTERP[key];
    const warnings: string[] = [];
    const MAX_PIXELS = 4_000_000;
    if (input.cols * input.rows * scale * scale > MAX_PIXELS) {
      scale = Math.sqrt(MAX_PIXELS / (input.cols * input.rows));
      warnings.push(`Scale was capped at ${scale.toFixed(2)} to keep the output under 4 megapixels.`);
    }
    const w = Math.max(1, Math.round(input.cols * scale));
    const h = Math.max(1, Math.round(input.rows * scale));
    const mat = new cv.Mat();
    const flag = { nearest: cv.INTER_NEAREST, linear: cv.INTER_LINEAR, cubic: cv.INTER_CUBIC, area: cv.INTER_AREA }[key] ?? cv.INTER_LINEAR;
    cv.resize(input, mat, new cv.Size(w, h), 0, 0, flag);
    if (key === 'area' && scale > 1) warnings.push('INTER_AREA is meant for shrinking; when enlarging it behaves like nearest-neighbour.');
    return {
      mat,
      vars: { scale: Number(scale.toFixed(2)), interpName: info.name, interpBehaviour: info.behaviour, w, h, w0: input.cols, h0: input.rows, domain: domainOf(input) },
      warnings,
    };
  },

  F04: ({ cv, input, params }) => {
    const L = Math.round(num(params, 'levels'));
    const mat = applyLut(cv, input, (r) => {
      const bin = Math.floor((r * L) / 256);
      return L === 1 ? 0 : Math.round((bin * 255) / (L - 1));
    });
    return { mat, vars: { L, bits: Math.log2(L).toFixed(2), domain: domainOf(input) } };
  },
};
