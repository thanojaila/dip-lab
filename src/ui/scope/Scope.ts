import type { Pixels } from '../../core/matIO';
import type { RunOutput } from '../../core/runTechnique';
import type { TechniqueSpec } from '../../core/types';
import { h, nextId } from '../dom';
import { Heatmap } from './Heatmap';
import { HistogramScope } from './HistogramScope';
import { MetricsTable } from './MetricsTable';
import { SpectrumScope } from './SpectrumScope';
import { TransferCurve } from './TransferCurve';

export type ScopeKind = 'histogram' | 'curve' | 'spectrum' | 'table' | 'heatmap';
const NAMES: Record<ScopeKind, string> = { histogram: 'Histogram', curve: 'Transfer curve', spectrum: 'Spectrum', table: 'Numbers', heatmap: 'Heat map' };

/** The panel under the stage. Shows the scope the concept prefers, with the others available as tabs. */
export class Scope {
  readonly el: HTMLElement;
  readonly hist = new HistogramScope();
  readonly curve = new TransferCurve();
  readonly spectrum = new SpectrumScope();
  readonly heat = new Heatmap();
  readonly table = new MetricsTable();
  private bodies: Record<ScopeKind, HTMLElement>;
  private select = h('select', { id: nextId('scope') });
  private kind: ScopeKind = 'histogram';
  private out: RunOutput | null = null;
  private pref: ScopeKind = 'histogram';

  constructor() {
    this.bodies = { histogram: this.hist.el, curve: this.curve.el, spectrum: this.spectrum.el, table: this.table.el, heatmap: this.heat.el };
    this.select.addEventListener('change', () => this.show((this.select as HTMLSelectElement).value as ScopeKind));
    this.el = h('section', { class: 'panel scope', 'aria-label': 'Scope' }, h('div', { class: 'scope-controls' }, h('h2', { style: undefined }, 'Scope'), h('label', { class: 'inline', for: (this.select as HTMLSelectElement).id }, 'Show ', this.select)), ...Object.values(this.bodies));
    (this.el.querySelector('h2') as HTMLElement).style.margin = '0';
    this.show('histogram');
  }

  private available(): ScopeKind[] {
    const a: ScopeKind[] = ['histogram'];
    if (this.out?.curve) a.push('curve');
    if (this.out?.spectrum) a.push('spectrum');
    if (this.out?.heatmap) a.push('heatmap');
    if (this.out?.metrics) a.push('table');
    return a;
  }

  private show(k: ScopeKind): void {
    this.kind = k;
    for (const [id, el] of Object.entries(this.bodies)) el.classList.toggle('hidden', id !== k);
    (this.select as HTMLSelectElement).value = k;
  }

  /** Set the preferred scope for a concept (used when it is available). */
  setPreferred(spec: TechniqueSpec | null): void {
    this.pref = (spec?.scope ?? 'histogram') as ScopeKind;
    this.refresh();
  }

  update(orig: Pixels | null, res: Pixels | null, out: RunOutput | null, d0: number | null): void {
    this.out = out;
    this.hist.set(orig, res);
    this.curve.set(out?.curve ?? null);
    this.spectrum.set(out?.spectrum?.pixels ?? null, out?.spectrum ? d0 : null);
    this.heat.set(out?.heatmap ?? null);
    this.table.set(out?.metrics ?? null, out?.summary);
    this.refresh();
  }

  private refresh(): void {
    const avail = this.available();
    const sel = this.select as HTMLSelectElement;
    sel.textContent = '';
    for (const k of avail) sel.appendChild(h('option', { value: k }, NAMES[k]));
    this.show(avail.includes(this.pref) ? this.pref : avail.includes(this.kind) ? this.kind : 'histogram');
  }
}
