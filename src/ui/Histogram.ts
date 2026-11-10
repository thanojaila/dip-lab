import { cdf, histStats } from '../alg/histogram';
import { histogramFromPixels, isGrayPixels, type HistChannel } from '../core/imageOps';
import type { Pixels } from '../core/matIO';
import { clear, h, nextId } from './dom';

export class HistogramPanel {
  readonly el: HTMLElement;
  private canvas = h('canvas', { width: 512, height: 150, role: 'img' });
  private summary = h('p', { class: 'hist-summary' });
  private showCdf = h('input', { type: 'checkbox', id: nextId('cdf') });
  private chan = h('select', { id: nextId('hch') });
  private src = h('select', { id: nextId('hsrc') });
  private pixels: { input: Pixels | null; result: Pixels | null } = { input: null, result: null };

  constructor() {
    const cdfId = this.showCdf.id;
    for (const [v, t] of [['gray', 'Gray (luma)'], ['r', 'Red'], ['g', 'Green'], ['b', 'Blue']]) this.chan.appendChild(h('option', { value: v }, t));
    for (const [v, t] of [['result', 'Result'], ['input', 'Original']]) this.src.appendChild(h('option', { value: v }, t));
    const redraw = () => this.draw();
    this.showCdf.addEventListener('change', redraw);
    this.chan.addEventListener('change', redraw);
    this.src.addEventListener('change', redraw);
    this.el = h(
      'section',
      { class: 'panel', 'aria-labelledby': 'hist-h' },
      h('h2', { id: 'hist-h' }, 'Gray-level distribution'),
      h(
        'div',
        { class: 'hist-controls' },
        h('label', { for: this.src.id }, 'Show '),
        this.src,
        h('label', { for: this.chan.id }, 'Channel '),
        this.chan,
        h('label', { class: 'inline', for: cdfId }, this.showCdf, ' CDF'),
      ),
      this.canvas,
      this.summary,
    );
  }

  set(input: Pixels | null, result: Pixels | null): void {
    this.pixels = { input, result };
    this.draw();
  }

  private draw(): void {
    const which = (this.src as HTMLSelectElement).value as 'input' | 'result';
    const px = this.pixels[which] ?? this.pixels.input;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const W = this.canvas.width, H = this.canvas.height;
    const css = getComputedStyle(document.documentElement);
    const bar = css.getPropertyValue('--hist-bar').trim() || '#2563a8';
    const line = css.getPropertyValue('--hist-cdf').trim() || '#b4540a';
    const bg = css.getPropertyValue('--surface').trim() || '#fff';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    if (!px) {
      this.canvas.setAttribute('aria-label', 'Histogram: no image yet');
      this.summary.textContent = 'Choose an image to see its histogram.';
      return;
    }
    const gray = isGrayPixels(px);
    (this.chan as HTMLSelectElement).disabled = gray;
    const ch: HistChannel = gray ? 'gray' : ((this.chan as HTMLSelectElement).value as HistChannel);
    const hist = histogramFromPixels(px, ch);
    const max = Math.max(1, ...hist);
    const bw = W / 256;
    ctx.fillStyle = bar;
    for (let v = 0; v < 256; v++) {
      const bh = (hist[v] / max) * (H - 6);
      ctx.fillRect(v * bw, H - bh, Math.max(1, bw - 0.5), bh);
    }
    if ((this.showCdf as HTMLInputElement).checked) {
      const c = cdf(hist);
      ctx.strokeStyle = line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let v = 0; v < 256; v++) {
        const x = v * bw + bw / 2, y = H - c[v] * (H - 6);
        if (v === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const s = histStats(hist);
    const text = `${which === 'result' ? 'Result' : 'Original'}, ${gray ? 'gray' : ch}: ${s.n} pixels, min ${s.min}, max ${s.max}, mean ${s.mean.toFixed(1)}, σ ${s.std.toFixed(1)}, ${s.occupied}/256 bins used.`;
    this.summary.textContent = text;
    this.canvas.setAttribute('aria-label', `Histogram. ${text}`);
  }
}

export function clearNode(n: Node): void {
  clear(n);
}
