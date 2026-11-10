import { cdf, histStats } from '../../alg/histogram';
import { histogramFromPixels, isGrayPixels, type HistChannel } from '../../core/imageOps';
import type { Pixels } from '../../core/matIO';
import { h, nextId } from '../dom';

/** Before and after histograms overlaid, with an optional CDF. */
export class HistogramScope {
  readonly el: HTMLElement;
  private canvas = h('canvas', { width: 512, height: 170, role: 'img' });
  private summary = h('p', { class: 'summary' });
  private showCdf = h('input', { type: 'checkbox', id: nextId('cdf') });
  private chan = h('select', { id: nextId('hch') });
  private orig: Pixels | null = null;
  private res: Pixels | null = null;

  constructor() {
    for (const [v, t] of [['gray', 'Gray (luma)'], ['r', 'Red'], ['g', 'Green'], ['b', 'Blue']]) this.chan.appendChild(h('option', { value: v }, t));
    const redraw = () => this.draw();
    this.showCdf.addEventListener('change', redraw);
    this.chan.addEventListener('change', redraw);
    this.el = h('div', {}, h('div', { class: 'scope-controls' }, h('label', { for: (this.chan as HTMLSelectElement).id, class: 'inline' }, 'Channel'), this.chan, h('label', { class: 'inline', for: (this.showCdf as HTMLInputElement).id }, this.showCdf, 'CDF')), this.canvas, this.summary);
  }

  set(orig: Pixels | null, res: Pixels | null): void {
    this.orig = orig;
    this.res = res;
    this.draw();
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const W = this.canvas.width, H = this.canvas.height;
    const css = getComputedStyle(document.documentElement);
    const a = css.getPropertyValue('--hist-a').trim() || '#6c4cf1';
    const b = css.getPropertyValue('--hist-b').trim() || '#ff6b57';
    const ink = css.getPropertyValue('--ink').trim() || '#1f1b3a';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = css.getPropertyValue('--surface').trim() || '#fff';
    ctx.fillRect(0, 0, W, H);
    const base = this.res ?? this.orig;
    if (!base) {
      this.summary.textContent = 'Choose an image to see its histogram.';
      this.canvas.setAttribute('aria-label', 'Histogram: no image yet');
      return;
    }
    const gray = isGrayPixels(base) && (!this.orig || isGrayPixels(this.orig));
    (this.chan as HTMLSelectElement).disabled = gray;
    const ch: HistChannel = gray ? 'gray' : ((this.chan as HTMLSelectElement).value as HistChannel);
    const hr = this.res ? histogramFromPixels(this.res, ch) : null;
    const ho = this.orig ? histogramFromPixels(this.orig, ch) : null;
    const max = Math.max(1, ...(hr ?? []), ...(ho ?? []));
    const bw = W / 256;
    if (hr) {
      ctx.fillStyle = a;
      for (let v = 0; v < 256; v++) { const bh = (hr[v] / max) * (H - 8); ctx.fillRect(v * bw, H - bh, Math.max(1, bw - 0.5), bh); }
    }
    if (ho) {
      ctx.strokeStyle = hr ? b : a;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let v = 0; v < 256; v++) { const y = H - (ho[v] / max) * (H - 8); if (v === 0) ctx.moveTo(0, y); else ctx.lineTo(v * bw, y); }
      ctx.stroke();
    }
    if ((this.showCdf as HTMLInputElement).checked) {
      const c = cdf(hr ?? ho!);
      ctx.strokeStyle = ink;
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let v = 0; v < 256; v++) { const x = v * bw + bw / 2, y = H - c[v] * (H - 8); if (v === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const so = ho ? histStats(ho) : null, sr = hr ? histStats(hr) : null;
    const f = (s: ReturnType<typeof histStats> | null, n: string) => (s ? `${n}: min ${s.min}, max ${s.max}, mean ${s.mean.toFixed(1)}, σ ${s.std.toFixed(1)}, ${s.occupied}/256 levels used` : '');
    const text = [f(so, 'Original (outline)'), f(sr, 'Result (filled)')].filter(Boolean).join('. ') + '.';
    this.summary.textContent = text;
    this.canvas.setAttribute('aria-label', `Histogram, ${gray ? 'gray' : ch}. ${text}`);
  }
}
