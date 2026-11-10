import { clear, h, nextId } from '../dom';
import type { Pixels } from '../../core/matIO';
import { isGrayPixels } from '../../core/imageOps';

export type Channel = 'gray' | 'r' | 'g' | 'b';

export function valueAt(p: Pixels, x: number, y: number, ch: Channel): number | null {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return null;
  const o = (y * p.w + x) * 4;
  if (ch === 'r') return p.data[o];
  if (ch === 'g') return p.data[o + 1];
  if (ch === 'b') return p.data[o + 2];
  return Math.round(0.299 * p.data[o] + 0.587 * p.data[o + 1] + 0.114 * p.data[o + 2]);
}

/** Magnified 9×9 neighbourhood with the numbers, for the original and the result at the same spot. */
export class PixelInspector {
  readonly el: HTMLElement;
  private orig: Pixels | null = null;
  private res: Pixels | null = null;
  private x = 0;
  private y = 0;
  private u = 0.5;
  private v = 0.5;
  private chan = h('select', { id: nextId('ich') });
  private posEl = h('p', { class: 'pos', 'aria-live': 'polite' });
  private gridA = h('div', {});
  private gridB = h('div', {});
  private raf = 0;
  onChange: (original: number | null, x: number, y: number) => void = () => undefined;

  constructor() {
    for (const [v, t] of [['gray', 'Gray'], ['r', 'Red'], ['g', 'Green'], ['b', 'Blue']]) this.chan.appendChild(h('option', { value: v }, t));
    this.chan.addEventListener('change', () => this.render());
    this.el = h(
      'section',
      { class: 'inspector', 'aria-label': 'Pixel inspector' },
      h('div', { class: 'row' }, h('h2', {}, 'Pixel inspector'), h('label', { for: (this.chan as HTMLSelectElement).id, class: 'inline' }, 'Channel'), this.chan),
      this.posEl,
      h('div', {}, h('h3', {}, 'Original'), this.gridA),
      h('div', {}, h('h3', {}, 'Result'), this.gridB),
    );
    (this.el.firstElementChild as HTMLElement).style.gridColumn = '1 / -1';
  }

  setImages(orig: Pixels | null, res: Pixels | null): void {
    this.orig = orig;
    this.res = res;
    (this.chan as HTMLSelectElement).disabled = !!orig && isGrayPixels(orig) && (!res || isGrayPixels(res));
    this.setUV(this.u, this.v);
  }

  /** Position as a fraction of the image. */
  setUV(u: number, v: number): void {
    this.u = Math.max(0, Math.min(1, u));
    this.v = Math.max(0, Math.min(1, v));
    if (this.orig) {
      this.x = Math.min(this.orig.w - 1, Math.floor(this.u * this.orig.w));
      this.y = Math.min(this.orig.h - 1, Math.floor(this.v * this.orig.h));
    }
    this.schedule();
  }

  /** Move by whole pixels of the original (keyboard). */
  nudge(dx: number, dy: number): void {
    if (!this.orig) return;
    this.setUV((Math.max(0, Math.min(this.orig.w - 1, this.x + dx)) + 0.5) / this.orig.w, (Math.max(0, Math.min(this.orig.h - 1, this.y + dy)) + 0.5) / this.orig.h);
  }

  private schedule(): void {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.render());
  }

  private table(p: Pixels | null, cx: number, cy: number, ch: Channel): HTMLTableElement {
    const t = h('table', { class: 'px-grid', role: 'presentation' });
    for (let dy = -4; dy <= 4; dy++) {
      const tr = h('tr', {});
      for (let dx = -4; dx <= 4; dx++) {
        const v = p ? valueAt(p, cx + dx, cy + dy, ch) : null;
        const td = h('td', { class: dx === 0 && dy === 0 ? 'center' : '' }, v === null ? '' : String(v));
        if (v !== null) {
          td.style.background = `rgb(${v},${v},${v})`;
          td.style.color = v > 117 ? '#000' : '#fff';
        }
        tr.appendChild(td);
      }
      t.appendChild(tr);
    }
    return t;
  }

  private render(): void {
    clear(this.gridA);
    clear(this.gridB);
    if (!this.orig) {
      this.posEl.textContent = 'Hover or touch the image, or focus it and use the arrow keys.';
      return;
    }
    const ch = (this.chan as HTMLSelectElement).value as Channel;
    this.gridA.appendChild(this.table(this.orig, this.x, this.y, ch));
    let rx = this.x, ry = this.y;
    if (this.res) {
      rx = Math.min(this.res.w - 1, Math.floor(this.u * this.res.w));
      ry = Math.min(this.res.h - 1, Math.floor(this.v * this.res.h));
      this.gridB.appendChild(this.table(this.res, rx, ry, ch));
    } else this.gridB.appendChild(h('p', { class: 'hint' }, 'Run a concept to compare.'));
    const a = valueAt(this.orig, this.x, this.y, ch);
    const b = this.res ? valueAt(this.res, rx, ry, ch) : null;
    this.posEl.textContent = `Pixel (${this.x}, ${this.y}): original ${a}${b === null ? '' : `, result ${b}`}.`;
    this.onChange(a, this.x, this.y);
  }

  get pos(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /** Original-image neighbourhood values around the inspected pixel (gray), radius r, or null. */
  neighbourhood(r: number): number[][] | null {
    if (!this.orig) return null;
    const out: number[][] = [];
    for (let dy = -r; dy <= r; dy++) {
      const row: number[] = [];
      for (let dx = -r; dx <= r; dx++) row.push(valueAt(this.orig, this.x + dx, this.y + dy, 'gray') ?? 0);
      out.push(row);
    }
    return out;
  }
  resultValue(): number | null {
    if (!this.res) return null;
    return valueAt(this.res, Math.min(this.res.w - 1, Math.floor(this.u * this.res.w)), Math.min(this.res.h - 1, Math.floor(this.v * this.res.h)), 'gray');
  }
}
