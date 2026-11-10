import { clear, h } from '../dom';

export interface PipelineStep { label: string }

/** "image → step → step" chips with an undo on each step. */
export class PipelineStrip {
  readonly el = h('div', { class: 'chips', 'aria-label': 'Pipeline', role: 'group' });
  constructor(private onUndo: (index: number) => void) {}

  set(base: string, steps: PipelineStep[]): void {
    clear(this.el);
    this.el.appendChild(h('span', { class: 'chip' }, base));
    steps.forEach((s, i) => {
      this.el.appendChild(h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'));
      this.el.appendChild(
        h('span', { class: 'chip' }, s.label, h('button', { type: 'button', 'aria-label': `Undo ${s.label} and everything after it`, title: 'Undo this step', onclick: () => this.onUndo(i) }, '✕')),
      );
    });
  }
}
