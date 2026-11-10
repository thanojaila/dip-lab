import type { ParamSpec, SegmentSpec, TechniqueSpec } from '../core/types';
import { SEGMENTS } from './segments';
import { foundations } from '../alg/foundations';
import { point } from '../alg/point';
import { histogram } from '../alg/histogram';
import { noise } from '../alg/noise';
import { smoothing } from '../alg/smoothing';
import { edges } from '../alg/edges';
import { morphology } from '../alg/morphology';
import { EXACT } from '../exact/templates';
import { EFFECT_NOTES } from '../notes/effects';
import { MISCONCEPTIONS } from '../notes/misconceptions';
import { SELF_CHECKS } from '../notes/selfchecks';
import type { Runner } from '../alg/common';

const range = (key: string, label: string, min: number, max: number, step: number, def: number, help?: string): ParamSpec => ({ key, label, type: 'range', min, max, step, default: def, help });
const select = (key: string, label: string, options: [string, string][], def: string, help?: string): ParamSpec => ({ key, label, type: 'select', options: options.map(([value, label]) => ({ value, label })), default: def, help });
const check = (key: string, label: string, def: boolean, help?: string): ParamSpec => ({ key, label, type: 'checkbox', default: def, help });

const seed = () => range('seed', 'Seed', 0, 9999, 1, 0, 'Same seed = same noise, on any machine.');
const seShape = () => select('shape', 'Structuring element', [['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['cross', 'Cross']], 'ellipse');

const RUNNERS: Record<string, Runner> = { ...foundations, ...point, ...histogram, ...noise, ...smoothing, ...edges, ...morphology };

type Def = Omit<TechniqueSpec, 'run' | 'exactTemplate' | 'effectNotes' | 'misconception' | 'selfCheck'>;

const DEFS: Def[] = [
  // ---- Foundations
  { id: 'F01', title: 'Load & inspect', segment: 'foundations', tier: 'mvp', params: [], requiredCvApis: ['resize'], sampleHint: 'shapes', blurb: 'See exactly what was decoded and whether it was shrunk before any filter touched it.' },
  { id: 'F02', title: 'Gray conversion', segment: 'foundations', tier: 'mvp', params: [], requiredCvApis: ['cvtColor'], sampleHint: 'shapes', blurb: 'Collapse three color channels into one brightness value per pixel.' },
  { id: 'F03', title: 'Sampling & resize', segment: 'foundations', tier: 'mvp', requiredCvApis: ['resize'], sampleHint: 'checker', blurb: 'Change the number of samples and see how each interpolator fills the gaps.',
    params: [range('scale', 'Scale', 0.1, 4, 0.05, 0.5), select('interp', 'Interpolation', [['nearest', 'Nearest'], ['linear', 'Linear'], ['cubic', 'Cubic'], ['area', 'Area']], 'nearest')] },
  { id: 'F04', title: 'Quantization', segment: 'foundations', tier: 'mvp', requiredCvApis: ['LUT'], sampleHint: 'ramp', blurb: 'Keep only L gray levels and watch smooth gradients turn into bands.',
    params: [range('levels', 'Gray levels L', 2, 256, 1, 8)] },

  // ---- Point
  { id: 'P01', title: 'Negative', segment: 'point', tier: 'mvp', params: [], requiredCvApis: ['LUT'], sampleHint: 'shapes', livePreview: true, blurb: 'Flip every value: s = 255 − r.' },
  { id: 'P02', title: 'Brightness', segment: 'point', tier: 'mvp', requiredCvApis: ['LUT'], sampleHint: 'ramp', livePreview: true, blurb: 'Add a constant to every pixel, with or without saturation.',
    params: [range('b', 'Brightness b', -255, 255, 5, 60), check('clip', 'Clip to 0–255', true, 'Off = uint8 wrap-around (the classic bug).')] },
  { id: 'P03', title: 'Contrast stretch', segment: 'point', tier: 'mvp', requiredCvApis: ['LUT'], sampleHint: 'low-contrast', livePreview: true, blurb: 'Map the occupied gray range onto 0–255 using percentiles.',
    params: [range('pLow', 'Low percentile', 0, 49, 1, 2), range('pHigh', 'High percentile', 51, 100, 1, 98)] },
  { id: 'P04', title: 'Log transform', segment: 'point', tier: 'mvp', requiredCvApis: ['LUT'], sampleHint: 'low-contrast', livePreview: true, blurb: 'Compress highlights and expand shadows with a logarithm.',
    params: [range('alpha', 'Gain α', 0.05, 20, 0.05, 1)] },
  { id: 'P05', title: 'Gamma', segment: 'point', tier: 'mvp', requiredCvApis: ['LUT'], sampleHint: 'low-contrast', livePreview: true, blurb: 'Bend midtones with a power law while pinning black and white.',
    params: [range('gamma', 'Gamma γ', 0.2, 4, 0.05, 0.5)] },
  { id: 'P06', title: 'Threshold / Otsu', segment: 'point', tier: 'mvp', requiredCvApis: ['threshold'], sampleHint: 'blobs', blurb: 'Turn gray into black/white with a fixed or automatically chosen threshold.',
    params: [select('mode', 'Mode', [['otsu', 'Otsu (automatic)'], ['binary', 'Binary'], ['binary_inv', 'Binary inverted']], 'otsu'), range('T', 'Threshold T', 0, 255, 1, 128, 'Ignored in Otsu mode.')] },

  // ---- Histogram
  { id: 'H01', title: 'Histogram & CDF', segment: 'histogram', tier: 'mvp', params: [], requiredCvApis: ['calcHist', 'cvtColor'], sampleHint: 'low-contrast', blurb: 'Read the distribution of gray levels; toggle the CDF in the histogram panel.' },
  { id: 'H02', title: 'Global equalisation', segment: 'histogram', tier: 'mvp', params: [], requiredCvApis: ['equalizeHist'], sampleHint: 'low-contrast', blurb: 'Remap levels through the image’s own cumulative histogram.' },
  { id: 'H03', title: 'CLAHE', segment: 'histogram', tier: 'mvp', requiredCvApis: ['CLAHE'], sampleHint: 'low-contrast', blurb: 'Contrast-limited adaptive equalisation, tile by tile.',
    params: [range('clip', 'Clip limit', 1, 40, 0.5, 3), range('tiles', 'Tile grid (n×n)', 2, 16, 1, 8)] },

  // ---- Noise & smoothing
  { id: 'N01', title: 'Gaussian noise', segment: 'noise', tier: 'mvp', requiredCvApis: [], sampleHint: 'shapes', blurb: 'Add seeded, reproducible Gaussian noise.', params: [range('sigma', 'Noise σ', 0, 80, 1, 20), seed()] },
  { id: 'N02', title: 'Salt-and-pepper noise', segment: 'noise', tier: 'mvp', requiredCvApis: [], sampleHint: 'shapes', blurb: 'Corrupt a fraction of pixels to pure black or white.', params: [range('amount', 'Amount (%)', 0, 50, 1, 10), seed()] },
  { id: 'S01', title: 'Box blur', segment: 'noise', tier: 'mvp', requiredCvApis: ['blur'], sampleHint: 'step-edge', blurb: 'Replace each pixel with the plain average of its window.', params: [range('k', 'Kernel k (odd)', 3, 31, 2, 5)] },
  { id: 'S02', title: 'Gaussian blur', segment: 'noise', tier: 'mvp', requiredCvApis: ['GaussianBlur'], sampleHint: 'step-edge', blurb: 'Weighted average with a bell-shaped kernel.', params: [range('k', 'Kernel k (odd)', 3, 31, 2, 7), range('sigma', 'σ (0 = auto)', 0, 10, 0.1, 1.5)] },
  { id: 'S03', title: 'Median filter', segment: 'noise', tier: 'mvp', requiredCvApis: ['medianBlur'], sampleHint: 'impulse-noise', blurb: 'Replace each pixel with the median of its window.', params: [range('k', 'Kernel k (odd)', 3, 15, 2, 3)] },

  // ---- Edge-preserving & sharpening
  { id: 'S04', title: 'Bilateral filter', segment: 'sharpen', tier: 'mvp', requiredCvApis: ['bilateralFilter'], sampleHint: 'step-edge', blurb: 'Smooth only among pixels that are both close and similar.',
    params: [range('d', 'Diameter d', 1, 15, 2, 7, 'Cost grows with d². Keep d ≤ 9 on big images.'), range('sigmaColor', 'σ color (range)', 5, 200, 5, 50), range('sigmaSpace', 'σ space', 1, 200, 1, 50)] },
  { id: 'S05', title: 'Unsharp / high-boost', segment: 'sharpen', tier: 'mvp', requiredCvApis: ['GaussianBlur', 'addWeighted'], sampleHint: 'shapes', blurb: 'Add back the detail layer: f + k·(f − blurred f).',
    params: [range('sigma', 'Blur σ', 0.5, 10, 0.1, 2), range('k', 'Amount k', 0, 5, 0.1, 1.5)] },
  { id: 'S06', title: 'Laplacian sharpen', segment: 'sharpen', tier: 'mvp', requiredCvApis: ['filter2D'], sampleHint: 'shapes', blurb: 'One 3×3 convolution that subtracts the Laplacian.',
    params: [select('neighbours', 'Neighbours', [['4', '4-neighbour'], ['8', '8-neighbour']], '4')] },

  // ---- Edges
  { id: 'S08', title: 'Sobel magnitude', segment: 'edges', tier: 'mvp', requiredCvApis: ['Sobel', 'magnitude'], sampleHint: 'shapes', blurb: 'Measure how fast intensity changes, in both directions at once.',
    params: [select('ksize', 'Kernel size', [['3', '3×3'], ['5', '5×5'], ['7', '7×7']], '3')] },
  { id: 'S07', title: 'Prewitt / Roberts', segment: 'edges', tier: 'stretch', requiredCvApis: ['filter2D', 'magnitude'], sampleHint: 'shapes', blurb: 'Two classic gradient operators for comparison with Sobel.',
    params: [select('op', 'Operator', [['prewitt', 'Prewitt 3×3'], ['roberts', 'Roberts 2×2']], 'prewitt')] },
  { id: 'E01', title: 'Canny', segment: 'edges', tier: 'mvp', requiredCvApis: ['Canny'], sampleHint: 'shapes', blurb: 'Thin, connected edges from gradient, suppression and hysteresis.',
    params: [range('t1', 'Low threshold', 0, 255, 1, 50), range('t2', 'High threshold', 0, 255, 1, 150), range('preblur', 'Pre-blur k (0 = none)', 0, 9, 1, 0), check('l2', 'L2 gradient norm', false)] },

  // ---- Morphology
  { id: 'M01', title: 'Erode / Dilate', segment: 'morphology', tier: 'mvp', requiredCvApis: ['morphologyEx', 'getStructuringElement', 'threshold'], sampleHint: 'blobs', blurb: 'Shrink or grow bright regions with a structuring element.',
    params: [select('op', 'Operation', [['erode', 'Erode'], ['dilate', 'Dilate']], 'erode'), seShape(), range('k', 'SE size k (odd)', 3, 21, 2, 3), range('iters', 'Iterations', 1, 5, 1, 1), check('binarize', 'Binarise first (Otsu)', true)] },
  { id: 'M02', title: 'Open / Close / Gradient', segment: 'morphology', tier: 'mvp', requiredCvApis: ['morphologyEx', 'getStructuringElement', 'threshold'], sampleHint: 'blobs', blurb: 'Compose erosion and dilation to clean specks, fill gaps or outline shapes.',
    params: [select('op', 'Operation', [['open', 'Open'], ['close', 'Close'], ['gradient', 'Gradient']], 'open'), seShape(), range('k', 'SE size k (odd)', 3, 21, 2, 5), range('iters', 'Iterations', 1, 5, 1, 1), check('binarize', 'Binarise first (Otsu)', true)] },
  { id: 'M03', title: 'Otsu + component count', segment: 'morphology', tier: 'mvp', requiredCvApis: ['threshold', 'connectedComponentsWithStats'], sampleHint: 'blobs', blurb: 'Binarise, label connected components and count particles.',
    params: [range('minArea', 'Min area (px)', 0, 500, 5, 20)] },
];

/** Segment display order for techniques that share a segment. */
const ORDER = ['F01', 'F02', 'F03', 'F04', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'H01', 'H02', 'H03', 'N01', 'N02', 'S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S08', 'S07', 'E01', 'M01', 'M02', 'M03'];

export const TECHNIQUES: TechniqueSpec[] = ORDER.map((id) => {
  const d = DEFS.find((x) => x.id === id);
  if (!d) throw new Error(`Missing definition ${id}`);
  const run = RUNNERS[id];
  if (!run) throw new Error(`Missing runner ${id}`);
  return {
    ...d,
    run,
    exactTemplate: EXACT[id] ?? '',
    effectNotes: EFFECT_NOTES[id] ?? [],
    misconception: MISCONCEPTIONS[id],
    selfCheck: SELF_CHECKS[id],
  };
});

export const techniqueById = (id: string): TechniqueSpec | undefined => TECHNIQUES.find((t) => t.id === id);
export const techniquesIn = (segment: string): TechniqueSpec[] => TECHNIQUES.filter((t) => t.segment === segment);
export const defaultParams = (t: TechniqueSpec) => Object.fromEntries(t.params.map((p) => [p.key, p.default]));
export { SEGMENTS };
export type { SegmentSpec };
