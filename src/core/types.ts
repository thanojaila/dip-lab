/** Shared types. `Cv` is the OpenCV.js namespace; `Mat` its matrix class. */
export type Cv = typeof import('@techstark/opencv-js');
export type Mat = import('@techstark/opencv-js').Mat;

export const APP_VERSION = '2.0.0';

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
  /** Set from the stage (drawn rectangle, dragged corners, spectrum circle) rather than a visible control. */
  hidden?: boolean;
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

export type Need = 'any' | 'gray' | 'binary' | 'color';

export type OverlayShape =
  | { kind: 'point'; x: number; y: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; label?: string }
  | { kind: 'poly'; points: [number, number][] };

/** Plain RGBA pixels (structured-clone friendly, so results can cross a Worker boundary). */
export interface PlainPixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
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
  /** Id of the bundled image being worked on, if any. */
  imageId?: string;
  /** Clean bundled image prepared like `input` (for PSNR). Present only when sizes match. */
  reference?: Mat;
  /** Reference image for histogram matching (RGBA). */
  refPixels?: PlainPixels;
  /** Technique ids already applied in the pipeline (e.g. ['N02']). */
  pipeline?: string[];
}

export interface RunResult {
  /** Result matrix (8UC1 or 8UC3). Caller takes ownership and must delete(). */
  mat: Mat;
  /** Values for template placeholders beyond the params themselves. */
  vars: Record<string, string | number>;
  warnings?: string[];
  /** Shapes drawn over the original (points, lines, circles, boxes, contours). */
  overlay?: OverlayShape[];
  /** Numbers shown in the scope table and checked by challenges. */
  metrics?: Record<string, number>;
  /** Named intermediate images for the step strip / comparisons. */
  intermediates?: { label: string; pixels: PlainPixels }[];
  /** 256-entry transfer table s = T(r) for point operations. */
  curve?: number[];
  /** Log-magnitude spectrum picture, with the cutoff radius (in spectrum pixels) if any. */
  spectrum?: { pixels: PlainPixels; cutoff?: number; kind?: string };
  /** Score / accumulator map for the heat-map scope. */
  heatmap?: { w: number; h: number; data: Float32Array; label: string; marks?: [number, number][] };
  /** A short sentence for screen readers describing overlay/metrics ("12 circles found"). */
  summary?: string;
}

export interface SelfCheckSpec {
  prompt: string;
  options: string[];
  correct: number;
  /** Preset applied when the learner runs the check. */
  /** Defaults to the concept's hero demo when omitted. */
  preset?: { sample?: string; params: Params };
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
  /** Verbatim course Colab cells that implement this concept (only where one exists). */
  colab?: { notebook: string; cell: string; code: string; note?: string }[];

  // ---- v2 ----
  /** How the technique adapts the learner's image (always with a visible note). */
  needs?: Need;
  /** The opening question the image answers. */
  question: string;
  /** Manifest id of the image the hero demo opens on. */
  heroImage: string;
  /** Hero-demo parameters. */
  heroParams?: Params;
  /** Steps run (and chained) before the hero demo, e.g. add noise first. */
  heroPipeline?: { id: string; params: Params }[];
  alsoGoodOn?: string[];
  scope?: 'histogram' | 'curve' | 'spectrum' | 'table' | 'heatmap';
  explainer?: 'kernel' | 'curve' | 'structuring' | 'steps' | 'spectrum' | 'overlay';
  /** Extra numbers for the scope table. */
  metrics?: (ctx: RunContext, r: RunResult) => Record<string, number>;
  challenge?: {
    prompt: string;
    check: (m: Record<string, number>) => boolean;
    /** Only evaluated on this bundled image (and, if set, after these pipeline steps). */
    imageId?: string;
    requires?: string[];
    /** Text shown with the measured number, e.g. "PSNR (dB)". */
    metric: string;
    /** Which metric key holds the measured number. */
    key: string;
  };
  /** SIFT, HOG, active contours: description only, never a fake demo. */
  explainerOnly?: boolean;
  /** Needs a reference image (histogram matching). */
  needsRef?: boolean;
  /** Runs in the Worker when available (DFT, Hough, big bilateral). */
  heavy?: boolean;
  /** Show the template-rectangle picker on the stage. */
  pickRect?: boolean;
  /** Show four draggable corners on the stage. */
  pickCorners?: boolean;
}

export interface SegmentSpec {
  id: string;
  index: number;
  title: string;
  tagline: string;
  /** Accent colour token name for this world. */
  accent: 'primary' | 'coral' | 'teal' | 'sun' | 'plum' | 'sky';
  /** Optional honesty label, e.g. "covered lightly". */
  note?: string;
}
