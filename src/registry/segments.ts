import type { SegmentSpec } from '../core/types';

/** Worlds (called "segments" in the data model so v1 config files and tests keep working). */
export const SEGMENTS: SegmentSpec[] = [
  { id: 'pixels', index: 0, title: 'Pixels', accent: 'primary', tagline: 'A photo is a grid of numbers. Colour, resolution and gray levels decide what survives.' },
  { id: 'point', index: 1, title: 'Point operations', accent: 'coral', tagline: 'One pixel in, one pixel out: a lookup table you can draw as a curve.' },
  { id: 'hist', index: 2, title: 'Histograms', accent: 'teal', tagline: 'The distribution of gray levels, and how to reshape it.' },
  { id: 'noise', index: 3, title: 'Noise and smoothing', accent: 'sun', tagline: 'Two kinds of noise, three filters, and a clinic to find which works.' },
  { id: 'sharpen', index: 4, title: 'Keep the edges, sharpen the detail', accent: 'plum', tagline: 'Bilateral filtering, unsharp masking, Laplacian sharpening.' },
  { id: 'edges', index: 5, title: 'Edges', accent: 'sky', tagline: 'Where intensity changes fast: gradients and the Canny detector.' },
  { id: 'morph', index: 6, title: 'Thresholds and morphology', accent: 'primary', tagline: 'Turn gray into shapes, then clean, count and outline them.' },
  { id: 'freq', index: 7, title: 'Frequency domain', accent: 'coral', tagline: 'See an image as waves: spectrum, low-pass, high-pass, ringing.' },
  { id: 'features', index: 8, title: 'Features and shapes', accent: 'teal', tagline: 'Templates, corners, contours, lines and circles.' },
  { id: 'geometry', index: 9, title: 'Geometry', accent: 'sun', tagline: 'Rotate, scale, shear and straighten.', note: 'Listed in the syllabus; covered lightly.' },
];
