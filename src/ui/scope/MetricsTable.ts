import { clear, h } from '../dom';

const LABELS: Record<string, string> = {
  psnr: 'PSNR of the result vs the clean photo (dB)',
  psnrInput: 'PSNR of the input vs the clean photo (dB)',
  stdBefore: 'Standard deviation before',
  stdAfter: 'Standard deviation after',
  componentsBefore: 'Components before',
  componentsAfter: 'Components after',
  total: 'Raw components',
  kept: 'Objects counted (area filter applied)',
  removed: 'Specks removed',
  threshold: 'Threshold used',
  otsuT: 'Otsu threshold',
  otsuBlackLL: 'Otsu: black share, lower-left quarter',
  adaptiveBlackLL: 'Adaptive: black share, lower-left quarter',
  gxMean: 'Mean |Gx| (vertical edges)',
  gyMean: 'Mean |Gy| (horizontal edges)',
  edgePixels: 'Edge pixels',
  blobs: 'Colour blobs (≥ 150 px)',
  components: 'All components',
  matches: 'Matches',
  best: 'Best score',
  corners: 'Corners',
  contours: 'Outer contours',
  largestPoints: 'Points in the largest contour',
  segments: 'Line segments',
  circles: 'Circles',
  energyRadius95: 'Radius holding 95% of the energy (px)',
  dcLog: 'log(1 + |DC|)',
  idealMin: 'Ideal: lowest value before clipping',
  idealMax: 'Ideal: highest value before clipping',
  gaussMin: 'Gaussian: lowest value before clipping',
  gaussMax: 'Gaussian: highest value before clipping',
  idealOvershoot: 'Ideal: overshoot outside 0–255',
  gaussOvershoot: 'Gaussian: overshoot outside 0–255',
  sharpnessBefore: 'Sharpness before (Laplacian variance)',
  sharpnessAfter: 'Sharpness after (Laplacian variance)',
  mean: 'Mean', std: 'Standard deviation', min: 'Lowest', max: 'Highest', binsUsed: 'Levels used',
};

export const metricLabel = (k: string): string => LABELS[k] ?? k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
export const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(2));

/** Result table (counts, PSNR, ...). */
export class MetricsTable {
  readonly el = h('div', {});
  set(metrics: Record<string, number> | null, summary?: string): void {
    clear(this.el);
    if (!metrics || !Object.keys(metrics).length) {
      this.el.appendChild(h('p', { class: 'summary' }, 'No numbers for this run yet.'));
      return;
    }
    const t = h('table', { class: 'metrics' });
    t.appendChild(h('caption', { class: 'sr-only' }, 'Measured results'));
    for (const [k, v] of Object.entries(metrics)) t.appendChild(h('tr', {}, h('th', { scope: 'row' }, metricLabel(k)), h('td', { class: 'v' }, fmt(v))));
    this.el.appendChild(t);
    if (summary) this.el.appendChild(h('p', { class: 'summary', 'aria-live': 'polite' }, summary));
  }
}
