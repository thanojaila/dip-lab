import { APP_VERSION, type Params, type TechniqueSpec } from './types';

/** FR-16: shareable technique config. Parameters only; never any image bytes. */
export interface ShareConfig {
  app: 'dip-lab';
  version: string;
  technique: string;
  params: Params;
  /** Optional id of a built-in synthetic sample (an id string, not pixels). */
  sample?: string;
}

export function exportConfig(technique: string, params: Params, sample?: string): ShareConfig {
  const cfg: ShareConfig = { app: 'dip-lab', version: APP_VERSION, technique, params: { ...params } };
  if (sample) cfg.sample = sample;
  return cfg;
}

export type ImportResult = { ok: true; technique: string; params: Params; sample?: string } | { ok: false; reason: string };

export function clampParam(spec: TechniqueSpec['params'][number], v: unknown): number | string | boolean {
  if (spec.type === 'checkbox') return typeof v === 'boolean' ? v : spec.default;
  if (spec.type === 'select') {
    const s = String(v);
    return spec.options?.some((o) => o.value === s) ? s : spec.default;
  }
  const n = typeof v === 'number' && Number.isFinite(v) ? v : Number(spec.default);
  const lo = spec.min ?? -Infinity;
  const hi = spec.max ?? Infinity;
  return Math.min(hi, Math.max(lo, n));
}

/** Parse + validate untrusted JSON text. Unknown keys are dropped; values are clamped. */
export function importConfig(text: string, registry: readonly TechniqueSpec[], knownSamples: readonly string[] = []): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'Not valid JSON.' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Config must be a JSON object.' };
  const o = raw as Record<string, unknown>;
  if (o.app !== 'dip-lab') return { ok: false, reason: 'Not a DIP Lab config (missing app: "dip-lab").' };
  if (typeof o.version !== 'string' || o.version.split('.')[0] !== APP_VERSION.split('.')[0])
    return { ok: false, reason: `Config version ${String(o.version)} is not compatible with app ${APP_VERSION}.` };
  const spec = registry.find((t) => t.id === o.technique);
  if (!spec) return { ok: false, reason: `Unknown technique "${String(o.technique)}".` };
  const given = o.params && typeof o.params === 'object' ? (o.params as Record<string, unknown>) : {};
  const params: Params = {};
  for (const p of spec.params) params[p.key] = clampParam(p, p.key in given ? given[p.key] : p.default);
  const sample = typeof o.sample === 'string' && knownSamples.includes(o.sample) ? o.sample : undefined;
  return { ok: true, technique: spec.id, params, sample };
}
