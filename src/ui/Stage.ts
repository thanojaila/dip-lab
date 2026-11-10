import { diffPixels } from '../core/imageOps';
import type { Pixels } from '../core/matIO';
import { h, nextId } from './dom';

export interface StageHandlers {
  onPin(): void;
  onUseAsInput(): void;
  onExportPng(): void;
  onResetImage(): void;
}

function draw(canvas: HTMLCanvasElement, px: Pixels | null): void {
  if (!px) {
    canvas.width = 1;
    canvas.height = 1;
    canvas.getContext('2d')?.clearRect(0, 0, 1, 1);
    canvas.classList.add('empty');
    return;
  }
  canvas.classList.remove('empty');
  canvas.width = px.w;
  canvas.height = px.h;
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.w, px.h), 0, 0);
}

/** Original | Result | Diff (+ optional pinned compare pane). FR-05, FR-13. */
export class Stage {
  readonly el: HTMLElement;
  private input: Pixels | null = null;
  private result: Pixels | null = null;
  private pinned: Pixels | null = null;
  private cOrig = h('canvas', { role: 'img', 'aria-label': 'Original image' });
  private cRes = h('canvas', { role: 'img', 'aria-label': 'Result image' });
  private cDiff = h('canvas', { role: 'img', 'aria-label': 'Absolute difference image' });
  private cPin = h('canvas', { role: 'img', 'aria-label': 'Pinned result for comparison' });
  private capOrig = h('figcaption', {}, 'Original');
  private capRes = h('figcaption', {}, 'Result');
  private capDiff = h('figcaption', {}, 'Diff');
  private capPin = h('figcaption', {}, 'Pinned');
  private figDiff: HTMLElement;
  private figPin: HTMLElement;
  private diffOn = h('input', { type: 'checkbox', id: nextId('dshow'), checked: true });
  private diffVs = h('select', { id: nextId('dvs') });
  private diffAmp = h('input', { type: 'checkbox', id: nextId('damp') });
  readonly pinBtn: HTMLButtonElement;
  readonly useBtn: HTMLButtonElement;
  readonly pngBtn: HTMLButtonElement;

  constructor(hd: StageHandlers) {
    this.figDiff = h('figure', { class: 'pane' }, this.cDiff, this.capDiff);
    this.figPin = h('figure', { class: 'pane hidden' }, this.cPin, this.capPin);
    this.diffVs.appendChild(h('option', { value: 'input' }, 'Original'));
    this.diffVs.appendChild(h('option', { value: 'pinned' }, 'Pinned'));
    this.pinBtn = h('button', { type: 'button', class: 'btn secondary', onclick: hd.onPin }, 'Pin result to compare');
    this.useBtn = h('button', { type: 'button', class: 'btn secondary', onclick: hd.onUseAsInput }, 'Use result as input');
    this.pngBtn = h('button', { type: 'button', class: 'btn secondary', onclick: hd.onExportPng }, 'Export result PNG');
    for (const b of [this.pinBtn, this.useBtn, this.pngBtn]) b.disabled = true;
    const redo = () => this.refreshDiff();
    this.diffOn.addEventListener('change', redo);
    this.diffVs.addEventListener('change', redo);
    this.diffAmp.addEventListener('change', redo);
    this.el = h(
      'section',
      { class: 'panel stage', 'aria-labelledby': 'stage-h' },
      h('h2', { id: 'stage-h' }, 'Stage'),
      h('div', { class: 'panes' }, h('figure', { class: 'pane' }, this.cOrig, this.capOrig), h('figure', { class: 'pane' }, this.cRes, this.capRes), this.figDiff, this.figPin),
      h(
        'div',
        { class: 'stage-controls' },
        h('label', { class: 'inline', for: this.diffOn.id }, this.diffOn, ' Show Diff'),
        h('label', { for: this.diffVs.id }, 'against '),
        this.diffVs,
        h('label', { class: 'inline', for: this.diffAmp.id }, this.diffAmp, ' amplify ×4'),
      ),
      h('div', { class: 'stage-buttons' }, this.pinBtn, this.useBtn, this.pngBtn, h('button', { type: 'button', class: 'btn secondary', onclick: hd.onResetImage }, 'Reset to original image')),
    );
    this.render();
  }

  setInput(px: Pixels | null, caption: string): void {
    this.input = px;
    this.result = null;
    this.capOrig.textContent = caption;
    this.capRes.textContent = 'Result: run a technique';
    this.cOrig.setAttribute('aria-label', `Original image, ${caption}`);
    this.render();
  }

  setResult(px: Pixels | null, caption: string): void {
    this.result = px;
    this.capRes.textContent = caption;
    this.cRes.setAttribute('aria-label', `Result image, ${caption}`);
    for (const b of [this.pinBtn, this.useBtn, this.pngBtn]) b.disabled = !px;
    this.render();
  }

  setPinned(px: Pixels | null, caption: string): void {
    this.pinned = px;
    this.capPin.textContent = `Pinned: ${caption}`;
    this.figPin.classList.toggle('hidden', !px);
    if (!px && (this.diffVs as HTMLSelectElement).value === 'pinned') (this.diffVs as HTMLSelectElement).value = 'input';
    this.render();
  }

  getResult(): Pixels | null {
    return this.result;
  }

  getPinnedExists(): boolean {
    return !!this.pinned;
  }

  private render(): void {
    draw(this.cOrig, this.input);
    draw(this.cRes, this.result);
    if (this.pinned) draw(this.cPin, this.pinned);
    this.refreshDiff();
  }

  private refreshDiff(): void {
    const on = (this.diffOn as HTMLInputElement).checked;
    this.figDiff.classList.toggle('hidden', !on);
    if (!on) return;
    const vs = (this.diffVs as HTMLSelectElement).value;
    const base = vs === 'pinned' ? this.pinned : this.input;
    if (!this.result || !base) {
      draw(this.cDiff, null);
      this.capDiff.textContent = 'Diff: appears after a Run';
      return;
    }
    draw(this.cDiff, diffPixels(this.result, base, (this.diffAmp as HTMLInputElement).checked ? 4 : 1));
    const sized = this.result.w !== base.w || this.result.h !== base.h ? ' (original resampled by nearest-neighbour to match)' : '';
    this.capDiff.textContent = `Diff: |Result − ${vs === 'pinned' ? 'Pinned' : 'Original'}|${sized}`;
    this.cDiff.setAttribute('aria-label', this.capDiff.textContent);
  }
}
