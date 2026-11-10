import { otsu } from '../../core/imageCheckup';
import { histogramFromPixels } from '../../core/imageOps';
import type { Pixels } from '../../core/matIO';
import type { Params } from '../../core/types';
import { clear, h, prefersReducedMotion } from '../dom';
import { structuringElement } from './kernels';

const CELL = 10;
const PATCH = 21;

/** Draws the element as a grid and slides it over a zoomed binary patch, marking where it "fits" (erosion) or "hits" (dilation). */
export class StructuringElementView {
  readonly el = h('section', { class: 'explainer', 'aria-label': 'Structuring element explainer' });
  private timer = 0;

  update(params: Params, working: Pixels | null, cx: number, cy: number): void {
    window.clearInterval(this.timer);
    clear(this.el);
    if (!working) return;
    const shape = String(params.shape ?? 'ellipse');
    const kw = Math.max(1, Number(params.k) || 3) | 1;
    const khRaw = Number(params.kh) > 0 ? Number(params.kh) | 1 : kw;
    const dw = Math.min(kw, 7), dh = Math.min(khRaw, 7);
    const se = structuringElement(shape, dw, dh);
    const op = String(params.op ?? 'erode');
    const mode: 'fit' | 'hit' | 'both' = ['erode', 'open'].includes(op) ? 'fit' : ['dilate', 'close'].includes(op) ? 'hit' : 'both';
    this.el.appendChild(h('h4', {}, `Structuring element: ${shape} ${kw}×${khRaw}`));
    const cells = h('div', { class: 'se-cells', role: 'img', 'aria-label': `Structuring element, ${shape}, ${dw} by ${dh} cells` });
    cells.style.gridTemplateColumns = `repeat(${dw}, 14px)`;
    for (const row of se) for (const v of row) cells.appendChild(h('div', { class: `c${v ? ' on' : ''}` }));
    this.el.appendChild(cells);
    this.el.appendChild(h('p', { class: 'hint' }, `${kw > 7 || khRaw > 7 ? `Drawn with a ${dw}×${dh} element so it fits on screen. ` : ''}${mode === 'fit' ? 'Erosion marks a pixel only where the whole element fits inside the white region.' : mode === 'hit' ? 'Dilation marks a pixel wherever the element touches the white region.' : 'Gradient and top-hat combine dilation and erosion; shown here: where the element fits (teal).'}`));

    // Zoomed binary patch around the inspected pixel.
    const hist = histogramFromPixels(working, 'gray');
    const T = otsu(hist).t;
    const invert = params.invert === true;
    const half = (PATCH - 1) / 2;
    const px = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= working.w || y >= working.h) return false;
      const o = (y * working.w + x) * 4;
      const v = Math.round(0.299 * working.data[o] + 0.587 * working.data[o + 1] + 0.114 * working.data[o + 2]);
      const fg = Number(params.thr) > 0 ? v > Number(params.thr) : v > T;
      return invert ? !fg : fg;
    };
    const src: boolean[][] = Array.from({ length: PATCH }, (_, y) => Array.from({ length: PATCH }, (_, x) => px(cx - half + x, cy - half + y)));
    const out: (boolean | null)[][] = Array.from({ length: PATCH }, () => Array(PATCH).fill(null));
    const a = h('canvas', { width: PATCH * CELL, height: PATCH * CELL, role: 'img', 'aria-label': 'Zoomed binary patch with the element sliding over it' });
    const b = h('canvas', { width: PATCH * CELL, height: PATCH * CELL, role: 'img', 'aria-label': 'Result patch, filled in as the element slides' });
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim(), tealC = css.getPropertyValue('--teal').trim(), primary = css.getPropertyValue('--primary').trim(), surface = css.getPropertyValue('--surface').trim();
    const ox = Math.floor(dw / 2), oy = Math.floor(dh / 2);
    const test = (x: number, y: number): boolean => {
      let all = true, any = false;
      for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) {
        if (!se[j][i]) continue;
        const xx = x + i - ox, yy = y + j - oy;
        const v = xx >= 0 && yy >= 0 && xx < PATCH && yy < PATCH ? src[yy][xx] : false;
        all &&= v; any ||= v;
      }
      return mode === 'hit' ? any : all;
    };
    const draw = (pos: number) => {
      const ca = a.getContext('2d')!, cb = b.getContext('2d')!;
      ca.clearRect(0, 0, a.width, a.height); cb.clearRect(0, 0, b.width, b.height);
      for (let y = 0; y < PATCH; y++) for (let x = 0; x < PATCH; x++) {
        ca.fillStyle = src[y][x] ? '#fff' : '#1b1930'; ca.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        cb.fillStyle = out[y][x] === null ? surface : out[y][x] ? tealC : '#1b1930'; cb.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
      }
      if (pos >= 0 && pos < PATCH * PATCH) {
        const x = pos % PATCH, y = Math.floor(pos / PATCH);
        ca.strokeStyle = primary; ca.lineWidth = 2;
        for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) if (se[j][i]) ca.strokeRect((x + i - ox) * CELL + 1, (y + j - oy) * CELL + 1, CELL - 3, CELL - 3);
        cb.strokeStyle = ink; cb.lineWidth = 2; cb.strokeRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
      }
    };
    const fill = (pos: number) => { const x = pos % PATCH, y = Math.floor(pos / PATCH); out[y][x] = test(x, y); };
    const play = () => {
      window.clearInterval(this.timer);
      for (const r of out) r.fill(null);
      if (prefersReducedMotion()) {
        for (let p = 0; p < PATCH * PATCH; p++) fill(p);
        draw(-1);
        return;
      }
      let pos = 0;
      this.timer = window.setInterval(() => {
        if (pos >= PATCH * PATCH) { window.clearInterval(this.timer); draw(-1); return; }
        for (let k = 0; k < 3 && pos < PATCH * PATCH; k++) fill(pos++);
        draw(pos - 1);
      }, 40);
    };
    this.el.appendChild(h('div', { class: 'row' }, h('div', {}, h('p', { class: 'hint' }, 'Binary patch around the inspected pixel (white = object)'), a), h('div', {}, h('p', { class: 'hint' }, mode === 'hit' ? 'Teal = element hits an object' : 'Teal = element fits inside the object'), b)));
    this.el.appendChild(h('button', { type: 'button', class: 'btn small', onclick: play }, 'Replay'));
    draw(-1);
    play();
  }
  dispose(): void {
    window.clearInterval(this.timer);
  }
}
