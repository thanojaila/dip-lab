import type { ParamSpec, ParamValue, Params, TechniqueSpec } from '../core/types';
import { defaultParams } from '../registry';
import { h, nextId } from './dom';
import { SelfCheck } from './SelfCheck';

export interface CardOptions {
  missingApis: string[];
  sampleTitle?: string;
  onRun(spec: TechniqueSpec, params: Params): void;
  onLoadSample(id: string): void;
  onExportConfig(spec: TechniqueSpec, params: Params): void;
  onSelfCheckRun(spec: TechniqueSpec): Promise<boolean>;
  onSelfCheckRevealed(spec: TechniqueSpec): void;
}

const TIER_LABEL: Record<string, string> = { mvp: '', p2: 'Phase 2', stretch: 'Stretch', out: 'Not in browser' };

export class TechniqueCard {
  readonly el: HTMLElement;
  readonly selfCheck?: SelfCheck;
  private controls = new Map<string, HTMLInputElement | HTMLSelectElement>();
  private outputs = new Map<string, HTMLOutputElement>();
  private runBtn: HTMLButtonElement;
  private live?: HTMLInputElement;
  private ready = false;
  private liveTimer = 0;

  constructor(readonly spec: TechniqueSpec, private opts: CardOptions) {
    const unavailable = opts.missingApis.length > 0;
    const headingId = nextId('th');
    const paramRows = spec.params.map((p) => this.paramRow(p));
    this.runBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => this.run(), 'aria-keyshortcuts': 'Control+Enter Meta+Enter' }, 'Run');
    const resetBtn = h('button', { type: 'button', class: 'btn secondary', onclick: () => { this.setParams(defaultParams(spec)); } }, 'Reset');
    const cfgBtn = h('button', { type: 'button', class: 'btn secondary', onclick: () => opts.onExportConfig(spec, this.getParams()) }, 'Export config JSON');
    if (spec.livePreview) {
      this.live = h('input', { type: 'checkbox', id: nextId('live') });
      this.live.addEventListener('change', () => this.maybeLive());
    }
    const tier = TIER_LABEL[spec.tier];
    this.selfCheck = spec.selfCheck
      ? new SelfCheck(spec.selfCheck, {
          runPreset: () => opts.onSelfCheckRun(spec),
          onRevealed: () => opts.onSelfCheckRevealed(spec),
        })
      : undefined;

    this.el = h(
      'article',
      { class: `card${unavailable ? ' unavailable' : ''}`, id: `tech-${spec.id}`, 'aria-labelledby': headingId },
      h('header', { class: 'card-head' }, h('h3', { id: headingId }, h('span', { class: 'tid' }, spec.id), ' ', spec.title), tier ? h('span', { class: 'badge' }, tier) : null),
      h('p', { class: 'blurb' }, spec.blurb),
      unavailable ? h('p', { class: 'unavail', role: 'note' }, `Unavailable in this OpenCV.js build: missing ${opts.missingApis.map((a) => 'cv.' + a).join(', ')}.`) : null,
      spec.sampleHint && opts.sampleTitle
        ? h('p', { class: 'sample-hint' }, 'Works best on: ', h('button', { type: 'button', class: 'link', onclick: () => opts.onLoadSample(spec.sampleHint!) }, opts.sampleTitle))
        : null,
      paramRows.length ? h('div', { class: 'params' }, ...paramRows) : h('p', { class: 'hint' }, 'No parameters.'),
      h('div', { class: 'row' }, this.runBtn, resetBtn, cfgBtn, this.live ? h('label', { class: 'inline', for: this.live.id }, this.live, ' Live preview') : null),
      h('details', { class: 'notes', open: true }, h('summary', {}, 'What the parameters do'), h('ul', {}, ...spec.effectNotes.map((n) => h('li', {}, n)))),
      spec.misconception ? h('p', { class: 'callout', role: 'note' }, spec.misconception) : null,
      this.selfCheck?.el ?? null,
    );
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !this.runBtn.disabled) {
        e.preventDefault();
        this.run();
      }
    });
    this.refresh();
  }

  private paramRow(p: ParamSpec): HTMLElement {
    const id = nextId('p');
    let input: HTMLInputElement | HTMLSelectElement;
    if (p.type === 'select') {
      input = h('select', { id }, ...(p.options ?? []).map((o) => h('option', { value: o.value }, o.label)));
      input.value = String(p.default);
    } else if (p.type === 'checkbox') {
      input = h('input', { type: 'checkbox', id });
      (input as HTMLInputElement).checked = p.default === true;
    } else {
      input = h('input', { type: 'range', id, min: p.min, max: p.max, step: p.step });
      input.value = String(p.default);
    }
    this.controls.set(p.key, input);
    const onChange = () => {
      const o = this.outputs.get(p.key);
      if (o) o.value = String(this.read(p));
      this.maybeLive();
    };
    input.addEventListener('input', onChange);
    input.addEventListener('change', onChange);
    let out: HTMLOutputElement | null = null;
    if (p.type === 'range') {
      out = h('output', { for: id }, String(p.default));
      this.outputs.set(p.key, out);
    }
    const helpId = p.help ? `${id}-help` : undefined;
    if (helpId) input.setAttribute('aria-describedby', helpId);
    if (p.type === 'checkbox') return h('div', { class: 'param' }, h('label', { class: 'inline', for: id }, input, ' ', p.label), p.help ? h('p', { class: 'hint', id: helpId }, p.help) : null);
    return h('div', { class: 'param' }, h('label', { for: id }, p.label, out ? h('span', { class: 'val' }, out) : null), input, p.help ? h('p', { class: 'hint', id: helpId }, p.help) : null);
  }

  private read(p: ParamSpec): ParamValue {
    const c = this.controls.get(p.key)!;
    if (p.type === 'checkbox') return (c as HTMLInputElement).checked;
    if (p.type === 'select') return c.value;
    return Number(c.value);
  }

  getParams(): Params {
    return Object.fromEntries(this.spec.params.map((p) => [p.key, this.read(p)]));
  }

  setParams(params: Params): void {
    for (const p of this.spec.params) {
      if (!(p.key in params)) continue;
      const c = this.controls.get(p.key)!;
      if (p.type === 'checkbox') (c as HTMLInputElement).checked = params[p.key] === true;
      else c.value = String(params[p.key]);
      const o = this.outputs.get(p.key);
      if (o) o.value = String(params[p.key]);
    }
    this.maybeLive();
  }

  /** Enable Run once the engine and an image are ready. */
  setReady(ready: boolean): void {
    this.ready = ready;
    this.refresh();
  }

  setBusy(busy: boolean): void {
    this.runBtn.disabled = busy || !this.ready || this.opts.missingApis.length > 0;
    this.runBtn.textContent = busy ? 'Running…' : 'Run';
  }

  private refresh(): void {
    this.runBtn.disabled = !this.ready || this.opts.missingApis.length > 0;
  }

  private run(): void {
    if (!this.runBtn.disabled) this.opts.onRun(this.spec, this.getParams());
  }

  private maybeLive(): void {
    if (!this.live?.checked || !this.ready || this.opts.missingApis.length) return;
    cancelAnimationFrame(this.liveTimer);
    this.liveTimer = requestAnimationFrame(() => this.opts.onRun(this.spec, this.getParams()));
  }

  focusRun(): void {
    this.runBtn.focus();
  }
}
