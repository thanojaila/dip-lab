import type { SelfCheckSpec } from '../core/types';
import { h, nextId } from './dom';

export interface SelfCheckHooks {
  /** Runs the preset (or the hero demo); resolves true on success. Omitted for explainer-only concepts. */
  runPreset?: () => Promise<boolean>;
  onRevealed(): void;
}

/** Predict → run → reveal. Correctness is announced in words, never by color alone. */
export class SelfCheck {
  readonly el: HTMLElement;
  private chosen = -1;
  private ran: boolean;
  private runBtn: HTMLButtonElement | null = null;
  private revealBtn: HTMLButtonElement;
  private answer = h('div', { class: 'answer', 'aria-live': 'polite' });
  revealed = false;

  constructor(private spec: SelfCheckSpec, private hooks: SelfCheckHooks) {
    this.ran = !hooks.runPreset;
    const name = nextId('sc');
    const radios = spec.options.map((opt, i) => {
      const id = `${name}-${i}`;
      const input = h('input', { type: 'radio', name, id, value: String(i) });
      input.addEventListener('change', () => {
        this.chosen = i;
        this.update();
      });
      return h('label', { class: 'choice', for: id }, input, h('span', {}, opt));
    });
    if (hooks.runPreset) this.runBtn = h('button', { type: 'button', class: 'btn small', onclick: () => void this.run() }, 'Show me');
    this.revealBtn = h('button', { type: 'button', class: 'btn small', onclick: () => this.reveal() }, 'Reveal answer');
    this.el = h(
      'div',
      { class: 'selfcheck' },
      h('h4', {}, 'Predict first'),
      h('fieldset', {}, h('legend', {}, spec.prompt), ...radios),
      h('div', { class: 'row' }, this.runBtn, this.revealBtn),
      h('p', { class: 'hint' }, hooks.runPreset ? 'Pick an answer, press "Show me" to run the demo, then reveal.' : 'Pick an answer, then reveal.'),
      this.answer,
    );
    this.update();
  }

  private update(): void {
    if (this.runBtn) this.runBtn.disabled = this.chosen < 0;
    this.revealBtn.disabled = !this.ran || this.chosen < 0;
  }

  private async run(): Promise<void> {
    if (!this.hooks.runPreset || !this.runBtn) return;
    this.runBtn.disabled = true;
    const ok = await this.hooks.runPreset();
    if (ok) this.ran = true;
    this.update();
  }

  private reveal(): void {
    const right = this.chosen === this.spec.correct;
    this.answer.textContent = '';
    this.answer.appendChild(h('p', { class: 'verdict' }, right ? '✓ Correct: your prediction matched.' : `✗ Not quite. The answer: ${this.spec.options[this.spec.correct]}.`));
    this.answer.appendChild(h('p', {}, this.spec.explanation));
    this.answer.appendChild(h('p', { class: 'hint' }, 'The numbers behind this are in the Exact transform panel.'));
    if (!this.revealed) {
      this.revealed = true;
      this.hooks.onRevealed();
    }
  }
}
