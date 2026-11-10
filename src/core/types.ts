/** Shared types. `Cv` is the OpenCV.js namespace; `Mat` its matrix class. */
export type Cv = typeof import('@techstark/opencv-js');
export type Mat = import('@techstark/opencv-js').Mat;

export const APP_VERSION = '1.0.0';

export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;

export interface ParamSpec {
  key: string;
  label: string;
  type: 'range' | 'select' | 'checkbox';
  default: ParamValue;
  min?: number;
  max?: number;
  step?: number;
  /** For selects: value/label pairs. */
  options?: { value: string; label: string }[];
  /** One-line help shown under the control. */
  help?: string;
}

/** Where a run's input came from (for the F01 Exact transform). */
export interface ImageMeta {
  source: string; // 'upload' | 'sample:<id>' | 'chained'
  origW: number;
  origH: number;
  w: number;
  h: number;
  resized: boolean;
  limit: number;
}

export interface RunContext {
  cv: Cv;
  /** Original RGBA working image. Read-only; caller owns it. */
  rgba: Mat;
  /** Prepared input: 8UC1 (gray mode) or 8UC3 (RGB). Read-only; caller owns it. */
  input: Mat;
  grayMode: boolean;
  params: Params;
  meta: ImageMeta;
}

export interface RunResult {
  /** Result matrix (8UC1 or 8UC3). Caller takes ownership and must delete(). */
  mat: Mat;
  /** Values for template placeholders beyond the params themselves. */
  vars: Record<string, string | number>;
  warnings?: string[];
}

export interface SelfCheckSpec {
  prompt: string;
  options: string[];
  correct: number;
  /** Preset applied when the learner runs the check. */
  preset: { sample?: string; params: Params };
  explanation: string;
}

export type Tier = 'mvp' | 'p2' | 'stretch' | 'out';

export interface TechniqueSpec {
  id: string;
  title: string;
  segment: string;
  tier: Tier;
  params: ParamSpec[];
  requiredCvApis: string[];
  run: (ctx: RunContext) => RunResult;
  exactTemplate: string;
  effectNotes: string[];
  misconception?: string;
  selfCheck?: SelfCheckSpec;
  /** Synthetic sample id that best shows this technique. */
  sampleHint?: string;
  /** Cheap point operation: allow a live-preview checkbox. */
  livePreview?: boolean;
  /** One-sentence plain description shown at the top of the card. */
  blurb: string;
}

export interface SegmentSpec {
  id: string;
  index: number;
  title: string;
  tagline: string;
}
