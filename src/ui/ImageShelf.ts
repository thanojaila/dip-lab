import type { Suggestion } from '../core/imageCheckup';
import { SAMPLE_REFS, bestFor, type SampleRef } from '../core/sampleRegistry';
import { TEST_PATTERNS, patternById } from '../core/testPatterns';
import type { TechniqueSpec } from '../core/types';
import { clear, h } from './dom';
import { drawPixels } from './stage/draw';

export interface ShelfHooks {
  onPick(id: string): void;
  onFile(f: File): void;
  onSuggestion(conceptId: string): void;
}

/** Thumbnails: best for this concept, all photos, test patterns, and a big upload tile. */
export class ImageShelf {
  readonly el: HTMLElement;
  private groups = h('div', { class: 'shelf-groups' });
  private checkup = h('div', {});
  private active: string | null = null;
  private spec: TechniqueSpec | null = null;
  private mine = false;

  constructor(private hooks: ShelfHooks) {
    this.el = h('section', { class: 'panel shelf', 'aria-label': 'Image shelf' }, h('h2', {}, 'Images'), this.groups, this.checkup);
    this.render();
  }

  setActive(id: string | null, mine: boolean): void {
    this.active = id;
    this.mine = mine;
    this.render();
  }
  setConcept(spec: TechniqueSpec | null): void {
    this.spec = spec;
    this.render();
  }

  setCheckup(items: Suggestion[] | null): void {
    clear(this.checkup);
    if (!items) return;
    const box = h('div', { class: 'checkup', role: 'note' }, h('h4', {}, 'Image check-up (suggestions, not diagnoses)'));
    if (!items.length) box.appendChild(h('p', { class: 'hint' }, 'Nothing stands out. Try anything.'));
    const ul = h('ul', {});
    for (const s of items) {
      ul.appendChild(h('li', {}, s.text + ' ', ...s.concepts.flatMap((c, i) => [i ? ' · ' : '', h('button', { type: 'button', class: 'link', onclick: () => this.hooks.onSuggestion(c) }, `Open ${c}`)])));
    }
    box.appendChild(ul);
    this.checkup.appendChild(box);
  }

  private thumb(r: SampleRef): HTMLElement {
    let visual: HTMLElement;
    if (r.thumb) visual = h('img', { src: r.thumb, alt: '', loading: 'lazy', width: 92, height: 64 });
    else {
      const c = h('canvas', {});
      const p = patternById(r.id);
      if (p) drawPixels(c, p.make());
      visual = c;
    }
    return h(
      'button',
      { type: 'button', class: 'thumb', 'aria-pressed': String(!this.mine && this.active === r.id), 'aria-label': `${r.title}. ${r.teaches}`, onclick: () => this.hooks.onPick(r.id) },
      visual,
      h('span', {}, r.title),
      h('span', { class: 'tip', role: 'tooltip' }, r.teaches),
    );
  }

  private row(refs: SampleRef[]): HTMLElement {
    return h('div', { class: 'shelf-row' }, ...refs.map((r) => this.thumb(r)));
  }

  private render(): void {
    clear(this.groups);
    const fileInput = h('input', { type: 'file', id: 'shelf-file', accept: 'image/png,image/jpeg,image/webp', class: 'sr-only', 'aria-label': 'Upload your own image' });
    fileInput.addEventListener('change', () => {
      const f = (fileInput as HTMLInputElement).files?.[0];
      if (f) this.hooks.onFile(f);
      (fileInput as HTMLInputElement).value = '';
    });
    const upload = h('button', { type: 'button', class: 'thumb upload', 'aria-pressed': String(this.mine), onclick: () => (fileInput as HTMLInputElement).click() }, h('strong', { 'aria-hidden': 'true' }, '+'), h('span', {}, 'Upload your own'), h('span', { class: 'tip', role: 'tooltip' }, 'PNG, JPEG or WebP up to 8 MB. It stays on your computer.'));
    this.groups.appendChild(h('div', {}, h('div', { class: 'shelf-row' }, upload, fileInput)));
    const photos = SAMPLE_REFS.filter((r) => r.group === 'photo');
    if (this.spec) {
      const best = [this.spec.heroImage, ...(this.spec.alsoGoodOn ?? [])].map((id) => SAMPLE_REFS.find((r) => r.id === id) ?? (patternById(id) ? ({ id, title: patternById(id)!.title, teaches: patternById(id)!.teaches, group: 'pattern', width: 256, height: 256, mode: 'gray', techniques: [] } as SampleRef) : null)).filter((r): r is SampleRef => !!r);
      const extra = bestFor(this.spec.id).filter((r) => !best.some((b) => b.id === r.id));
      this.groups.appendChild(h('div', {}, h('h3', {}, `Best for ${this.spec.id}`), this.row([...best, ...extra])));
    }
    this.groups.appendChild(h('div', {}, h('h3', {}, 'All photos'), this.row(photos)));
    this.groups.appendChild(h('div', {}, h('h3', {}, 'Test patterns'), this.row(SAMPLE_REFS.filter((r) => r.group === 'pattern'))));
    void TEST_PATTERNS;
  }
}
