import type { Params } from '../../core/types';
import { clear, h } from '../dom';
import { kernelFor } from './kernels';

const MAX = 9;
const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : Math.abs(v) < 0.001 ? v.toExponential(0) : v.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));

/** The actual kernel weights, plus "neighbourhood × weights = output" for the pixel under the inspector. */
export class KernelGrid {
  readonly el = h('section', { class: 'explainer', 'aria-label': 'Kernel explainer' });

  update(id: string, params: Params, neighbourhood: (r: number) => number[][] | null, resultValue: number | null): void {
    clear(this.el);
    const info = kernelFor(id, params);
    if (!info) return;
    this.el.appendChild(h('h4', {}, `Kernel: ${info.title}`));
    const nb = neighbourhood(4);
    const sums: string[] = [];
    for (const g of info.grids) {
      const n = g.w.length, m = g.w[0].length;
      const sw = Math.min(n, MAX), sh = Math.min(m, MAX);
      const oy = Math.floor((n - sw) / 2), ox = Math.floor((m - sh) / 2);
      const grid = h('div', { class: 'kgrid', role: 'table', 'aria-label': `${g.label}, ${n} by ${m}` });
      grid.style.gridTemplateColumns = `repeat(${sh}, auto)`;
      for (let y = 0; y < sw; y++)
        for (let x = 0; x < sh; x++) grid.appendChild(h('div', { class: `c${y === Math.floor(sw / 2) && x === Math.floor(sh / 2) ? ' center' : ''}`, role: 'cell' }, fmt(g.w[y + oy][x + ox])));
      this.el.appendChild(h('div', { style: undefined, class: 'kwrap' }, h('p', { class: 'hint' }, g.label + (n > MAX || m > MAX ? ` (centre ${sw}×${sh} of ${n}×${m} shown)` : '')), grid));
      if (nb) {
        // Weighted sum of the original neighbourhood, centred on the inspected pixel.
        let sum = 0;
        for (let y = 0; y < n; y++) for (let x = 0; x < m; x++) {
          const dy = y - Math.floor((n - 1) / 2), dx = x - Math.floor((m - 1) / 2);
          if (Math.abs(dy) <= 4 && Math.abs(dx) <= 4) sum += g.w[y][x] * nb[dy + 4][dx + 4];
        }
        sums.push(info.grids.length === 1 ? fmt(Math.round(sum * 100) / 100) : `${g.label.split(' ')[0]} ${fmt(Math.round(sum * 100) / 100)}`);
      }
    }
    this.el.appendChild(h('p', { class: 'hint' }, info.note));
    if (sums.length) this.el.appendChild(h('p', { class: 'mono', 'aria-live': 'polite' }, `At the inspected pixel, Σ weight × pixel = ${sums.join(' · ')}${resultValue !== null && info.grids.length === 1 ? ` (result pixel: ${resultValue})` : ''}`));
  }
}
