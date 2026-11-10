import { diffPixels } from '../../core/imageOps';
import type { Pixels } from '../../core/matIO';
import type { OverlayShape } from '../../core/types';
import { clear, h, nextId, s } from '../dom';
import { BeforeAfter } from './BeforeAfter';
import { drawPixels, uvInContain } from './draw';
import { PipelineStrip, type PipelineStep } from './PipelineStrip';
import { PixelInspector } from './PixelInspector';

export type View = 'slider' | 'side' | 'diff' | 'overlay';

export interface StageHooks {
  onPin(): void;
  onUseAsInput(): void;
  onExportPng(): void;
  onResetImage(): void;
  onFile(f: File): void;
  onUndo(i: number): void;
  onCancel(): void;
  onRect(r: { x: number; y: number; w: number; h: number }): void;
  onCorners(c: [number, number][]): void;
}

const TABS: { id: View; label: string }[] = [
  { id: 'slider', label: 'Slider' },
  { id: 'side', label: 'Side by side' },
  { id: 'diff', label: 'Diff' },
  { id: 'overlay', label: 'Overlay' },
];

/** The big image area: slider / side by side / diff / overlay, pixel inspector, pipeline chips, drag-and-drop. */
export class Stage {
  readonly el: HTMLElement;
  readonly inspector = new PixelInspector();
  private view: View = 'slider';
  private orig: Pixels | null = null;
  private res: Pixels | null = null;
  private pin: Pixels | null = null;
  private origCap = '';
  private resCap = '';
  private pinCap = '';
  private overlay: OverlayShape[] | null = null;
  private overlaySummary = '';
  private gain = 1;
  private diffVs: 'input' | 'pinned' = 'input';
  private pickRect = false;
  private rect: { x: number; y: number; w: number; h: number } | null = null;
  private corners: [number, number][] | null = null;
  private ba = new BeforeAfter();
  private body = h('div', { class: 'stage-view', tabindex: 0, 'aria-label': 'Image stage. Move over it, or use the arrow keys, to inspect pixels.' });
  private tabs = new Map<View, HTMLButtonElement>();
  private pipeline: PipelineStrip;
  private busyEl = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  private cancelBtn: HTMLButtonElement;
  private live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  readonly pinBtn: HTMLButtonElement;
  readonly useBtn: HTMLButtonElement;
  readonly pngBtn: HTMLButtonElement;

