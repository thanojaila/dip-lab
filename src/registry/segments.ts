import type { SegmentSpec } from '../core/types';

export const SEGMENTS: SegmentSpec[] = [
  { id: 'foundations', index: 0, title: 'Foundations', tagline: 'What an image is: pixels, gray conversion, sampling and quantization.' },
  { id: 'point', index: 1, title: 'Point processing', tagline: 'One pixel in, one pixel out: negative, brightness, stretch, log, gamma, threshold.' },
  { id: 'histogram', index: 2, title: 'Histogram', tagline: 'Reading and reshaping the distribution of gray levels.' },
  { id: 'noise', index: 3, title: 'Noise & smoothing', tagline: 'Add controlled noise, then compare box, Gaussian and median filters.' },
  { id: 'sharpen', index: 4, title: 'Edge-preserving & sharpening', tagline: 'Bilateral filtering, unsharp masking and Laplacian sharpening.' },
  { id: 'edges', index: 5, title: 'Edges', tagline: 'Gradient magnitude and the Canny detector.' },
  { id: 'morphology', index: 6, title: 'Morphology', tagline: 'Erode, dilate, open, close, gradient and counting particles.' },
  { id: 'beyond', index: 7, title: 'Beyond this build', tagline: 'Frequency domain (Phase 2), features (stretch) and what is deliberately not in the browser.' },
];
