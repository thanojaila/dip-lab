import type { ParamSpec, ParamValue, Params, TechniqueSpec } from '../core/types';
import { defaultParams } from '../registry';
import { ChallengeBadge } from './ChallengeBadge';
import { h, nextId } from './dom';
import { SelfCheck } from './SelfCheck';

export interface CardHooks {
  onActivate(spec: TechniqueSpec): void;
  onRun(spec: TechniqueSpec, params: Params): void;
  /** Live-preview run: cheap, low resolution. */
  onPreview(spec: TechniqueSpec, params: Params): void;
  onHero(spec: TechniqueSpec): void;
  onMine(spec: TechniqueSpec, params: Params): void;
  onExport(spec: TechniqueSpec, params: Params): void;
  onParams(spec: TechniqueSpec, params: Params): void;
  onPickRect(spec: TechniqueSpec, on: boolean): void;
  onCancel(): void;
  onPredictRun(spec: TechniqueSpec): Promise<boolean>;
  onPredictDone(spec: TechniqueSpec): void;
  onRefFile(spec: TechniqueSpec, f: File): void;
  onColourExample(): void;
}

const NEEDS_TEXT: Record<string, string> = {
  gray: 'Works on gray. A colour image is converted first, and the card says so.',
  binary: 'Works on a binary image. The picture is thresholded first (Otsu unless you set a threshold); the threshold used is shown in the Exact panel.',
  color: 'Needs a colour image.',
};

export class ConceptCard {
  readonly el: HTMLElement;
  readonly selfCheck?: SelfCheck;
  readonly challenge?: ChallengeBadge;
  /** Slot where the app puts a KernelGrid / StructuringElement explainer. */
  readonly explainerSlot = h('div', {});
  private controls = new Map<string, HTMLInputElement | HTMLSelectElement>();
  private outputs = new Map<string, HTMLOutputElement>();
  private body: HTMLElement;
  private toggle: HTMLButtonElement;
  private stampEl = h('span', { class: 'stamp', role: 'img', 'aria-label': 'Stamp not earned yet' }, '');
  private runBtn: HTMLButtonElement;
  private heroBtn: HTMLButtonElement;
  private mineBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private live?: HTMLInputElement;
  private colourMsg = h('p', { class: 'unavail hidden', role: 'note' });
  private ready = false;
  private busy = false;
  private active = false;
  private pickBtn?: HTMLButtonElement;

