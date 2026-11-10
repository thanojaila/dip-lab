import { h } from '../dom';

/** Float map with a simple dark→violet→coral→sun ramp; optional peak marks. */
export class Heatmap {
  readonly el: HTMLElement;
  private canvas = h('canvas', { role: 'img' });
  private text = h('p', { class: 'summary' });

  constructor() {
    this.canvas.style.maxHeight = '280px';
    this.el = h('div', {}, this.canvas, this.text);
  }

  set(map: { w: number; h: number; data: Float32Array; label: string; marks?: [number, number][] } | null): void {
    if (!map) {
      this.canvas.width = 1;
      this.canvas.height = 1;
      this.text.textContent = 'Run a concept that scores positions or votes to see its map.';
      this.canvas.setAttribute('aria-label', 'Heat map: not available');
      return;
    }
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < map.data.length; i++) { const v = map.data[i]; if (v < min) min = v; if (v > max) max = v; }
    const range = max - min || 1;
    this.canvas.width = map.w;
    this.canvas.height = map.h;
    const ctx = this.canvas.getContext('2d')!;
    const img = ctx.createImageData(map.w, map.h);
    const stops: [number, number, number][] = [[20, 17, 40], [108, 76, 241], [255, 107, 87], [255, 197, 61]];
    for (let i = 0; i < map.data.length; i++) {
      const t = Math.min(1, Math.max(0, (map.data[i] - min) / range)) * 3;
      const k = Math.min(2, Math.floor(t)), f = t - k;
      for (let c = 0; c < 3; c++) img.data[i * 4 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, map.w / 150);
    for (const [x, y] of map.marks ?? []) { ctx.beginPath(); ctx.arc(x, y, Math.max(4, map.w / 40), 0, 2 * Math.PI); ctx.stroke(); }
    const msg = `${map.label}. Range ${min.toFixed(2)} to ${max.toFixed(2)}${map.marks ? `; ${map.marks.length} peaks marked` : ''}.`;
    this.text.textContent = msg;
    this.canvas.setAttribute('aria-label', msg);
  }
}
