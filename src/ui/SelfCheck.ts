import type { SelfCheckSpec } from '../core/types';
import { h, nextId } from './dom';

export interface SelfCheckHooks {
  /** Applies the preset and runs; resolves true on success. */
  runPreset(): Promise<boolean>;
  onRevealed(): void;
}

/** Predict → run → reveal (FR-11). Correctness is announced in words, never by color alone. */
export class SelfCheck {
  readonly el: HTMLElement;
  private chosen = -1;
  private ran = false;
  private runBtn: HTMLButtonElement;
  private revealBtn: HTMLButtonElement;
  private answer = h('div', { class: 'answer', 'aria-live': 'polite' });
  revealed = false;

  constructor(private spec: SelfCheckSpec, private hooks: SelfCheckHooks) {
    const name = nextId('sc');
    const promptId = nextId('scp');
    const radios = spec.options.map((opt, i) => {
      const id = `${name}-${i}`;
      const input = h('input', { type: 'radio', name, id, value: String(i) });
      input.addEventListener('change', () => {
        this.chosen = i;
        this.update();
      });
      return h('label', { class: 'choice', for: id }, input, ' ', opt);
    });
    this.runBtn = h('button', { type: 'button', class: 'btn secondary', onclick: () => void this.run() }, 'Run the preset');
    this.revealBtn = h('button', { type: 'button', class: 'btn secondary', onclick: () => this.reveal() }, 'Reveal answer');
    this.el = h(
      'div',
      { class: 'selfcheck' },
      h('h4', {}, 'Predict, then check'),
      h('fieldset', {}, h('legend', { id: promptId }, spec.prompt), ...radios),
      h('div', { class: 'row' }, this.runBtn, this.revealBtn),
      h('p', { class: 'hint', id: nextId('schint') }, 'Pick an answer first. Then run the preset and compare Original, Result and Diff with your prediction.'),
      this.answer,
    );
    this.update();
  }

  private update(): void {
    this.runBtn.disabled = this.chosen < 0;
    this.revealBtn.disabled = !this.ran || this.chosen < 0;
  }

  private async run(): Promise<void> {
    this.runBtn.disabled = true;
    const ok = await this.hooks.runPreset();
    if (ok) this.ran = true;
    this.update();
  }

  private reveal(): void {
    const right = this.chosen === this.spec.correct;
    this.answer.textContent = '';
    this.answer.appendChild(h('p', { class: 'verdict' }, right ? 'Correct: your prediction matched.' : `Not quite. The answer is: ${this.spec.options[this.spec.correct]}.`));
    this.answer.appendChild(h('p', {}, this.spec.explanation));
    this.answer.appendChild(h('p', { class: 'hint' }, 'The numbers behind this are in the Exact transform panel.'));
    if (!this.revealed) {
      this.revealed = true;
      this.hooks.onRevealed();
    }
  }
}
