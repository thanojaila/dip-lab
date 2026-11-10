import type { Pixels } from '../../core/matIO';
import { h } from '../dom';
import { drawPixels } from './draw';

/** Draggable before/after divider. Keyboard: arrows ±2%, Home/End jump. role="slider". */
export class BeforeAfter {
  readonly el: HTMLElement;
  readonly before = h('canvas', { 'aria-hidden': 'true' });
  readonly after = h('canvas', { class: 'after', 'aria-hidden': 'true' });
  private handle: HTMLElement;
  private pct = 50;
  private tagL = h('span', { class: 'tag l' }, 'Original');
  private tagR = h('span', { class: 'tag r' }, 'Result');

  constructor() {
    this.handle = h('div', { class: 'handle', role: 'slider', tabindex: 0, 'aria-label': 'Before and after divider', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-orientation': 'horizontal' }, h('span', { 'aria-hidden': 'true' }, '↔'));
    this.el = h('div', { class: 'ba' }, this.before, this.after, this.tagL, this.tagR, this.handle);
    const move = (e: PointerEvent) => {
      const r = this.el.getBoundingClientRect();
      this.set(((e.clientX - r.left) / r.width) * 100);
    };
    this.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.el.setPointerCapture(e.pointerId);
      move(e);
      const up = () => {
        this.el.removeEventListener('pointermove', move);
        this.el.removeEventListener('pointerup', up);
      };
      this.el.addEventListener('pointermove', move);
      this.el.addEventListener('pointerup', up);
    });
    this.handle.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowDown') this.set(this.pct - 2);
      else if (k === 'ArrowRight' || k === 'ArrowUp') this.set(this.pct + 2);
      else if (k === 'Home') this.set(0);
      else if (k === 'End') this.set(100);
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
    this.set(50);
  }

  set(p: number): void {
    this.pct = Math.max(0, Math.min(100, p));
    this.after.style.clipPath = `inset(0 0 0 ${this.pct}%)`;
    this.handle.style.left = `${this.pct}%`;
    this.handle.setAttribute('aria-valuenow', String(Math.round(this.pct)));
    this.handle.setAttribute('aria-valuetext', `Divider at ${Math.round(this.pct)} percent: Original on the left, Result on the right`);
  }

  setImages(original: Pixels | null, result: Pixels | null, labelBefore = 'Original', labelAfter = 'Result'): void {
    drawPixels(this.before, original);
    drawPixels(this.after, result ?? original);
    this.tagL.textContent = labelBefore;
    this.tagR.textContent = result ? labelAfter : labelBefore;
    if (original) this.el.style.aspectRatio = `${original.w} / ${original.h}`;
  }
}
