import { clear, h } from './dom';

/** Live "Exact transform" panel (FR-08, NFR-07): aria-live so screen readers hear every Run. */
export class ExactPanel {
  readonly el: HTMLElement;
  private text = h('p', { class: 'exact-text', id: 'exact-text', 'aria-live': 'polite', 'aria-atomic': 'true' }, 'Run a technique to see exactly what was computed, with your numbers filled in.');
  private warn = h('ul', { class: 'warnings', 'aria-live': 'polite' });
  private status = h('p', { class: 'status', role: 'status' });

  constructor() {
    this.el = h('section', { class: 'panel exact', 'aria-labelledby': 'exact-h' }, h('h2', { id: 'exact-h' }, 'Exact transform'), this.text, this.warn, this.status);
  }

  set(title: string, exact: string, warnings: string[] = [], ms?: number): void {
    this.text.textContent = `${title} — ${exact}`;
    clear(this.warn);
    for (const w of warnings) this.warn.appendChild(h('li', {}, 'Note: ' + w));
    this.status.textContent = ms === undefined ? '' : `Computed in ${ms} ms, locally.`;
  }

  error(message: string): void {
    this.text.textContent = `Could not run: ${message}`;
    clear(this.warn);
    this.status.textContent = '';
  }

  setStatus(s: string): void {
    this.status.textContent = s;
  }
}
