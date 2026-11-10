import type { PlainPixels } from '../../core/types';
import { h } from '../dom';
import { drawPixels } from '../stage/draw';

/** Log-magnitude spectrum with the cutoff circle. Drag (or use arrow keys) to change D0. */
export class SpectrumScope {
  readonly el: HTMLElement;
  private canvas = h('canvas', { tabindex: 0, role: 'slider', 'aria-label': 'Spectrum. Drag a circle to set the cutoff D0, or use the arrow keys.', 'aria-valuemin': 3, 'aria-valuemax': 200 });
  private text = h('p', { class: 'summary' });
  private spec: PlainPixels | null = null;
  private d0: number | null = null;
  private timer = 0;
  onCutoff: (d0: number) => void = () => undefined;

  constructor() {
    this.canvas.style.touchAction = 'none';
    const radiusAt = (e: PointerEvent): number => {
      const r = this.canvas.getBoundingClientRect();
      const sx = this.canvas.width / r.width, sy = this.canvas.height / r.height;
      const x = (e.clientX - r.left) * sx - this.canvas.width / 2, y = (e.clientY - r.top) * sy - this.canvas.height / 2;
      return Math.max(3, Math.min(200, Math.round(Math.hypot(x, y))));
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this.d0 = radiusAt(e);
      this.draw();
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.canvas.hasPointerCapture(e.pointerId)) return;
      this.d0 = radiusAt(e);
      this.draw();
    });
    this.canvas.addEventListener('pointerup', () => {
      if (this.d0 !== null) this.onCutoff(this.d0);
    });
    this.canvas.addEventListener('keydown', (e) => {
      if (this.d0 === null) return;
      const st = e.shiftKey ? 10 : 1;
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? st : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -st : 0;
      if (!d) return;
      e.preventDefault();
      this.d0 = Math.max(3, Math.min(200, this.d0 + d));
      this.draw();
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.onCutoff(this.d0!), 350);
    });
    this.el = h('div', {}, this.canvas, this.text);
  }

  set(spec: PlainPixels | null, d0: number | null): void {
    this.spec = spec;
    this.d0 = d0;
    this.draw();
  }

  private draw(): void {
    if (!this.spec) {
      drawPixels(this.canvas, null);
      this.text.textContent = 'Run a frequency-domain concept to see the spectrum.';
      return;
    }
    drawPixels(this.canvas, this.spec);
    const ctx = this.canvas.getContext('2d')!;
    const cx = this.spec.w / 2, cy = this.spec.h / 2;
    if (this.d0 !== null) {
      for (const [st, w] of [['#000', 4], ['#ffc53d', 2]] as const) {
        ctx.strokeStyle = st;
        ctx.lineWidth = w * Math.max(1, this.spec.w / 300);
        ctx.beginPath();
        ctx.arc(cx, cy, this.d0, 0, 2 * Math.PI);
        ctx.stroke();
      }
      this.canvas.setAttribute('aria-valuenow', String(this.d0));
      this.canvas.setAttribute('aria-valuetext', `Cutoff D0 ${this.d0} pixels from the centre`);
    }
    this.text.textContent = `Spectrum ${this.spec.w}×${this.spec.h}: the centre is the average brightness, distance from the centre is frequency, brightness is log(1 + |F|).${this.d0 !== null ? ` Circle: cutoff D0 = ${this.d0} px (drag to change; it updates on release).` : ''}`;
  }
}
