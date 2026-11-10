import type { PlainPixels } from '../../core/types';
import { clear, h } from '../dom';
import { drawPixels } from '../stage/draw';

/** Thumbnails of intermediate images (Canny steps, Otsu vs adaptive, aliasing pair, ...). */
export class StepStrip {
  readonly el = h('section', { class: 'panel', 'aria-label': 'Steps' });
  private row = h('div', { class: 'steps' });
  constructor() {
    this.el.appendChild(h('h2', {}, 'Steps'));
    this.el.appendChild(this.row);
    this.el.classList.add('hidden');
  }
  set(items: { label: string; pixels: PlainPixels }[] | undefined): void {
    clear(this.row);
    this.el.classList.toggle('hidden', !items?.length);
    for (const it of items ?? []) {
      const c = h('canvas', { role: 'img', 'aria-label': it.label });
      drawPixels(c, it.pixels);
      this.row.appendChild(h('figure', {}, c, h('figcaption', {}, it.label)));
    }
  }
}