  constructor(readonly spec: TechniqueSpec, private hooks: CardHooks, private missingApis: string[], sampleTitle?: string) {
    void sampleTitle;
    const unavailable = missingApis.length > 0 && !spec.explainerOnly;
    const hid = nextId('ch');
    const bodyId = nextId('cb');
    this.toggle = h(
      'button',
      { type: 'button', class: 'card-toggle', 'aria-expanded': 'false', 'aria-controls': bodyId, id: hid, onclick: () => (this.active ? this.setActive(false) : hooks.onActivate(spec)) },
      h('span', { class: 'tid' }, spec.id),
      h('span', {}, h('h3', {}, spec.title), h('p', { class: 'card-q' }, spec.question)),
      this.stampEl,
    );
    this.runBtn = h('button', { type: 'button', class: 'btn primary', 'aria-keyshortcuts': 'Control+Enter Meta+Enter', onclick: () => this.run() }, 'Run');
    this.heroBtn = h('button', { type: 'button', class: 'btn', onclick: () => hooks.onHero(spec) }, 'Show me');
    this.mineBtn = h('button', { type: 'button', class: 'btn', onclick: () => hooks.onMine(spec, this.getParams()) }, 'Try this on my image');
    this.cancelBtn = h('button', { type: 'button', class: 'btn hidden', onclick: hooks.onCancel }, 'Cancel');
    const resetBtn = h('button', { type: 'button', class: 'btn', onclick: () => this.setParams(defaultParams(spec)) }, 'Reset');
    const cfgBtn = h('button', { type: 'button', class: 'btn', onclick: () => hooks.onExport(spec, this.getParams()) }, 'Export config');
    if (spec.livePreview) {
      this.live = h('input', { type: 'checkbox', id: nextId('live') });
    }
    if (spec.pickRect) {
      this.pickBtn = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', onclick: () => {
        const on = this.pickBtn!.getAttribute('aria-pressed') !== 'true';
        this.pickBtn!.setAttribute('aria-pressed', String(on));
        hooks.onPickRect(spec, on);
      } }, 'Draw template on stage');
    }
    const params = spec.params.filter((p) => !p.hidden).map((p) => this.paramRow(p));
    for (const p of spec.params.filter((x) => x.hidden)) this.hiddenParams.set(p.key, p.default);

    if (spec.selfCheck) {
      this.selfCheck = new SelfCheck(spec.selfCheck, {
        runPreset: spec.explainerOnly ? undefined : () => hooks.onPredictRun(spec),
        onRevealed: () => hooks.onPredictDone(spec),
      });
    }
    if (spec.challenge) this.challenge = new ChallengeBadge();
    const refInput = spec.needsRef
      ? h('div', { class: 'param' }, h('label', { for: 'ref-' + spec.id }, 'Or upload your own reference image'), (() => {
          const f = h('input', { type: 'file', id: 'ref-' + spec.id, accept: 'image/png,image/jpeg,image/webp' });
          f.addEventListener('change', () => { const file = (f as HTMLInputElement).files?.[0]; if (file) hooks.onRefFile(spec, file); });
          return f;
        })())
      : null;

    this.body = h(
      'div',
      { class: 'card-body', id: bodyId, role: 'region', 'aria-labelledby': hid, hidden: true },
      h('p', { class: 'blurb' }, spec.blurb),
      unavailable ? h('p', { class: 'unavail', role: 'note' }, `Unavailable in this OpenCV.js build: missing ${missingApis.map((a) => 'cv.' + a).join(', ')}.`) : null,
      spec.explainerOnly ? h('p', { class: 'unavail', role: 'note' }, 'Runs in Python in the course labs, not in this browser lab. This card explains the idea; it never fakes a demo.') : null,
      NEEDS_TEXT[spec.needs ?? 'any'] ? h('p', { class: 'needs-note' }, NEEDS_TEXT[spec.needs!]) : null,
      this.colourMsg,
      params.length ? h('div', { class: 'params' }, ...params) : spec.explainerOnly ? null : h('p', { class: 'hint' }, 'No parameters.'),
      refInput,
      spec.explainerOnly ? null : h('div', { class: 'row' }, this.runBtn, this.heroBtn, this.mineBtn, resetBtn, cfgBtn, this.pickBtn, this.live ? h('label', { class: 'inline', for: this.live.id }, this.live, 'Live preview') : null, this.cancelBtn),
      this.explainerSlot,
      this.colabSection(),
      h('details', { class: 'notes', open: true }, h('summary', {}, 'What the parameters do'), h('ul', {}, ...spec.effectNotes.map((n) => h('li', {}, n)))),
      spec.misconception ? h('p', { class: 'watch', role: 'note' }, spec.misconception) : null,
      this.challenge?.el ?? null,
      this.selfCheck?.el ?? null,
    );
    this.el = h('article', { class: 'card', id: `tech-${spec.id}` }, this.toggle, this.body);
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !this.runBtn.disabled && !spec.explainerOnly) {
        e.preventDefault();
        this.run();
      }
    });
    this.refresh();
  }

  private hiddenParams = new Map<string, ParamValue>();

  /** "Colab code" panel: the course notebook cell(s) behind this concept, verbatim, with copy buttons. */
  private colabSection(): HTMLElement | null {
    const snippets = this.spec.colab;
    if (!snippets?.length) return null;
    return h(
      'details',
      { class: 'notes colab' },
      h('summary', {}, 'Colab code (paste into a notebook)'),
      ...snippets.map((s) => {
        const copy = h('button', { type: 'button', class: 'btn' }, 'Copy') as HTMLButtonElement;
        copy.addEventListener('click', () => {
          void navigator.clipboard?.writeText(s.code).then(() => {
            copy.textContent = 'Copied';
            setTimeout(() => (copy.textContent = 'Copy'), 1500);
          }).catch(() => undefined);
        });
        return h(
          'div',
          { class: 'colab-cell' },
          h('p', { class: 'hint' }, `${s.notebook} — ${s.cell}`),
          h('pre', { class: 'colab-code', tabindex: '0' }, h('code', {}, s.code)),
          s.note ? h('p', { class: 'hint' }, s.note) : null,
          copy,
        );
      }),
    );
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
    const update = (commit: boolean) => {
      const o = this.outputs.get(p.key);
      if (o) o.value = String(this.read(p));
      this.hooks.onParams(this.spec, this.getParams());
      if (this.live?.checked && this.ready && !this.missingApis.length) {
        if (commit) this.hooks.onRun(this.spec, this.getParams());
        else this.hooks.onPreview(this.spec, this.getParams());
      }
    };
    input.addEventListener('input', () => update(false));
    input.addEventListener('change', () => update(true));
    const out = p.type === 'range' ? h('output', { for: id }, String(p.default)) : null;
    if (out) this.outputs.set(p.key, out);
    const helpId = p.help ? `${id}-help` : undefined;
    if (helpId) input.setAttribute('aria-describedby', helpId);
    if (p.type === 'checkbox') return h('div', { class: 'param' }, h('label', { class: 'inline', for: id }, input, p.label), p.help ? h('p', { class: 'hint', id: helpId }, p.help) : null);
    return h('div', { class: 'param' }, h('label', { for: id }, p.label, out ? h('span', { class: 'val' }, out) : null), input, p.help ? h('p', { class: 'hint', id: helpId }, p.help) : null);
  }

  private read(p: ParamSpec): ParamValue {
    const c = this.controls.get(p.key)!;
    if (p.type === 'checkbox') return (c as HTMLInputElement).checked;
    if (p.type === 'select') return c.value;
    return Number(c.value);
  }

  getParams(): Params {
    const out: Params = {};
    for (const p of this.spec.params) out[p.key] = p.hidden ? (this.hiddenParams.get(p.key) ?? p.default) : this.read(p);
    return out;
  }

  /** Set parameters from outside (hero demo, stage drag, import). Does not run. */
  setParams(params: Params): void {
    for (const p of this.spec.params) {
      if (!(p.key in params)) continue;
      if (p.hidden) { this.hiddenParams.set(p.key, params[p.key]); continue; }
      const c = this.controls.get(p.key)!;
      if (p.type === 'checkbox') (c as HTMLInputElement).checked = params[p.key] === true;
      else c.value = String(params[p.key]);
      const o = this.outputs.get(p.key);
      if (o) o.value = String(params[p.key]);
    }
    this.hooks.onParams(this.spec, this.getParams());
  }

  setActive(on: boolean): void {
    this.active = on;
    this.body.hidden = !on;
    this.toggle.setAttribute('aria-expanded', String(on));
    this.el.classList.toggle('active', on);
  }
  isActive(): boolean { return this.active; }

  setStamp(demo: boolean, predict: boolean, pop = false): void {
    const earned = demo && predict;
    this.stampEl.classList.toggle('earned', earned);
    this.stampEl.textContent = earned ? '★' : demo || predict ? '½' : '';
    this.stampEl.setAttribute('aria-label', earned ? 'Stamp earned' : `Stamp not earned yet: demo ${demo ? 'done' : 'not run'}, prediction ${predict ? 'made' : 'not made'}`);
    if (pop && earned) {
      this.stampEl.classList.remove('pop');
      void this.stampEl.offsetWidth;
      this.stampEl.classList.add('pop');
    }
  }

  setReady(r: boolean): void { this.ready = r; this.refresh(); }
  setBusy(b: boolean, cancellable = false): void {
    this.busy = b;
    this.runBtn.textContent = b ? 'Running…' : 'Run';
    this.cancelBtn.classList.toggle('hidden', !(b && cancellable));
    this.refresh();
  }
  private refresh(): void {
    const off = !this.ready || this.busy || (this.missingApis.length > 0 && !this.spec.explainerOnly);
    this.runBtn.disabled = off;
    this.heroBtn.disabled = off;
    this.mineBtn.disabled = off;
  }

  /** Show or hide the "needs a colour image" message. */
  setColourNeeded(on: boolean): void {
    this.colourMsg.classList.toggle('hidden', !on);
    this.colourMsg.textContent = '';
    if (on) {
      this.colourMsg.appendChild(document.createTextNode('This concept needs a colour image. '));
      this.colourMsg.appendChild(h('button', { type: 'button', class: 'link', onclick: () => this.hooks.onColourExample() }, 'Load a colour example'));
    }
  }

  setPickRectOn(on: boolean): void { this.pickBtn?.setAttribute('aria-pressed', String(on)); }
  focusRun(): void { this.runBtn.focus(); }
  isLive(): boolean { return !!this.live?.checked; }

  private run(): void {
    if (!this.runBtn.disabled) this.hooks.onRun(this.spec, this.getParams());
  }
}
