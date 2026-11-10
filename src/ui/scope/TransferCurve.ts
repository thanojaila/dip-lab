import { h } from '../dom';

/** s = T(r) as a curve, with the inspected pixel marked. */
export class TransferCurve {
  readonly el: HTMLElement;
  private canvas = h('canvas', { width: 300, height: 300, role: 'img' });
  private text = h('p', { class: 'summary' });
  private table: number[] | null = null;
  private mark: number | null = null;

  constructor() {
    this.el = h('div', {}, this.canvas, this.text);
  }

  set(table: number[] | null): void {
    this.table = table;
    this.draw();
  }
  setMark(r: number | null): void {
    this.mark = r;
    this.draw();
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const W = this.canvas.width, H = this.canvas.height, pad = 22;
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim() || '#1f1b3a';
    const a = css.getPropertyValue('--hist-a').trim() || '#6c4cf1';
    const b = css.getPropertyValue('--hist-b').trim() || '#ff6b57';
    const X = (r: number) => pad + (r / 255) * (W - 2 * pad);
    const Y = (s: number) => H - pad - (s / 255) * (H - 2 * pad);
    ctx.fillStyle = css.getPropertyValue('--surface').trim() || '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = css.getPropertyValue('--muted').trim() || '#888';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(X(i * 63.75), Y(0)); ctx.lineTo(X(i * 63.75), Y(255)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(0), Y(i * 63.75)); ctx.lineTo(X(255), Y(i * 63.75)); ctx.stroke();
    }
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(255), Y(255)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ink;
    ctx.font = '12px sans-serif';
    ctx.fillText('r (input)', W - 70, H - 6);
    ctx.fillText('s', 4, 14);
    if (!this.table) {
      this.text.textContent = 'This concept has no single transfer curve for the current result.';
      this.canvas.setAttribute('aria-label', 'Transfer curve: not available');
      return;
    }
    ctx.strokeStyle = a;
    ctx.lineWidth = 3;
    ctx.beginPath();
    this.table.forEach((s, r) => (r === 0 ? ctx.moveTo(X(r), Y(s)) : ctx.lineTo(X(r), Y(s))));
    ctx.stroke();
    let msg = 'Dashed line: no change (s = r).';
    if (this.mark !== null) {
      const r = this.mark, sv = this.table[r];
      ctx.strokeStyle = b;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(r), Y(0)); ctx.lineTo(X(r), Y(sv)); ctx.lineTo(X(0), Y(sv)); ctx.stroke();
      ctx.fillStyle = b;
      ctx.beginPath(); ctx.arc(X(r), Y(sv), 5, 0, 2 * Math.PI); ctx.fill();
      msg = `Inspected pixel: r = ${r} → s = ${sv}. ${msg}`;
    }
    this.text.textContent = msg;
    this.canvas.setAttribute('aria-label', `Transfer curve s = T(r). ${msg} Value at 0 is ${this.table[0]}, at 128 is ${this.table[128]}, at 255 is ${this.table[255]}.`);
  }
}
