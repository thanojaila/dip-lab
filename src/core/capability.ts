import type { TechniqueSpec } from './types';

/** APIs the MVP expects (SRS §5.1). CLAHE is the OpenCV.js class behind createCLAHE. */
export const PROBED_APIS = [
  'cvtColor', 'resize', 'threshold', 'blur', 'GaussianBlur', 'medianBlur', 'bilateralFilter',
  'filter2D', 'Sobel', 'Canny', 'morphologyEx', 'erode', 'dilate', 'equalizeHist', 'CLAHE',
  'calcHist', 'LUT', 'absdiff', 'addWeighted', 'magnitude', 'connectedComponentsWithStats',
  'getStructuringElement',
] as const;

/** Never assumed; reported as unavailable so learners are pointed to Python labs. */
export const NEVER_ASSUMED = ['SIFT', 'xfeatures2d'] as const;

export type CapabilityMap = Record<string, boolean>;

export function probe(cv: Record<string, unknown>, apis: readonly string[] = PROBED_APIS): CapabilityMap {
  const out: CapabilityMap = {};
  for (const a of apis) out[a] = typeof cv[a] === 'function';
  return out;
}

export function missingApis(spec: Pick<TechniqueSpec, 'requiredCvApis'>, caps: CapabilityMap): string[] {
  return spec.requiredCvApis.filter((a) => caps[a] !== true);
}
