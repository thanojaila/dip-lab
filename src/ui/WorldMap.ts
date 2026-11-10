import type { Progress } from '../core/progress';
import type { SegmentSpec, TechniqueSpec } from '../core/types';
import { clear, h } from './dom';

/** World map as a dialog: one node per world with stamps earned out of total. */
export class WorldMap {
  readonly dialog = h('dialog', { 'aria-labelledby': 'map-title' });
  private grid = h('div', { class: 'map-grid' });

  constructor(private worlds: SegmentSpec[], private techniques: TechniqueSpec[], private progress: Progress, private onGo: (worldId: string) => void, private onReset: () => void) {
    this.dialog.appendChild(h('h2', { id: 'map-title' }, 'World map'));
    this.dialog.appendChild(h('p', { class: 'hint' }, 'A stamp is earned for each concept when you run its demo and commit to a prediction. Wrong guesses still earn it: the point is to predict first. Progress is saved only in this browser.'));
    this.dialog.appendChild(this.grid);
    this.dialog.appendChild(
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: () => this.dialog.close() }, 'Close'),
        h('button', { type: 'button', class: 'btn', onclick: () => { if (confirm('Reset all stamps and challenge results stored in this browser?')) { this.onReset(); this.render(); } } }, 'Reset my progress')),
    );
    this.dialog.addEventListener('click', (e) => { if (e.target === this.dialog) this.dialog.close(); });
  }

  render(): void {
    clear(this.grid);
    for (const w of this.worlds) {
      const ts = this.techniques.filter((t) => t.segment === w.id);
      const n = this.progress.count(ts.map((t) => t.id));
      const node = h(
        'button',
        { type: 'button', class: `node accent-${w.accent}${n === ts.length ? ' done' : ''}`, onclick: () => { this.dialog.close(); this.onGo(w.id); } },
        h('strong', {}, `${w.index}. ${w.title}`),
        h('span', { class: 'count' }, `${n} / ${ts.length} stamps`, n === ts.length ? ' ✓ complete' : ''),
        h('span', { class: 'dots', 'aria-hidden': 'true' }, ...ts.map((t) => h('span', { class: `dot${this.progress.hasStamp(t.id) ? ' on' : ''}` }))),
      );
      this.grid.appendChild(node);
    }
  }

  open(): void {
    this.render();
    if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
    else this.dialog.setAttribute('open', '');
  }
}