  constructor(private hooks: StageHooks) {
    this.pipeline = new PipelineStrip((i) => hooks.onUndo(i));
    const tablist = h('div', { class: 'stage-tabs', role: 'tablist', 'aria-label': 'Stage view' });
    for (const t of TABS) {
      const b = h('button', { type: 'button', role: 'tab', id: nextId('tab'), 'aria-selected': String(t.id === this.view), onclick: () => this.setView(t.id) }, t.label);
      this.tabs.set(t.id, b);
      tablist.appendChild(b);
    }
    this.cancelBtn = h('button', { type: 'button', class: 'btn small hidden', onclick: hooks.onCancel }, 'Cancel');
    const bar = h('div', { class: 'stage-bar' }, tablist);
    const fileIn = h('input', { type: 'file', id: 'stage-file', accept: 'image/png,image/jpeg,image/webp', class: 'sr-only', 'aria-label': 'Upload your own image' });
    fileIn.addEventListener('change', () => {
      const f = (fileIn as HTMLInputElement).files?.[0];
      (fileIn as HTMLInputElement).value = '';
      if (f) hooks.onFile(f);
    });
    bar.appendChild(h('span', { class: 'spacer' }));
    bar.appendChild(this.busyEl);
    bar.appendChild(fileIn);
    bar.appendChild(h('button', { type: 'button', class: 'btn small upload-btn', onclick: () => (fileIn as HTMLInputElement).click() }, '+ Upload your image'));
    bar.appendChild(this.cancelBtn);
    this.pinBtn = h('button', { type: 'button', class: 'btn small', onclick: hooks.onPin }, 'Pin result');
    this.useBtn = h('button', { type: 'button', class: 'btn small', onclick: hooks.onUseAsInput }, 'Use result as input');
    this.pngBtn = h('button', { type: 'button', class: 'btn small', onclick: hooks.onExportPng }, 'Export PNG');
    for (const b of [this.pinBtn, this.useBtn, this.pngBtn]) b.disabled = true;
    this.el = h(
      'section',
      { class: 'panel stage', 'aria-label': 'Stage' },
      bar,
      this.body,
      this.pipeline.el,
      h('div', { class: 'stage-actions' }, this.pinBtn, this.useBtn, this.pngBtn, h('button', { type: 'button', class: 'btn small', onclick: hooks.onResetImage }, 'Reset image')),
      this.live,
      h('div', { class: 'drop-hint', 'aria-hidden': 'true' }, 'Drop an image to use it'),
    );
    this.body.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 8 : 1;
      const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const m = d[e.key];
      if (m && e.target === this.body) {
        e.preventDefault();
        this.inspector.nudge(m[0], m[1]);
      }
    });
    this.body.addEventListener('pointermove', (e) => {
      if (!this.orig) return;
      const t = (e.target as HTMLElement).closest('canvas, .ba') as HTMLElement | null;
      if (!t) return;
      const uv = uvInContain(e, t, t instanceof HTMLCanvasElement && !t.parentElement?.classList.contains('ba') ? t.width : this.orig.w, t instanceof HTMLCanvasElement && !t.parentElement?.classList.contains('ba') ? t.height : this.orig.h);
      if (uv) this.inspector.setUV(uv.u, uv.v);
    });
    // Drag and drop anywhere on the stage.
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        this.el.classList.add('dragging');
      }
    };
    this.el.addEventListener('dragenter', over);
    this.el.addEventListener('dragover', over);
    this.el.addEventListener('dragleave', (e) => {
      if (e.target === this.el) this.el.classList.remove('dragging');
    });
    this.el.addEventListener('drop', (e) => {
      e.preventDefault();
      this.el.classList.remove('dragging');
      const f = e.dataTransfer?.files?.[0];
      if (f) hooks.onFile(f);
    });
    this.render();
  }

  // ---------- data ----------
  setOriginal(px: Pixels | null, caption: string): void {
    if (this.view === 'overlay' && !this.pickRect && !this.corners) {
      this.view = 'slider';
      for (const [id, b] of this.tabs) b.setAttribute('aria-selected', String(id === 'slider'));
    }
    this.orig = px;
    this.origCap = caption;
    this.res = null;
    this.overlay = null;
    this.overlaySummary = '';
    this.pin = null;
    for (const b of [this.pinBtn, this.useBtn, this.pngBtn]) b.disabled = true;
    this.inspector.setImages(px, null);
    this.render();
  }

  setResult(px: Pixels | null, caption: string, overlay?: OverlayShape[], summary = ''): void {
    this.res = px;
    this.resCap = caption;
    this.overlay = overlay ?? null;
    this.overlaySummary = summary;
    for (const b of [this.pinBtn, this.useBtn, this.pngBtn]) b.disabled = !px;
    this.inspector.setImages(this.orig, px);
    if (overlay && this.view !== 'overlay') this.setView('overlay');
    else if (!overlay && px && this.view === 'overlay' && !this.pickRect && !this.corners) this.setView('slider');
    else this.render();
    if (summary) this.live.textContent = summary;
  }

  setPinned(px: Pixels | null, caption: string): void {
    this.pin = px;
    this.pinCap = caption;
    if (!px) this.diffVs = 'input';
    this.render();
  }
  getResult(): Pixels | null { return this.res; }
  hasPinned(): boolean { return !!this.pin; }

  setPipeline(base: string, steps: PipelineStep[]): void {
    this.pipeline.set(base, steps);
  }

  setBusy(on: boolean, text = '', cancellable = false): void {
    this.busyEl.textContent = on ? text : '';
    this.cancelBtn.classList.toggle('hidden', !(on && cancellable));
  }

  setView(v: View): void {
    this.view = v;
    for (const [id, b] of this.tabs) b.setAttribute('aria-selected', String(id === v));
    this.render();
  }
  getView(): View { return this.view; }

  /** Template rectangle picker (FT01). `rect` is the current template to display. */
  setPickRect(on: boolean, rect?: { x: number; y: number; w: number; h: number } | null): void {
    this.pickRect = on;
    if (rect !== undefined) this.rect = rect;
    if (on) this.setView('overlay');
    else this.render();
  }
  /** Four draggable corners (G03). */
  setCorners(c: [number, number][] | null): void {
    this.corners = c;
    if (c) this.setView('overlay');
    else this.render();
  }

  // ---------- rendering ----------
  private render(): void {
    clear(this.body);
    if (!this.orig) {
      this.body.appendChild(h('p', { class: 'empty-stage' }, 'Pick an image from the shelf, or drop one here.'));
      return;
    }
    const o = this.orig;
    switch (this.view) {
      case 'slider': {
        this.ba.setImages(o, this.res);
        this.body.appendChild(this.ba.el);
        this.body.appendChild(h('p', { class: 'cap' }, `${this.origCap}${this.res ? ` · ${this.resCap}` : ''}`));
        break;
      }
      case 'side': {
        const mk = (px: Pixels | null, cap: string, label: string) => {
          const c = h('canvas', { role: 'img', 'aria-label': `${label}: ${cap}` });
          drawPixels(c, px);
          return h('figure', {}, c, h('figcaption', { class: 'cap' }, `${label}: ${cap}`));
        };
        this.body.appendChild(h('div', { class: 'sbs' }, mk(o, this.origCap, 'Original'), mk(this.res ?? o, this.res ? this.resCap : 'run a concept', 'Result'), this.pin ? mk(this.pin, this.pinCap, 'Pinned') : null));
        break;
      }
      case 'diff': {
        const base = this.diffVs === 'pinned' && this.pin ? this.pin : o;
        const ref = this.res;
        const c = h('canvas', { role: 'img', 'aria-label': 'Absolute difference image' });
        const gainBtns = [1, 4, 8].map((g) => h('button', { type: 'button', class: 'btn small', 'aria-pressed': String(this.gain === g), onclick: () => { this.gain = g; this.render(); } }, `×${g}`));
        const vs = h('select', { 'aria-label': 'Compare against', onchange: (e: Event) => { this.diffVs = (e.target as HTMLSelectElement).value as 'input' | 'pinned'; this.render(); } },
          h('option', { value: 'input', selected: this.diffVs === 'input' }, 'Original'),
          h('option', { value: 'pinned', selected: this.diffVs === 'pinned', disabled: !this.pin }, 'Pinned'));
        if (ref) drawPixels(c, diffPixels(ref, base, this.gain));
        const text = ref ? `Difference |Result − ${this.diffVs === 'pinned' && this.pin ? 'Pinned' : 'Original'}| shown ×${this.gain} (each difference is multiplied by ${this.gain} so faint changes are visible).` : 'The difference image appears after a run.';
        this.body.appendChild(h('div', { class: 'row' }, h('span', { class: 'gain' }, 'Gain', ...gainBtns), h('label', { class: 'inline' }, 'against ', vs)));
        this.body.appendChild(c);
        this.body.appendChild(h('p', { class: 'cap' }, text));
        break;
      }
      case 'overlay':
        this.body.appendChild(this.renderOverlay(o));
        break;
    }
  }

  private toImage(e: PointerEvent, svg: SVGSVGElement, o: Pixels): [number, number] | null {
    const uv = uvInContain(e, svg, o.w, o.h);
    return uv ? [Math.round(uv.u * o.w), Math.round(uv.v * o.h)] : null;
  }

  private renderOverlay(o: Pixels): HTMLElement {
    const c = h('canvas', { role: 'img', 'aria-label': `Original with overlay. ${this.overlaySummary}` });
    drawPixels(c, o);
    const svg = s('svg', { viewBox: `0 0 ${o.w} ${o.h}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' });
    const addPair = (make: (stroke: string, w: number) => SVGElement) => {
      svg.appendChild(make('#000', 4));
      svg.appendChild(make('#ffc53d', 2));
    };
    const style = (el: SVGElement, stroke: string, w: number) => {
      el.setAttribute('stroke', stroke);
      el.setAttribute('stroke-width', String(w));
      el.setAttribute('fill', 'none');
      el.setAttribute('vector-effect', 'non-scaling-stroke');
      return el;
    };
    for (const sh of this.overlay ?? []) {
      if (sh.kind === 'point') addPair((st, w) => style(s('circle', { cx: sh.x, cy: sh.y, r: Math.max(2, o.w / 150) }), st, w));
      else if (sh.kind === 'line') addPair((st, w) => style(s('line', { x1: sh.x1, y1: sh.y1, x2: sh.x2, y2: sh.y2 }), st, w));
      else if (sh.kind === 'circle') addPair((st, w) => style(s('circle', { cx: sh.x, cy: sh.y, r: sh.r }), st, w));
      else if (sh.kind === 'rect') addPair((st, w) => style(s('rect', { x: sh.x, y: sh.y, width: sh.w, height: sh.h }), st, w));
      else addPair((st, w) => style(s('polyline', { points: sh.points.map((p) => p.join(',')).join(' ') }), st, w));
    }
    if (this.pickRect) {
      svg.classList.add('interactive');
      svg.style.cursor = 'crosshair';
      const rectEl = s('rect', { x: this.rect?.x ?? 0, y: this.rect?.y ?? 0, width: this.rect?.w ?? 0, height: this.rect?.h ?? 0, fill: 'rgba(108,76,241,0.25)', stroke: '#6c4cf1', 'stroke-width': 2, 'stroke-dasharray': '6 3', 'vector-effect': 'non-scaling-stroke' });
      svg.appendChild(rectEl);
      let start: [number, number] | null = null;
      svg.addEventListener('pointerdown', (e) => {
        const p = this.toImage(e, svg, o);
        if (!p) return;
        start = p;
        svg.setPointerCapture(e.pointerId);
      });
      svg.addEventListener('pointermove', (e) => {
        if (!start) return;
        const p = this.toImage(e, svg, o);
        if (!p) return;
        const x = Math.min(start[0], p[0]), y = Math.min(start[1], p[1]);
        rectEl.setAttribute('x', String(x)); rectEl.setAttribute('y', String(y));
        rectEl.setAttribute('width', String(Math.abs(p[0] - start[0]))); rectEl.setAttribute('height', String(Math.abs(p[1] - start[1])));
      });
      svg.addEventListener('pointerup', (e) => {
        if (!start) return;
        const p = this.toImage(e, svg, o);
        const st = start;
        start = null;
        if (!p) return;
        const r = { x: Math.min(st[0], p[0]), y: Math.min(st[1], p[1]), w: Math.abs(p[0] - st[0]), h: Math.abs(p[1] - st[1]) };
        if (r.w >= 4 && r.h >= 4) {
          this.rect = r;
          this.hooks.onRect(r);
        }
      });
    }
    if (this.corners) {
      svg.classList.add('interactive');
      const names = ['top left', 'top right', 'bottom right', 'bottom left'];
      const poly = s('polygon', { fill: 'rgba(255,197,61,0.15)', stroke: '#ffc53d', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
      svg.appendChild(poly);
      const draw = () => poly.setAttribute('points', this.corners!.map((p) => p.join(',')).join(' '));
      draw();
      this.corners.forEach((pt, i) => {
        const g = s('g', { tabindex: 0, role: 'button', 'aria-label': `Corner ${i + 1}, ${names[i]}, at ${Math.round(pt[0])}, ${Math.round(pt[1])}. Arrow keys move it.` });
        const r = Math.max(8, o.w / 45);
        const dot = s('circle', { cx: pt[0], cy: pt[1], r, fill: '#ffc53d', stroke: '#1f1b3a', 'stroke-width': 3 });
        const label = s('text', { x: pt[0], y: pt[1] + r / 3, 'text-anchor': 'middle', 'font-size': r * 1.1, 'font-weight': 800, fill: '#1f1b3a' });
        label.textContent = String(i + 1);
        g.appendChild(dot); g.appendChild(label);
        const move = (x: number, y: number, commit: boolean) => {
          const nx = Math.max(0, Math.min(o.w - 1, x)), ny = Math.max(0, Math.min(o.h - 1, y));
          this.corners![i] = [Math.round(nx), Math.round(ny)];
          dot.setAttribute('cx', String(nx)); dot.setAttribute('cy', String(ny));
          label.setAttribute('x', String(nx)); label.setAttribute('y', String(ny + r / 3));
          draw();
          if (commit) this.hooks.onCorners(this.corners!.map((p) => [...p] as [number, number]));
        };
        g.addEventListener('pointerdown', (e) => { g.setPointerCapture(e.pointerId); e.preventDefault(); });
        g.addEventListener('pointermove', (e) => {
          if (!g.hasPointerCapture(e.pointerId)) return;
          const p = this.toImage(e, svg, o);
          if (p) move(p[0], p[1], false);
        });
        g.addEventListener('pointerup', (e) => {
          const p = this.toImage(e, svg, o);
          if (p) move(p[0], p[1], true);
        });
        g.addEventListener('keydown', (e) => {
          const st = e.shiftKey ? 10 : 2;
          const d: Record<string, [number, number]> = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] };
          if (!d[e.key]) return;
          e.preventDefault();
          e.stopPropagation();
          move(this.corners![i][0] + d[e.key][0], this.corners![i][1] + d[e.key][1], true);
        });
        svg.appendChild(g);
      });
    }
    const wrap = h('div', { class: 'ov' }, c, svg);
    wrap.style.setProperty('--ar', String(o.w / o.h));
    return h('div', {}, wrap, h('p', { class: 'cap' }, this.overlay ? this.overlaySummary || 'Shapes drawn over the original.' : this.pickRect ? 'Drag on the image to draw the template rectangle.' : this.corners ? 'Drag the numbered corners (or focus one and use the arrow keys).' : 'This concept draws nothing over the image.'));
  }
}
