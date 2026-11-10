import type { SegmentSpec } from '../core/types';
import { clear, h, prefersReducedMotion } from './dom';

export interface TocHandlers {
  onNext(): void;
  onGuidedChange(guided: boolean): void;
}

/** Sticky guided table of contents (FR-01, FR-02). */
export class Toc {
  readonly el: HTMLElement;
  private list = h('ol', { class: 'toc-list' });
  private guided = h('input', { type: 'checkbox', id: 'guided-toggle', checked: true });
  private links = new Map<string, HTMLAnchorElement>();

  constructor(private segments: SegmentSpec[], hd: TocHandlers) {
    this.guided.addEventListener('change', () => hd.onGuidedChange((this.guided as HTMLInputElement).checked));
    this.el = h(
      'nav',
      { class: 'toc', 'aria-label': 'Lab segments' },
      this.list,
      h(
        'div',
        { class: 'toc-tools' },
        h('label', { class: 'inline', for: 'guided-toggle' }, this.guided, ' Guided path'),
        h('button', { type: 'button', class: 'btn secondary small', onclick: hd.onNext }, 'Next concept →'),
      ),
    );
    this.render(new Set(), null);
  }

  render(done: Set<string>, current: string | null): void {
    clear(this.list);
    this.links.clear();
    for (const s of this.segments) {
      const a = h(
        'a',
        {
          href: `#seg-${s.id}`,
          'aria-current': current === s.id ? 'true' : undefined,
          onclick: (e: Event) => {
            e.preventDefault();
            document.getElementById(`seg-${s.id}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
          },
        },
        h('span', { class: 'mark', 'aria-hidden': 'true' }, done.has(s.id) ? '✓' : String(s.index)),
        ' ',
        s.title,
        done.has(s.id) ? h('span', { class: 'sr-only' }, ' (completed)') : null,
      );
      if (done.has(s.id)) a.classList.add('done');
      this.links.set(s.id, a);
      this.list.appendChild(h('li', {}, a));
    }
  }

  isGuided(): boolean {
    return (this.guided as HTMLInputElement).checked;
  }
}
