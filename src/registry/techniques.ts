import type { ParamSpec, ParamValue, SegmentSpec, TechniqueSpec } from '../core/types';
import { SEGMENTS } from './segments';
import { foundations } from '../alg/foundations';
import { point } from '../alg/point';
import { histogram } from '../alg/histogram';
import { noise } from '../alg/noise';
import { smoothing } from '../alg/smoothing';
import { edges } from '../alg/edges';
import { morphology } from '../alg/morphology';
import { color } from '../alg/color';
import { threshold } from '../alg/threshold';
import { frequency } from '../alg/frequency';
import { features } from '../alg/features';
import { geometry } from '../alg/geometry';
import { EXACT } from '../exact/templates';
import { EFFECT_NOTES } from '../notes/effects';
import { MISCONCEPTIONS } from '../notes/misconceptions';
import { SELF_CHECKS } from '../notes/selfchecks';
import { QUESTIONS } from '../notes/questions';
import type { Runner } from '../alg/common';
import { psnrMetric } from './metricsLib';

const range = (key: string, label: string, min: number, max: number, step: number, def: number, help?: string, hidden?: boolean): ParamSpec => ({ key, label, type: 'range', min, max, step, default: def, help, hidden });
const select = (key: string, label: string, options: [string, string][], def: string, help?: string): ParamSpec => ({ key, label, type: 'select', options: options.map(([value, label]) => ({ value, label })), default: def, help });
const check = (key: string, label: string, def: boolean, help?: string): ParamSpec => ({ key, label, type: 'checkbox', default: def, help });

const seed = () => range('seed', 'Seed', 0, 9999, 1, 0, 'Same seed = same noise, on any machine.');
const seShape = () => select('shape', 'Structuring element', [['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['cross', 'Cross']], 'ellipse');
const channel = () => select('channel', 'Plane', [['gray', 'Gray (luma)'], ['red', 'Red'], ['green', 'Green'], ['blue', 'Blue']], 'gray', 'Colour images: choose which plane to analyse.');
const binParams = (): ParamSpec[] => [range('thr', 'Threshold (0 = Otsu)', 0, 255, 1, 0, '0 lets Otsu choose; the value used is shown in the Exact panel.'), check('invert', 'Objects are dark', false, 'Tick when the objects you care about are darker than the background.')];
const kernelPair = (def: number): ParamSpec[] => [range('k', 'Element width (odd)', 1, 61, 2, def), range('kh', 'Element height (0 = same)', 0, 61, 1, 0, 'Use a different height for a line-shaped element, e.g. 40 wide × 1 high.')];

const RUNNERS: Record<string, Runner> = { ...foundations, ...point, ...histogram, ...noise, ...smoothing, ...edges, ...morphology, ...color, ...threshold, ...frequency, ...features, ...geometry };

type Def = Omit<TechniqueSpec, 'run' | 'exactTemplate' | 'effectNotes' | 'misconception' | 'selfCheck' | 'question'>;

const sudokuCorners: Record<string, number> = { x0: 68, y0: 86, x1: 497, y1: 72, x2: 527, y2: 503, x3: 40, y3: 515 };

const DEFS: Def[] = [
  // ---- World 0: Pixels
  { id: 'F01', title: 'Load and inspect', segment: 'pixels', tier: 'mvp', params: [], requiredCvApis: ['resize'], blurb: 'See what was decoded, its shape and type, and whether it was shrunk first.', heroImage: 'cameraman', alsoGoodOn: ['cat'], scope: 'histogram' },
  { id: 'F02', title: 'Colour to gray', segment: 'pixels', tier: 'mvp', params: [], requiredCvApis: ['cvtColor'], blurb: 'Collapse three channels into one brightness per pixel.', heroImage: 'tissue_ihc', alsoGoodOn: ['cat', 'smarties'], needs: 'color', scope: 'histogram' },
  { id: 'C01', title: 'Channels and HSV', segment: 'pixels', tier: 'mvp', requiredCvApis: ['cvtColor', 'inRange', 'split', 'bitwise_or', 'connectedComponentsWithStats'], blurb: 'Split a photo into channels, then select a colour by hue.', heroImage: 'smarties', alsoGoodOn: ['coffee', 'tissue_ihc'], needs: 'color', scope: 'table', explainer: 'overlay',
    params: [select('view', 'Show', [['mask', 'Selected colour'], ['red', 'Red plane'], ['green', 'Green plane'], ['blue', 'Blue plane'], ['hue', 'Hue plane'], ['sat', 'Saturation plane'], ['val', 'Value plane']], 'mask'), range('hue', 'Hue centre (0–180)', 0, 180, 1, 0, 'OpenCV hue is degrees ÷ 2. Red is near 0 (and 180).'), range('width', 'Hue half-width', 0, 40, 1, 10), range('satMin', 'Saturation at least', 0, 255, 5, 120), range('valMin', 'Value at least', 0, 255, 5, 100)],
    heroParams: { view: 'mask', hue: 0, width: 10, satMin: 120, valMin: 100 } },
  { id: 'F03', title: 'Interpolation', segment: 'pixels', tier: 'mvp', requiredCvApis: ['resize'], blurb: 'Change the number of samples and see how each interpolator fills the gaps.', heroImage: 'microaneurysms', alsoGoodOn: ['tp-checker'], scope: 'histogram',
    params: [range('scale', 'Scale', 0.1, 8, 0.05, 0.5), select('interp', 'Interpolation', [['nearest', 'Nearest'], ['linear', 'Linear'], ['cubic', 'Cubic'], ['area', 'Area']], 'nearest')], heroParams: { scale: 6, interp: 'nearest' } },
  { id: 'F05', title: 'Aliasing', segment: 'pixels', tier: 'mvp', requiredCvApis: ['resize'], blurb: 'Shrink without averaging and watch false patterns appear.', heroImage: 'brick', alsoGoodOn: ['tp-checker', 'building'], explainer: 'steps', scope: 'histogram',
    params: [range('factor', 'Shrink factor', 2, 12, 1, 6), select('interp', 'Shrink with', [['nearest', 'Nearest (skip pixels)'], ['area', 'Area (average first)']], 'nearest')], heroParams: { factor: 6, interp: 'nearest' } },
  { id: 'F04', title: 'Quantization', segment: 'pixels', tier: 'mvp', requiredCvApis: ['LUT'], blurb: 'Keep only L gray levels and watch smooth gradients turn into bands.', heroImage: 'cameraman', alsoGoodOn: ['tp-ramp', 'cat'], scope: 'curve', explainer: 'curve',
    params: [range('levels', 'Gray levels L', 2, 256, 1, 8)], heroParams: { levels: 4 } },

  // ---- World 1: Point operations
  { id: 'P01', title: 'Negative', segment: 'point', tier: 'mvp', params: [], requiredCvApis: ['LUT'], livePreview: true, blurb: 'Flip every value: s = 255 − r.', heroImage: 'hubble', alsoGoodOn: ['cell'], scope: 'curve', explainer: 'curve' },
  { id: 'P02', title: 'Brightness', segment: 'point', tier: 'mvp', requiredCvApis: ['LUT'], livePreview: true, blurb: 'Add a constant to every pixel, with or without saturation.', heroImage: 'rocket', alsoGoodOn: ['tp-ramp'], scope: 'curve', explainer: 'curve',
    params: [range('b', 'Brightness b', -255, 255, 5, 60), check('clip', 'Clip to 0–255', true, 'Off = uint8 wrap-around (the classic bug).')], heroParams: { b: 80, clip: false } },
  { id: 'P03', title: 'Contrast stretch', segment: 'point', tier: 'mvp', requiredCvApis: ['LUT'], livePreview: true, blurb: 'Map the occupied gray range onto 0–255 using percentiles.', heroImage: 'microaneurysms', alsoGoodOn: ['text', 'cell'], scope: 'curve', explainer: 'curve',
    params: [range('pLow', 'Low percentile', 0, 49, 1, 2), range('pHigh', 'High percentile', 51, 100, 1, 98)], heroParams: { pLow: 1, pHigh: 99 } },
  { id: 'P04', title: 'Log transform', segment: 'point', tier: 'mvp', requiredCvApis: ['LUT'], livePreview: true, blurb: 'Compress highlights and expand shadows with a logarithm.', heroImage: 'hubble', alsoGoodOn: ['rocket'], scope: 'curve', explainer: 'curve',
    params: [range('alpha', 'Gain α', 0.05, 20, 0.05, 1)] },
  { id: 'P05', title: 'Gamma', segment: 'point', tier: 'mvp', requiredCvApis: ['LUT'], livePreview: true, blurb: 'Bend midtones with a power law while pinning black and white.', heroImage: 'rocket', alsoGoodOn: ['hubble', 'retina'], scope: 'curve', explainer: 'curve',
    params: [range('gamma', 'Gamma γ', 0.2, 4, 0.05, 0.5)] },
  { id: 'P06', title: 'Threshold and Otsu', segment: 'point', tier: 'mvp', requiredCvApis: ['threshold'], blurb: 'Turn gray into black and white with a fixed or automatically chosen threshold.', heroImage: 'cell', alsoGoodOn: ['sudoku', 'coins'], needs: 'gray', scope: 'histogram',
    params: [select('mode', 'Mode', [['otsu', 'Otsu (automatic)'], ['binary', 'Binary'], ['binary_inv', 'Binary inverted']], 'otsu'), range('T', 'Threshold T', 0, 255, 1, 128, 'Ignored in Otsu mode.')], heroParams: { mode: 'otsu', T: 128 } },

  // ---- World 2: Histograms
  { id: 'H01', title: 'Histogram and CDF', segment: 'hist', tier: 'mvp', requiredCvApis: ['calcHist', 'split', 'cvtColor'], blurb: 'Read the distribution of gray levels; turn on the CDF in the scope.', heroImage: 'retina', alsoGoodOn: ['hubble', 'microaneurysms'], scope: 'histogram', params: [channel()], heroParams: { channel: 'green' } },
  { id: 'H02', title: 'Global equalisation', segment: 'hist', tier: 'mvp', requiredCvApis: ['equalizeHist', 'split'], blurb: 'Remap levels through the image’s own cumulative histogram.', heroImage: 'retina', alsoGoodOn: ['cell', 'text'], scope: 'curve', explainer: 'curve', params: [channel()], heroParams: { channel: 'green' } },
  { id: 'H03', title: 'CLAHE', segment: 'hist', tier: 'mvp', requiredCvApis: ['CLAHE', 'split'], blurb: 'Contrast-limited adaptive equalisation, tile by tile.', heroImage: 'retina', alsoGoodOn: ['text', 'cell'], scope: 'histogram',
    params: [channel(), range('clip', 'Clip limit', 1, 40, 0.5, 3), range('tiles', 'Tile grid (n×n)', 2, 16, 1, 8)], heroParams: { channel: 'green', clip: 3, tiles: 8 } },
  { id: 'H04', title: 'Histogram matching', segment: 'hist', tier: 'stretch', requiredCvApis: ['LUT'], needsRef: true, blurb: 'Give one photo the tone distribution of another.', heroImage: 'rocket', alsoGoodOn: ['cat', 'cameraman'], scope: 'histogram', explainer: 'curve',
    params: [select('ref', 'Reference image', [['coffee', 'Coffee'], ['retina', 'Retina'], ['cat', 'Cat'], ['cameraman', 'Cameraman'], ['rocket', 'Rocket'], ['tissue_ihc', 'Stained tissue'], ['upload', 'My uploaded reference']], 'coffee')], heroParams: { ref: 'coffee' } },

  // ---- World 3: Noise and smoothing
  { id: 'N01', title: 'Gaussian noise', segment: 'noise', tier: 'mvp', requiredCvApis: [], blurb: 'Add seeded, reproducible Gaussian noise.', heroImage: 'cameraman', alsoGoodOn: ['cat'], scope: 'table', metrics: psnrMetric, params: [range('sigma', 'Noise σ', 0, 80, 1, 20), seed()], heroParams: { sigma: 20, seed: 0 } },
  { id: 'N02', title: 'Salt-and-pepper noise', segment: 'noise', tier: 'mvp', requiredCvApis: [], blurb: 'Corrupt a fraction of pixels to pure black or white.', heroImage: 'cameraman', alsoGoodOn: ['cat'], scope: 'table', metrics: psnrMetric, params: [range('amount', 'Amount (%)', 0, 50, 1, 10), seed()], heroParams: { amount: 8, seed: 0 } },
  { id: 'S01', title: 'Box blur', segment: 'noise', tier: 'mvp', requiredCvApis: ['blur'], blurb: 'Replace each pixel with the plain average of its window.', heroImage: 'cameraman', alsoGoodOn: ['cat'], scope: 'table', explainer: 'kernel', metrics: psnrMetric, params: [range('k', 'Kernel k (odd)', 3, 31, 2, 5)], heroParams: { k: 5 }, heroPipeline: [{ id: 'N01', params: { sigma: 20, seed: 0 } }] },
  { id: 'S02', title: 'Gaussian blur', segment: 'noise', tier: 'mvp', requiredCvApis: ['GaussianBlur'], blurb: 'Weighted average with a bell-shaped kernel.', heroImage: 'cameraman', alsoGoodOn: ['cat'], scope: 'table', explainer: 'kernel', metrics: psnrMetric, params: [range('k', 'Kernel k (odd)', 3, 31, 2, 7), range('sigma', 'σ (0 = auto)', 0, 10, 0.1, 1.5)], heroParams: { k: 5, sigma: 0 }, heroPipeline: [{ id: 'N02', params: { amount: 8, seed: 0 } }] },
  { id: 'S03', title: 'Median filter', segment: 'noise', tier: 'mvp', requiredCvApis: ['medianBlur'], blurb: 'Replace each pixel with the median of its window.', heroImage: 'cameraman', alsoGoodOn: ['cat'], scope: 'table', explainer: 'steps', metrics: psnrMetric, params: [range('k', 'Kernel k (odd)', 3, 15, 2, 3)], heroParams: { k: 3 }, heroPipeline: [{ id: 'N02', params: { amount: 8, seed: 0 } }],
    challenge: { prompt: 'Beat 28 dB PSNR on the salt-and-pepper cameraman.', check: (m) => m.psnr > 28, imageId: 'cameraman', requires: ['N02'], metric: 'PSNR (dB)' } },

  // ---- World 4: Sharpen
  { id: 'S04', title: 'Bilateral filter', segment: 'sharpen', tier: 'mvp', requiredCvApis: ['bilateralFilter', 'GaussianBlur'], heavy: true, blurb: 'Smooth only among pixels that are both close and similar.', heroImage: 'cat', alsoGoodOn: ['cameraman'], scope: 'table', explainer: 'steps', metrics: psnrMetric,
    params: [range('d', 'Diameter d', 1, 15, 2, 9, 'Cost grows with d². Keep d ≤ 9 on big images.'), range('sigmaColor', 'σ color (range)', 5, 200, 5, 40), range('sigmaSpace', 'σ space', 1, 200, 1, 5)], heroParams: { d: 9, sigmaColor: 40, sigmaSpace: 5 } },
  { id: 'S05', title: 'Unsharp and high-boost', segment: 'sharpen', tier: 'mvp', requiredCvApis: ['GaussianBlur', 'addWeighted'], blurb: 'Add back the detail layer: f + k·(f − blurred f).', heroImage: 'circuit_board', alsoGoodOn: ['clock_motion', 'cat'], scope: 'histogram', explainer: 'kernel',
    params: [range('sigma', 'Blur σ', 0.5, 10, 0.1, 2), range('k', 'Amount k', 0, 5, 0.1, 1.5)], heroParams: { sigma: 2, k: 1.5 } },
  { id: 'S06', title: 'Laplacian sharpen', segment: 'sharpen', tier: 'mvp', requiredCvApis: ['filter2D'], blurb: 'One 3×3 convolution that subtracts the Laplacian.', heroImage: 'cameraman', alsoGoodOn: ['circuit_board'], scope: 'histogram', explainer: 'kernel',
    params: [select('neighbours', 'Neighbours', [['4', '4-neighbour'], ['8', '8-neighbour']], '4')], heroParams: { neighbours: '4' }, heroPipeline: [{ id: 'N01', params: { sigma: 10, seed: 0 } }] },

  // ---- World 5: Edges
  { id: 'S08', title: 'Sobel', segment: 'edges', tier: 'mvp', requiredCvApis: ['Sobel', 'magnitude', 'convertScaleAbs'], needs: 'gray', blurb: 'Measure how fast intensity changes along x, along y, and both.', heroImage: 'brick', alsoGoodOn: ['cameraman', 'building'], scope: 'table', explainer: 'kernel',
    params: [select('ksize', 'Kernel size', [['3', '3×3'], ['5', '5×5'], ['7', '7×7']], '3'), select('view', 'Show', [['mag', 'Magnitude'], ['gx', '|Gx| (vertical edges)'], ['gy', '|Gy| (horizontal edges)']], 'mag')], heroParams: { ksize: '3', view: 'gx' } },
  { id: 'S07', title: 'Prewitt and Roberts', segment: 'edges', tier: 'stretch', requiredCvApis: ['filter2D', 'magnitude'], needs: 'gray', blurb: 'Two classic gradient operators for comparison with Sobel.', heroImage: 'blocks', alsoGoodOn: ['cameraman'], scope: 'histogram', explainer: 'kernel',
    params: [select('op', 'Operator', [['prewitt', 'Prewitt 3×3'], ['roberts', 'Roberts 2×2']], 'prewitt')], heroParams: { op: 'roberts' } },
  { id: 'E01', title: 'Canny', segment: 'edges', tier: 'mvp', requiredCvApis: ['Canny', 'Sobel', 'magnitude', 'GaussianBlur'], needs: 'gray', blurb: 'Thin, connected edges from gradient, suppression and hysteresis.', heroImage: 'cameraman', alsoGoodOn: ['building', 'blocks'], scope: 'table', explainer: 'steps',
    params: [range('t1', 'Low threshold', 0, 255, 1, 50), range('t2', 'High threshold', 0, 255, 1, 150), range('preblur', 'Pre-blur k (0 = none)', 0, 9, 1, 0), check('l2', 'L2 gradient norm', false)], heroParams: { t1: 100, t2: 200, preblur: 0, l2: false } },

  // ---- World 6: Thresholds and morphology
  { id: 'T01', title: 'Adaptive threshold', segment: 'morph', tier: 'mvp', requiredCvApis: ['adaptiveThreshold', 'threshold'], needs: 'gray', blurb: 'One threshold per neighbourhood instead of one per image.', heroImage: 'sudoku', alsoGoodOn: ['coins', 'text'], scope: 'table', explainer: 'steps',
    params: [select('method', 'Local value', [['gaussian', 'Gaussian-weighted mean'], ['mean', 'Plain mean']], 'gaussian'), range('block', 'Block size (odd)', 3, 101, 2, 11), range('C', 'Subtract C', -10, 30, 1, 2)], heroParams: { method: 'gaussian', block: 11, C: 2 } },
  { id: 'M01', title: 'Erode and dilate', segment: 'morph', tier: 'mvp', requiredCvApis: ['morphologyEx', 'getStructuringElement', 'threshold', 'connectedComponentsWithStats'], needs: 'binary', blurb: 'Shrink or grow bright regions with a structuring element.', heroImage: 'horse', alsoGoodOn: ['shapes', 'tp-blobs'], scope: 'table', explainer: 'structuring',
    params: [select('op', 'Operation', [['erode', 'Erode'], ['dilate', 'Dilate']], 'erode'), seShape(), ...kernelPair(3), range('iters', 'Iterations', 1, 5, 1, 1), check('binarize', 'Binarise first', true), ...binParams()], heroParams: { op: 'erode', shape: 'ellipse', k: 15, kh: 0, iters: 1, binarize: true, thr: 0, invert: true } },
  { id: 'M02', title: 'Open, close, gradient', segment: 'morph', tier: 'mvp', requiredCvApis: ['morphologyEx', 'getStructuringElement', 'threshold', 'connectedComponentsWithStats'], needs: 'binary', blurb: 'Compose erosion and dilation to clean specks, fill gaps or outline shapes.', heroImage: 'sheet_music', alsoGoodOn: ['shapes', 'horse', 'tp-blobs'], scope: 'table', explainer: 'structuring',
    params: [select('op', 'Operation', [['open', 'Open'], ['close', 'Close'], ['gradient', 'Gradient']], 'open'), seShape(), ...kernelPair(5), range('iters', 'Iterations', 1, 5, 1, 1), check('binarize', 'Binarise first', true), ...binParams()], heroParams: { op: 'open', shape: 'rect', k: 41, kh: 1, iters: 1, binarize: true, thr: 0, invert: true } },
  { id: 'M03', title: 'Threshold and count', segment: 'morph', tier: 'mvp', requiredCvApis: ['threshold', 'connectedComponentsWithStats', 'morphologyEx', 'getStructuringElement'], needs: 'binary', blurb: 'Binarise, clean up, label connected components and count objects.', heroImage: 'coins', alsoGoodOn: ['hubble', 'shapes'], scope: 'table', explainer: 'steps',
    params: [range('minArea', 'Min area (px)', 0, 1000, 5, 200), range('open', 'Clean-up opening (0 = none)', 0, 15, 1, 0), ...binParams()], heroParams: { minArea: 200, open: 0, thr: 0, invert: false },
    challenge: { prompt: 'Make the coin count exactly 24.', check: (m) => m.kept === 24, imageId: 'coins', metric: 'Objects counted' } },
  { id: 'M04', title: 'Top-hat and black-hat', segment: 'morph', tier: 'mvp', requiredCvApis: ['morphologyEx', 'getStructuringElement', 'threshold', 'connectedComponentsWithStats'], needs: 'gray', blurb: 'Subtract the background estimate, then threshold.', heroImage: 'coins', alsoGoodOn: ['text', 'cell'], scope: 'table', explainer: 'structuring',
    params: [select('op', 'Operation', [['tophat', 'White top-hat'], ['blackhat', 'Black-hat']], 'tophat'), seShape(), ...kernelPair(61).slice(0, 1), check('otsu', 'Then Otsu', true), range('minArea', 'Min area (px)', 0, 1000, 5, 200)], heroParams: { op: 'tophat', shape: 'ellipse', k: 61, kh: 0, otsu: true, minArea: 200 },
    challenge: { prompt: 'Make the coin count exactly 24.', check: (m) => m.kept === 24, imageId: 'coins', metric: 'Objects counted' } },

  // ---- World 7: Frequency domain
  { id: 'Q01', title: 'DFT spectrum', segment: 'freq', tier: 'p2', requiredCvApis: ['dft', 'getOptimalDFTSize', 'copyMakeBorder'], needs: 'gray', heavy: true, blurb: 'See the image as a sum of waves.', heroImage: 'brick', alsoGoodOn: ['gravel', 'clock_motion', 'grass'], scope: 'spectrum', explainer: 'spectrum', params: [] },
  { id: 'Q02', title: 'Low-pass filter', segment: 'freq', tier: 'p2', requiredCvApis: ['dft', 'getOptimalDFTSize', 'copyMakeBorder'], needs: 'gray', heavy: true, blurb: 'Keep low frequencies, drop the rest.', heroImage: 'cameraman', alsoGoodOn: ['cat'], scope: 'spectrum', explainer: 'spectrum',
    params: [select('kind', 'Mask', [['gaussian', 'Gaussian'], ['ideal', 'Ideal (hard cutoff)']], 'gaussian'), range('d0', 'Cutoff D0 (px)', 3, 200, 1, 30)], heroParams: { kind: 'gaussian', d0: 30 } },
  { id: 'Q03', title: 'High-pass filter', segment: 'freq', tier: 'p2', requiredCvApis: ['dft', 'getOptimalDFTSize', 'copyMakeBorder'], needs: 'gray', heavy: true, blurb: 'Remove the smooth parts; keep edges and texture.', heroImage: 'circuit_board', alsoGoodOn: ['gravel', 'cameraman'], scope: 'spectrum', explainer: 'spectrum',
    params: [select('kind', 'Mask', [['gaussian', 'Gaussian'], ['ideal', 'Ideal (hard cutoff)']], 'gaussian'), range('d0', 'Cutoff D0 (px)', 3, 200, 1, 30), select('display', 'Show negatives as', [['offset', 'Offset +128'], ['clip', 'Clip to 0']], 'offset')], heroParams: { kind: 'gaussian', d0: 30, display: 'offset' } },
  { id: 'Q04', title: 'Ideal vs Gaussian: ringing', segment: 'freq', tier: 'p2', requiredCvApis: ['dft', 'getOptimalDFTSize', 'copyMakeBorder'], needs: 'gray', heavy: true, blurb: 'Same cutoff, two masks: one rings, one does not.', heroImage: 'cameraman', alsoGoodOn: ['text'], scope: 'spectrum', explainer: 'spectrum',
    params: [range('d0', 'Cutoff D0 (px)', 3, 200, 1, 30), select('show', 'Show', [['ideal', 'Ideal'], ['gaussian', 'Gaussian']], 'ideal')], heroParams: { d0: 30, show: 'ideal' } },

  // ---- World 8: Features and shapes
  { id: 'FT01', title: 'Template matching', segment: 'features', tier: 'stretch', requiredCvApis: ['matchTemplate', 'cvtColor'], needs: 'gray', pickRect: true, blurb: 'Slide a small picture over a big one and score every position.', heroImage: 'cards', alsoGoodOn: ['circuit_board'], scope: 'heatmap', explainer: 'overlay',
    params: [range('tx', 'Template x', 0, 1023, 1, 190, 'Draw a rectangle on the stage, or type the numbers.'), range('ty', 'Template y', 0, 1023, 1, 90), range('tw', 'Template width', 4, 200, 1, 17), range('th', 'Template height', 4, 200, 1, 22), range('score', 'Match score at least', 0.5, 1, 0.01, 0.9)], heroParams: { tx: 190, ty: 90, tw: 17, th: 22, score: 0.9 } },
  { id: 'FT02', title: 'Harris corners', segment: 'features', tier: 'stretch', requiredCvApis: ['cornerHarris'], needs: 'gray', blurb: 'Find places where intensity changes in every direction.', heroImage: 'blocks', alsoGoodOn: ['text'], scope: 'table', explainer: 'overlay',
    params: [range('block', 'Window size', 2, 7, 1, 2), range('k', 'k', 0.02, 0.1, 0.005, 0.04), range('thr', 'Threshold (× max response)', 0.001, 0.2, 0.001, 0.01)], heroParams: { block: 2, k: 0.04, thr: 0.01 } },
  { id: 'FT03', title: 'Contours', segment: 'features', tier: 'stretch', requiredCvApis: ['findContours', 'contourArea', 'threshold'], needs: 'binary', blurb: 'Trace the outline of every shape.', heroImage: 'horse', alsoGoodOn: ['shapes', 'coins'], scope: 'table', explainer: 'overlay',
    params: [...binParams(), range('minArea', 'Min area (px)', 0, 2000, 10, 20)], heroParams: { thr: 0, invert: true, minArea: 20 } },
  { id: 'FT04', title: 'Hough lines', segment: 'features', tier: 'stretch', requiredCvApis: ['Canny', 'HoughLinesP'], needs: 'gray', heavy: true, blurb: 'Every edge pixel votes for the lines through it.', heroImage: 'sudoku', alsoGoodOn: ['building', 'brick'], scope: 'heatmap', explainer: 'overlay',
    params: [range('t1', 'Canny low', 0, 255, 1, 50), range('t2', 'Canny high', 0, 255, 1, 150), range('votes', 'Votes at least', 10, 300, 5, 100), range('minLen', 'Min length (px)', 10, 300, 5, 100), range('maxGap', 'Max gap (px)', 1, 50, 1, 10)], heroParams: { t1: 50, t2: 150, votes: 100, minLen: 100, maxGap: 10 } },
  { id: 'FT05', title: 'Hough circles', segment: 'features', tier: 'stretch', requiredCvApis: ['HoughCircles', 'medianBlur'], needs: 'gray', heavy: true, blurb: 'Edge pixels vote for circle centres.', heroImage: 'smarties', alsoGoodOn: ['coins'], scope: 'table', explainer: 'overlay',
    params: [range('median', 'Median blur (odd)', 3, 9, 2, 5), range('minDist', 'Min distance (px)', 5, 100, 1, 30), range('param1', 'Canny high (param1)', 20, 255, 5, 100), range('param2', 'Votes needed (param2)', 5, 100, 1, 30), range('rMin', 'Min radius', 1, 100, 1, 10), range('rMax', 'Max radius', 5, 200, 1, 40)], heroParams: { median: 5, minDist: 30, param1: 100, param2: 30, rMin: 10, rMax: 40 },
    challenge: { prompt: 'Find all 12 candies.', check: (m) => m.circles === 12, imageId: 'smarties', metric: 'Circles found' } },

  // ---- World 9: Geometry
  { id: 'G01', title: 'Rotate and scale', segment: 'geometry', tier: 'stretch', requiredCvApis: ['warpAffine', 'getRotationMatrix2D'], blurb: 'Rotate and scale about the centre, in one pass or several.', heroImage: 'rocket', alsoGoodOn: ['cameraman'], scope: 'table',
    params: [range('angle', 'Angle (°)', -180, 180, 1, 15), range('scale', 'Scale', 0.5, 2, 0.05, 1), range('passes', 'Passes', 1, 8, 1, 1, 'Split the same rotation into several steps.')], heroParams: { angle: 15, scale: 1, passes: 1 } },
  { id: 'G02', title: 'Translate and shear', segment: 'geometry', tier: 'stretch', requiredCvApis: ['warpAffine'], blurb: 'Move and slant the picture; see what fills the gap.', heroImage: 'rocket', alsoGoodOn: ['cameraman'], scope: 'histogram',
    params: [range('tx', 'Shift x', -200, 200, 5, 60), range('ty', 'Shift y', -200, 200, 5, 0), range('shear', 'Shear', -0.5, 0.5, 0.05, 0.2), select('border', 'Outside pixels', [['constant', 'Black'], ['replicate', 'Replicate edge'], ['reflect', 'Mirror']], 'constant')], heroParams: { tx: 60, ty: 0, shear: 0.2, border: 'replicate' } },
  { id: 'G03', title: 'Perspective fix', segment: 'geometry', tier: 'stretch', requiredCvApis: ['warpPerspective', 'getPerspectiveTransform'], pickCorners: true, blurb: 'Straighten a skewed page from four corner points.', heroImage: 'sudoku', alsoGoodOn: ['cards'], scope: 'histogram',
    params: [range('size', 'Output size (px)', 200, 600, 10, 450), ...[0, 1, 2, 3].flatMap((i) => [range(`x${i}`, `Corner ${i + 1} x`, 0, 1023, 1, sudokuCorners[`x${i}`], undefined, true), range(`y${i}`, `Corner ${i + 1} y`, 0, 1023, 1, sudokuCorners[`y${i}`], undefined, true)])], heroParams: { size: 450, ...sudokuCorners } },

  // ---- Explainer-only (never a fake demo)
  { id: 'SIFT', title: 'SIFT', segment: 'features', tier: 'out', explainerOnly: true, params: [], requiredCvApis: ['SIFT'], blurb: 'Scale-invariant keypoints and descriptors.', heroImage: 'building' },
  { id: 'HOG', title: 'HOG', segment: 'features', tier: 'out', explainerOnly: true, params: [], requiredCvApis: ['HOGDescriptor'], blurb: 'Histograms of oriented gradients.', heroImage: 'cameraman' },
  { id: 'SNAKE', title: 'Active contours', segment: 'features', tier: 'out', explainerOnly: true, params: [], requiredCvApis: ['activeContour'], blurb: 'Snakes: contours that wriggle onto boundaries.', heroImage: 'coins' },
];

const ORDER = DEFS.map((d) => d.id);

const EXPLAINER_TEXT: Record<string, string> = {
  SIFT: 'Exact: SIFT finds blob-like keypoints in a scale-space pyramid (difference-of-Gaussians extrema), assigns each a dominant orientation, and describes the patch around it with a 128-number histogram of gradient orientations. Parameters: octaves, contrast threshold, edge threshold. Domain: float gray. Border: n/a. Display mapping: n/a. This runs in Python in the course labs, not in this browser lab, because the default OpenCV.js build does not include it.',
  HOG: 'Exact: divide the window into cells, histogram the gradient orientations in each cell (weighted by gradient magnitude), normalise over overlapping blocks of cells, and concatenate into one long descriptor that a classifier can read. Parameters: cell size, block size, bins. Domain: float gray. Border: n/a. Display mapping: n/a. This runs in Python in the course labs, not in this browser lab.',
  SNAKE: 'Exact: a closed curve v(s) is moved to minimise an energy E = ∫ (α|v′|² + β|v″|²) ds − λ|∇I(v)|²: the first two terms keep the curve short and smooth, the last pulls it toward strong edges. Parameters: α, β, λ, iterations. Domain: float gray. Border: n/a. Display mapping: n/a. This runs in Python in the course labs, not in this browser lab.',
};
const EXPLAINER_NOTES: Record<string, string[]> = {
  SIFT: ['Keypoints are found in a pyramid of blurred copies, so the same object is recognised at different sizes.', 'Each keypoint gets an orientation from local gradients, so rotation does not matter.', 'The 128-number descriptor is compared between images to find matches; it is robust to modest lighting change.'],
  HOG: ['Each cell summarises "which way do edges point here" as a small histogram.', 'Block normalisation makes the descriptor tolerant to local contrast changes.', 'The whole descriptor is fed to a classifier (classically an SVM) to decide "person" or "not person".'],
  SNAKE: ['The curve is pulled toward edges by an image force and held together by internal smoothness forces.', 'It needs a starting curve near the boundary; a poor start finds the wrong edge.', 'Too much stiffness cuts corners; too little lets it leak into noise.'],
};
const EXPLAINER_WATCH: Record<string, string> = {
  SIFT: 'Watch out: this lab never fakes a SIFT result. Use the Python lab to try it.',
  HOG: 'Watch out: a descriptor alone detects nothing; it needs a trained classifier on top.',
  SNAKE: 'Watch out: snakes depend on a good initial curve and on the energy weights.',
};

export const TECHNIQUES: TechniqueSpec[] = ORDER.map((id) => {
  const d = DEFS.find((x) => x.id === id)!;
  const run = RUNNERS[id] ?? ((): never => {
    throw new Error(`${id} is an explainer-only concept and has no demo.`);
  });
  if (!RUNNERS[id] && !d.explainerOnly) throw new Error(`Missing runner ${id}`);
  const explainer = !!d.explainerOnly;
  return {
    ...d,
    question: QUESTIONS[id] ?? d.blurb,
    run,
    exactTemplate: explainer ? EXPLAINER_TEXT[id] : (EXACT[id] ?? ''),
    effectNotes: explainer ? EXPLAINER_NOTES[id] : (EFFECT_NOTES[id] ?? []),
    misconception: explainer ? EXPLAINER_WATCH[id] : MISCONCEPTIONS[id],
    selfCheck: SELF_CHECKS[id],
    sampleHint: d.heroImage,
  } as TechniqueSpec;
});

export const techniqueById = (id: string): TechniqueSpec | undefined => TECHNIQUES.find((t) => t.id === id);
export const techniquesIn = (segment: string): TechniqueSpec[] => TECHNIQUES.filter((t) => t.segment === segment);
export const defaultParams = (t: TechniqueSpec): Record<string, ParamValue> => Object.fromEntries(t.params.map((p) => [p.key, p.default]));
/** Hero-demo parameters: defaults overridden by heroParams. */
export const heroParamsOf = (t: TechniqueSpec): Record<string, ParamValue> => ({ ...defaultParams(t), ...(t.heroParams ?? {}) });
export { SEGMENTS };
export type { SegmentSpec };
