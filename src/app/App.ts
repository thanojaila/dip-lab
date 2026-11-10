import { missingApis, probe, PROBED_APIS, type CapabilityMap } from '../core/capability';
import { exportConfig, importConfig } from '../core/config';
import { checkupStats, suggest } from '../core/imageCheckup';
import { downscaleTo, isGrayPixels } from '../core/imageOps';
import { loadOpenCv, OPENCV_VERSION } from '../core/opencvLoader';
import { matToPixels, pixelsToMat, withMats, type Pixels } from '../core/matIO';
import { Progress } from '../core/progress';
import { MAX_SIDE, planResize, validateUpload } from '../core/resizePolicy';
import { executeRun, type RunOutput, type RunRequest } from '../core/runTechnique';
import { ALL_SAMPLE_IDS, imageById, loadSamplePixels, normalizeSampleId, refById } from '../core/sampleRegistry';
import { APP_VERSION, type Cv, type ImageMeta, type Params, type TechniqueSpec } from '../core/types';
import { HeavyRunner } from '../core/workerClient';
import { SEGMENTS, TECHNIQUES, defaultParams, heroParamsOf, techniqueById, techniquesIn } from '../registry';
import { Attribution } from '../ui/Attribution';
import { ChallengeBadge } from '../ui/ChallengeBadge';
import { ConceptCard } from '../ui/ConceptCard';
import { clear, h, prefersReducedMotion } from '../ui/dom';
import { EngineStatus } from '../ui/Engine';
import { ExactPanel } from '../ui/ExactPanel';
import { KernelGrid } from '../ui/explainers/KernelGrid';
import { StepStrip } from '../ui/explainers/StepStrip';
import { StructuringElementView } from '../ui/explainers/StructuringElement';
import { ImageShelf } from '../ui/ImageShelf';
import { InstructorPanel, InstructorSegmentNotes } from '../ui/InstructorPanel';
import { Scope } from '../ui/scope/Scope';
import { Stage } from '../ui/stage/Stage';
import { TopBar } from '../ui/TopBar';
import { WorldMap } from '../ui/WorldMap';

const THEME_KEY = 'diplab.theme';
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const safeStorage = (): Storage | null => { try { return localStorage; } catch { return null; } };

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Source {
  /** Bundled image or test-pattern id; null for the learner's upload. */
  id: string | null;
  title: string;
  base: Pixels;
  origW: number;
  origH: number;
  resized: boolean;
}
interface HistoryStep { label: string; before: Pixels; id: string }

export class App {
  private cv: Cv | null = null;
  private caps: CapabilityMap = {};
  private progress = new Progress(safeStorage(), TECHNIQUES.map((t) => t.id));
  private heavy = new HeavyRunner();
  private src: Source | null = null;
  private working: Pixels | null = null;
  private history: HistoryStep[] = [];
  private upload: Source | null = null;
  private refUpload: Pixels | null = null;
  private mine = false;
  private out: RunOutput | null = null;
  private activeId: string | null = null;
  private busy = false;
  private dirty = false;
  private pendingMine: { spec: TechniqueSpec; params: Params } | null = null;
  private instructorOn = false;
  private guided = true;

  private topbar: TopBar;
  private stage: Stage;
  private scope = new Scope();
  private exact = new ExactPanel();
  private steps = new StepStrip();
  private shelf: ImageShelf;
  private map: WorldMap;
  private message = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  private cards = new Map<string, ConceptCard>();
  private worlds = new Map<string, HTMLElement>();
  private kernels = new Map<string, KernelGrid>();
  private se = new StructuringElementView();
  private guide = h('section', { class: 'panel guide', 'aria-label': 'Guided path' });
  private instructorPanel = InstructorPanel();
  private timers = new Map<string, number>();

  constructor(private root: HTMLElement) {
    this.topbar = new TopBar({ onMap: () => this.map.open(), onInstructor: () => this.toggleInstructor(), onTheme: () => this.toggleTheme() });
    this.stage = new Stage({
      onPin: () => this.pin(),
      onUseAsInput: () => this.chain(),
      onExportPng: () => this.exportPng(),
      onResetImage: () => this.resetImage(),
      onFile: (f) => void this.loadUpload(f),
      onUndo: (i) => this.undo(i),
      onCancel: () => this.cancel(),
      onRect: (r) => this.onRect(r),
      onCorners: (c) => this.onCorners(c),
    });
    this.shelf = new ImageShelf({ onPick: (id) => void this.pickSample(id), onFile: (f) => void this.loadUpload(f), onSuggestion: (id) => this.activate(id, true) });
    this.map = new WorldMap(SEGMENTS, TECHNIQUES, this.progress, (w) => this.goWorld(w), () => this.resetProgress());
    this.scope.spectrum.onCutoff = (d0) => this.onCutoff(d0);
    this.stage.inspector.onChange = (v) => {
      this.scope.curve.setMark(v);
      this.refreshKernel();
    };
    window.addEventListener('beforeunload', (e) => {
      if (this.dirty) { e.preventDefault(); e.returnValue = ''; }
    });
    this.initTheme();
  }

  // =========================================================== startup
  async start(): Promise<void> {
    this.build();
    await this.pickSample(TECHNIQUES[0].heroImage, false);
    const t0 = performance.now();
    try {
      this.cv = await loadOpenCv();
      this.caps = probe(this.cv as unknown as Record<string, unknown>, [...PROBED_APIS, ...new Set(TECHNIQUES.filter((t) => !t.explainerOnly).flatMap((t) => t.requiredCvApis))]);
      this.topbar.engineSlot.appendChild(EngineStatus(this.caps, OPENCV_VERSION, performance.now() - t0));
      this.applyAvailability();
      for (const c of this.cards.values()) c.setReady(true);
      this.say('Engine ready. Open a concept, press "Show me", or upload your own image.');
    } catch (e) {
      this.topbar.engineSlot.appendChild(h('p', { class: 'error', role: 'alert' }, `OpenCV.js failed to load: ${(e as Error).message} Concepts are disabled; the page cannot process images without it.`));
    }
  }

  private build(): void {
    const worlds = SEGMENTS.map((w) => this.buildWorld(w));
    this.buildGuide();
    const left = h('div', { class: 'col-left' }, this.guide, this.instructorPanel, h('section', { class: 'panel', id: 'about' }, h('h2', {}, 'How this works'), h('ol', {},
      h('li', {}, 'Open a concept. The stage shows a real photograph chosen because it shows the problem.'),
      h('li', {}, 'Commit to a prediction, press "Show me", and drag the divider between Original and Result.'),
      h('li', {}, 'Hover the image to read the actual pixel numbers; read the Exact panel to see precisely what ran.'),
      h('li', {}, 'Upload your own image any time: every concept works on it.')), this.importControl()), this.message, ...worlds, Attribution(() => this.resetProgress()));
    const right = h('aside', { class: 'col-right', 'aria-label': 'Stage and results' }, this.stage.el, this.scope.el, this.steps.el, this.exact.el, this.shelf.el);
    this.root.append(
      h('a', { class: 'skip', href: '#main' }, 'Skip to the lab'),
      this.topbar.el,
      h('main', { id: 'main', class: 'layout' }, left, right),
      h('footer', { class: 'site-footer' }, h('p', {}, `DIP Lab v${APP_VERSION} · MIT licensed · `, h('a', { href: '#attribution' }, 'Attribution and privacy'))),
      this.map.dialog,
    );
    this.refreshProgress();
    for (const c of this.cards.values()) c.setReady(false);
  }

  private buildWorld(w: (typeof SEGMENTS)[number]): HTMLElement {
    const el = h('section', { class: `world accent-${w.accent}`, id: `seg-${w.id}`, 'aria-labelledby': `wh-${w.id}` });
    el.appendChild(h('header', { class: 'world-head' }, h('p', { class: 'num' }, `World ${w.index}`), h('h2', { id: `wh-${w.id}` }, w.title), h('p', {}, w.tagline), w.note ? h('span', { class: 'world-note' }, w.note) : null));
    const notes = InstructorSegmentNotes(w.id);
    if (notes) el.appendChild(notes);
    for (const t of techniquesIn(w.id)) {
      const card = new ConceptCard(t, {
        onActivate: (s) => this.activate(s.id, false),
        onRun: (s, p) => void this.run(s, p),
        onPreview: (s, p) => this.preview(s, p),
        onHero: (s) => void this.runHero(s),
        onMine: (s, p) => void this.runMine(s, p),
        onExport: (s, p) => this.exportCfg(s, p),
        onParams: (s, p) => this.onParams(s, p),
        onPickRect: (s, on) => this.pickRect(s, on),
        onCancel: () => this.cancel(),
        onPredictRun: (s) => this.runHero(s, s.selfCheck?.preset),
        onPredictDone: (s) => this.earn(s.id, 'predict'),
        onRefFile: (s, f) => void this.loadRef(s, f),
        onColourExample: () => void this.pickSample('cat'),
      }, [], undefined);
      this.cards.set(t.id, card);
      card.setStamp(false, false);
      el.appendChild(card.el);
    }
    this.worlds.set(w.id, el);
    return el;
  }

  /** Replace cards whose OpenCV APIs are missing with an "Unavailable" version (never silent failure). */
  private applyAvailability(): void {
    for (const t of TECHNIQUES) {
      if (t.explainerOnly) continue;
      const missing = missingApis(t, this.caps);
      if (!missing.length) continue;
      const old = this.cards.get(t.id)!;
      const card = new ConceptCard(t, (old as unknown as { hooks: ConstructorParameters<typeof ConceptCard>[1] }).hooks, missing);
      old.el.replaceWith(card.el);
      this.cards.set(t.id, card);
    }
  }

  private say(msg: string): void {
    this.message.textContent = msg;
  }

  // =========================================================== theme, instructor
  private initTheme(): void {
    let saved: string | null = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
    if (saved === 'dark' || saved === 'light') document.documentElement.setAttribute('data-theme', saved);
    this.topbar.setTheme(this.isDark());
  }
  private isDark(): boolean {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  }
  private toggleTheme(): void {
    const next = this.isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
    this.topbar.setTheme(next === 'dark');
    this.scope.update(this.stage.getResult() ? this.working : this.working, this.stage.getResult(), this.out, this.currentD0());
  }
  private toggleInstructor(): void {
    this.instructorOn = !this.instructorOn;
    this.topbar.instructorBtn.setAttribute('aria-pressed', String(this.instructorOn));
    this.instructorPanel.classList.toggle('hidden', !this.instructorOn);
    for (const n of this.root.querySelectorAll('[data-instructor]')) n.classList.toggle('hidden', !this.instructorOn);
    if (this.instructorOn) this.instructorPanel.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  // =========================================================== progress and guide
  private importControl(): HTMLElement {
    const f = h('input', { type: 'file', id: 'cfg-file', accept: 'application/json,.json' });
    f.addEventListener('change', () => {
      const file = (f as HTMLInputElement).files?.[0];
      (f as HTMLInputElement).value = '';
      if (!file) return;
      if (file.size > 64 * 1024) { this.say('Rejected: config files are tiny; this one is over 64 KB.'); return; }
      void file.text().then((t) => this.importConfigText(t));
    });
    return h('div', { class: 'param' }, h('label', { for: 'cfg-file' }, 'Import a shared concept config (.json, parameters only)'), f);
  }

  private buildGuide(): void {
    this.refreshGuide();
  }
  private nextConcept(): TechniqueSpec | undefined {
    return TECHNIQUES.find((t) => !this.progress.hasStamp(t.id));
  }
  private refreshGuide(): void {
    clear(this.guide);
    const next = this.nextConcept();
    const toggle = h('input', { type: 'checkbox', id: 'guided-toggle', checked: this.guided });
    toggle.addEventListener('change', () => { this.guided = (toggle as HTMLInputElement).checked; this.refreshGuide(); });
    this.guide.appendChild(h('div', { class: 'guide' },
      h('strong', {}, this.guided ? (next ? `Up next: ${next.id} ${next.title}` : 'Every concept has its stamp.') : 'Free browse'),
      this.guided && next ? h('button', { type: 'button', class: 'btn small primary', onclick: () => this.activate(next.id, true) }, 'Go') : null,
      h('button', { type: 'button', class: 'btn small', onclick: () => this.map.open() }, 'World map'),
      h('label', { class: 'inline', for: 'guided-toggle' }, toggle, 'Guided path')));
  }
  private refreshProgress(): void {
    this.topbar.setProgress(this.progress.count(), TECHNIQUES.length);
    for (const t of TECHNIQUES) {
      const p = this.progress.part(t.id);
      this.cards.get(t.id)?.setStamp(p.demo, p.predict);
    }
    this.refreshGuide();
  }
  private earn(id: string, part: 'demo' | 'predict'): void {
    const done = this.progress.earn(id, part);
    const p = this.progress.part(id);
    this.cards.get(id)?.setStamp(p.demo, p.predict, done);
    this.topbar.setProgress(this.progress.count(), TECHNIQUES.length);
    this.refreshGuide();
    if (done) this.say(`Stamp earned for ${id} ${techniqueById(id)?.title}. ${this.progress.count()} of ${TECHNIQUES.length} so far.`);
  }
  private resetProgress(): void {
    this.progress.reset();
    this.refreshProgress();
    this.say('Progress reset. Stamps and challenge results in this browser were cleared.');
  }

  // =========================================================== navigation
  private goWorld(id: string): void {
    const first = techniquesIn(id).find((t) => !this.progress.hasStamp(t.id)) ?? techniquesIn(id)[0];
    if (first) this.activate(first.id, true);
  }

  /** Expand a concept, put its hero image on the stage (unless the learner's own image is in use). */
  private activate(id: string, scroll: boolean): void {
    const spec = techniqueById(id);
    if (!spec) return;
    for (const [cid, c] of this.cards) c.setActive(cid === id);
    this.activeId = id;
    const card = this.cards.get(id)!;
    this.scope.setPreferred(spec);
    this.shelf.setConcept(spec);
    this.stage.setPickRect(false, null);
    this.stage.setCorners(null);
    card.setPickRectOn(false);
    if (spec.explainerOnly) this.earn(id, 'demo');
    const finish = () => {
      if (spec.needs === 'color' && this.working) card.setColourNeeded(isGrayPixels(this.working));
      if (spec.pickCorners) this.stage.setCorners(this.cornersOf(spec, card.getParams()));
      this.refreshKernel();
      this.refreshSE();
      this.scope.update(this.working, this.stage.getResult(), this.out, this.currentD0());
    };
    if (!this.mine && !spec.explainerOnly && this.src?.id !== spec.heroImage) void this.pickSample(spec.heroImage, false).then(finish);
    else finish();
    if (scroll) card.el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  // =========================================================== images
  private async pickSample(rawId: string, announce = true): Promise<void> {
    const id = normalizeSampleId(rawId);
    const ref = refById(id);
    if (!ref) return;
    const px = await loadSamplePixels(id);
    this.mine = false;
    this.setSource({ id, title: ref.title, base: px, origW: px.w, origH: px.h, resized: false });
    if (announce) this.say(`${ref.title}: ${ref.teaches}`);
  }

  private setSource(s: Source): void {
    this.src = s;
    this.working = s.base;
    this.history = [];
    this.out = null;
    this.dirty = false;
    this.stage.setOriginal(s.base, `${s.title}, ${s.base.w}×${s.base.h}`);
    this.stage.setPinned(null, '');
    this.stage.setResult(null, '');
    this.stage.setPipeline(s.title, []);
    this.shelf.setActive(s.id, this.mine);
    this.exact.set('Ready', 'Run a concept to see exactly what was computed, with your numbers filled in.');
    this.steps.set(undefined);
    this.scope.update(s.base, null, null, null);
    this.setChallenge(null);
    const spec = this.activeId ? techniqueById(this.activeId) : null;
    if (spec?.needs === 'color') this.cards.get(spec.id)?.setColourNeeded(isGrayPixels(s.base));
    for (const c of this.cards.values()) c.setColourNeeded(false);
    if (spec?.needs === 'color') this.cards.get(spec.id)?.setColourNeeded(isGrayPixels(s.base));
    if (spec?.pickCorners) this.stage.setCorners(this.cornersOf(spec, this.cards.get(spec.id)!.getParams()));
  }

  private async loadUpload(file: File): Promise<void> {
    if (!this.cv) { this.say('Please wait for OpenCV.js to finish loading, then upload again.'); return; }
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const v = validateUpload(file.size, file.type, head);
    if (!v.ok) { this.say(`Rejected: ${v.reason}`); return; }
    let bmp: ImageBitmap;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { this.say('Rejected: this file could not be decoded as an image.'); return; }
    const cv = this.cv;
    try {
      if (bmp.width * bmp.height > 40_000_000) { this.say(`Rejected: ${bmp.width}×${bmp.height} is too many pixels to decode safely (limit 40 megapixels).`); return; }
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0);
      const full = ctx.getImageData(0, 0, c.width, c.height);
      const plan = planResize(bmp.width, bmp.height, MAX_SIDE);
      let px: Pixels = { w: full.width, h: full.height, data: full.data };
      if (plan.resized) {
        const big = px;
        px = withMats((track) => {
          const s = track(pixelsToMat(cv, big));
          const d = track(new cv.Mat());
          cv.resize(s, d, new cv.Size(plan.w, plan.h), 0, 0, cv.INTER_AREA);
          return matToPixels(cv, d);
        });
      }
      this.upload = { id: null, title: 'Your image', base: px, origW: bmp.width, origH: bmp.height, resized: plan.resized };
      this.mine = true;
      this.setSource(this.upload);
      this.shelf.setCheckup(suggest(checkupStats(px)));
      this.say(plan.resized ? `Decoded ${bmp.width}×${bmp.height}; resized to ${px.w}×${px.h} (INTER_AREA) because the longest side is limited to ${MAX_SIDE} px.` : `Decoded ${bmp.width}×${bmp.height}; no resize needed.`);
      if (this.pendingMine) {
        const { spec, params } = this.pendingMine;
        this.pendingMine = null;
        void this.run(spec, params);
      }
    } finally { bmp.close(); }
  }

  private async loadRef(spec: TechniqueSpec, file: File): Promise<void> {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const v = validateUpload(file.size, file.type, head);
    if (!v.ok) { this.say(`Rejected: ${v.reason}`); return; }
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const s = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const d = ctx.getImageData(0, 0, c.width, c.height);
    this.refUpload = { w: d.width, h: d.height, data: d.data };
    this.cards.get(spec.id)?.setParams({ ref: 'upload' });
    this.say('Reference image loaded (stays on your computer). Press Run.');
  }

  private resetImage(): void {
    if (!this.src) return;
    this.working = this.src.base;
    this.history = [];
    this.out = null;
    this.stage.setOriginal(this.src.base, `${this.src.title}, ${this.src.base.w}×${this.src.base.h}`);
    this.stage.setPipeline(this.src.title, []);
    this.steps.set(undefined);
    this.scope.update(this.src.base, null, null, null);
    this.say('Reset to the original image.');
  }

  // =========================================================== pipeline
  private stepLabel(spec: TechniqueSpec, params: Params): string {
    const shown = spec.params.filter((p) => !p.hidden && p.key !== 'seed').slice(0, 2).map((p) => `${p.key} ${String(params[p.key])}`);
    return `${spec.title}${shown.length ? ` (${shown.join(', ')})` : ''}`;
  }
  private chain(extra?: { spec: TechniqueSpec; params: Params }): void {
    const r = this.stage.getResult();
    const spec = extra?.spec ?? techniqueById(this.out ? this.lastSpecId : '');
    if (!r || !this.working || !spec) return;
    this.history.push({ label: this.stepLabel(spec, extra?.params ?? this.lastParams), before: this.working, id: spec.id });
    this.working = r;
    this.out = null;
    this.stage.setOriginal(r, `${this.src?.title ?? 'image'} after ${this.history.length} step(s), ${r.w}×${r.h}`);
    this.stage.setPipeline(this.src?.title ?? 'image', this.history.map((s) => ({ label: s.label })));
    this.steps.set(undefined);
    this.scope.update(r, null, null, null);
    this.say('The result is now the working image, so you can chain operations. Use ✕ on a step in the pipeline strip to undo it.');
  }
  private undo(i: number): void {
    const step = this.history[i];
    if (!step) return;
    this.working = step.before;
    this.history = this.history.slice(0, i);
    this.out = null;
    this.stage.setOriginal(step.before, `${this.src?.title ?? 'image'}${this.history.length ? ` after ${this.history.length} step(s)` : ''}, ${step.before.w}×${step.before.h}`);
    this.stage.setPipeline(this.src?.title ?? 'image', this.history.map((s) => ({ label: s.label })));
    this.steps.set(undefined);
    this.scope.update(step.before, null, null, null);
    this.say('Step undone.');
  }
  private pin(): void {
    const r = this.stage.getResult();
    if (!r) return;
    this.stage.setPinned(r, `${this.lastSpecId} ${this.lastParams ? '' : ''}result`);
    this.say('Pinned. Run something else, then open the Side by side or Diff view to compare against the pinned result.');
  }

  // =========================================================== running
  private lastSpecId = '';
  private lastParams: Params = {};

  private reference(): Pixels | undefined {
    if (!this.src || !this.working) return undefined;
    const bundledPhoto = !!this.src.id && !!imageById(this.src.id);
    return bundledPhoto && this.src.base.w === this.working.w && this.src.base.h === this.working.h ? this.src.base : undefined;
  }

  private meta(): ImageMeta {
    const s = this.src!, w = this.working!;
    return { source: this.history.length ? 'chained' : s.id ? `sample:${s.id}` : 'upload', origW: s.origW, origH: s.origH, w: w.w, h: w.h, resized: s.resized, limit: MAX_SIDE };
  }

  private async refPixelsFor(spec: TechniqueSpec, params: Params) {
    if (!spec.needsRef) return undefined;
    const ref = String(params.ref);
    if (ref === 'upload') {
      if (!this.refUpload) throw new Error('Upload a reference image first, or choose a bundled one.');
      return this.refUpload;
    }
    return loadSamplePixels(ref);
  }

  private async run(spec: TechniqueSpec, params: Params, opts: { quiet?: boolean } = {}): Promise<boolean> {
    if (!this.cv || !this.working || !this.src) return false;
    if (this.busy) return false;
    const card = this.cards.get(spec.id);
    if (spec.needs === 'color' && isGrayPixels(this.working)) {
      card?.setColourNeeded(true);
      this.exact.error('This concept needs a colour image. Choose a colour example from the shelf.');
      return false;
    }
    card?.setColourNeeded(false);
    this.busy = true;
    const heavy = !!spec.heavy && (spec.id !== 'S04' || Number(params.d) > 9 || this.working.w * this.working.h > 512 * 512) && HeavyRunner.available();
    card?.setBusy(true, heavy);
    this.stage.setBusy(true, `Running ${spec.id}…`, heavy);
    await nextFrame();
    try {
      const req: RunRequest = { id: spec.id, params, working: this.working, meta: this.meta(), imageId: this.src.id ?? undefined, reference: this.reference(), refPixels: await this.refPixelsFor(spec, params), pipeline: this.history.map((s) => s.id) };
      const out = heavy ? await this.heavy.run(structuredClone(req), new URL(`${import.meta.env.BASE_URL}opencv/opencv.js`, location.href).href) : executeRun(this.cv, req);
      this.showResult(spec, params, out);
      this.lastSpecId = spec.id;
      this.lastParams = params;
      return true;
    } catch (e) {
      const m = (e as Error)?.message ?? String(e);
      if (m === 'Cancelled') this.exact.setStatus('Cancelled.');
      else {
        if (/colour image/.test(m)) card?.setColourNeeded(true);
        this.exact.error(`${spec.id} failed (${m}). Try other parameters or a smaller image.`);
      }
      return false;
    } finally {
      this.busy = false;
      card?.setBusy(false);
      this.stage.setBusy(false);
      void opts;
    }
  }

  private showResult(spec: TechniqueSpec, params: Params, out: RunOutput): void {
    this.out = out;
    this.stage.setResult(out.pixels, `${spec.id} ${spec.title}, ${out.pixels.w}×${out.pixels.h}`, out.overlay, out.summary);
    this.scope.update(this.working, out.pixels, out, this.currentD0());
    this.exact.set(`${spec.id} ${spec.title}`, out.exact, [...out.adapt, ...out.warnings], out.ms);
    this.steps.set(out.intermediates);
    this.dirty = true;
    this.lastSpecId = spec.id;
    this.lastParams = params;
    this.evaluateChallenge(spec, out);
    this.refreshKernel();
    this.refreshSE();
    this.shelf.setActive(this.src?.id ?? null, this.mine);
  }

  /** Cheap low-resolution run for live preview (light point operations). */
  private preview(spec: TechniqueSpec, params: Params): void {
    if (!this.cv || !this.working || this.busy) return;
    const small = downscaleTo(this.working, 384);
    try {
      const out = executeRun(this.cv, { id: spec.id, params, working: small, meta: { ...this.meta(), w: small.w, h: small.h }, pipeline: [] });
      this.stage.setResult(out.pixels, `${spec.id} live preview (reduced size)`, undefined, '');
      this.scope.update(this.working, out.pixels, out, null);
      this.exact.set(`${spec.id} ${spec.title} (preview)`, out.exact, out.warnings, out.ms);
    } catch { /* the full run on release reports errors */ }
  }

  private async runHero(spec: TechniqueSpec, preset?: { sample?: string; params: Params }): Promise<boolean> {
    if (!this.cv) return false;
    if (this.busy) return false;
    const card = this.cards.get(spec.id)!;
    const image = preset?.sample ?? spec.heroImage;
    await this.pickSample(image, false);
    this.mine = false;
    const params = { ...heroParamsOf(spec), ...(preset?.params ?? {}) };
    card.setParams(params);
    this.setActiveNoLoad(spec.id);
    // Chain the hero pipeline (e.g. add noise first), exactly as a learner would.
    for (const step of preset ? [] : (spec.heroPipeline ?? [])) {
      const s = techniqueById(step.id)!;
      const p = { ...defaultParams(s), ...step.params };
      const ok = await this.run(s, p);
      if (!ok) return false;
      this.chain({ spec: s, params: p });
    }
    const ok = await this.run(spec, params);
    if (ok) {
      this.earn(spec.id, 'demo');
      this.say(`${spec.id}: ${spec.question} Drag the divider, and hover the image to read the pixels.`);
    }
    return ok;
  }

  private setActiveNoLoad(id: string): void {
    for (const [cid, c] of this.cards) c.setActive(cid === id);
    this.activeId = id;
    this.scope.setPreferred(techniqueById(id) ?? null);
    this.shelf.setConcept(techniqueById(id) ?? null);
  }

  private async runMine(spec: TechniqueSpec, params: Params): Promise<void> {
    if (!this.upload) {
      this.pendingMine = { spec, params };
      this.say('Choose an image to use. The concept will run on it as soon as it loads.');
      this.root.querySelector<HTMLInputElement>('#stage-file')?.click();
      return;
    }
    this.mine = true;
    if (this.src !== this.upload) this.setSource(this.upload);
    this.setActiveNoLoad(spec.id);
    await this.run(spec, params);
  }

  private cancel(): void {
    this.heavy.cancel();
    this.busy = false;
    this.stage.setBusy(false);
    for (const c of this.cards.values()) c.setBusy(false);
    this.exact.setStatus('Cancelled.');
  }

  // =========================================================== challenges
  private setChallenge(spec: TechniqueSpec | null, view?: Parameters<ChallengeBadge['set']>[0]): void {
    for (const c of this.cards.values()) if (c.challenge && view && spec && c.spec.id === spec.id) c.challenge.set(view);
  }
  private evaluateChallenge(spec: TechniqueSpec, out: RunOutput): void {
    const ch = spec.challenge;
    if (!ch) return;
    const card = this.cards.get(spec.id);
    if (this.src?.id !== ch.imageId) { card?.challenge?.set({ kind: 'unavailable', prompt: ch.prompt, why: `This challenge runs on the bundled "${ch.imageId}" image only, because it needs a known reference.` }); return; }
    const missing = (ch.requires ?? []).filter((r) => !this.history.some((h2) => h2.id === r));
    if (missing.length) { card?.challenge?.set({ kind: 'unavailable', prompt: ch.prompt, why: `Add the step ${missing.join(', ')} first (use "Use result as input"), then run this concept.` }); return; }
    const m = out.metrics ?? {};
    const value = m[ch.key];
    if (value === undefined) { card?.challenge?.set({ kind: 'unavailable', prompt: ch.prompt, why: 'No measurement for this run.' }); return; }
    const passed = ch.check(m);
    this.progress.recordChallenge(spec.id, passed, value);
    card?.challenge?.set({ kind: 'result', prompt: ch.prompt, passed, value, metric: ch.metric });
  }

  // =========================================================== stage interactions
  private pickRect(spec: TechniqueSpec, on: boolean): void {
    const p = this.cards.get(spec.id)!.getParams();
    this.stage.setPickRect(on, { x: Number(p.tx), y: Number(p.ty), w: Number(p.tw), h: Number(p.th) });
  }
  private onRect(r: { x: number; y: number; w: number; h: number }): void {
    const spec = techniqueById(this.activeId ?? '');
    if (!spec?.pickRect) return;
    this.cards.get(spec.id)!.setParams({ tx: r.x, ty: r.y, tw: Math.min(200, r.w), th: Math.min(200, r.h) });
    void this.run(spec, this.cards.get(spec.id)!.getParams());
  }
  private cornersOf(spec: TechniqueSpec, p: Params): [number, number][] {
    void spec;
    return [0, 1, 2, 3].map((i) => [Number(p[`x${i}`]), Number(p[`y${i}`])] as [number, number]);
  }
  private onCorners(c: [number, number][]): void {
    const spec = techniqueById(this.activeId ?? '');
    if (!spec?.pickCorners) return;
    const p: Params = {};
    c.forEach(([x, y], i) => { p[`x${i}`] = x; p[`y${i}`] = y; });
    this.cards.get(spec.id)!.setParams(p);
    void this.run(spec, this.cards.get(spec.id)!.getParams());
  }
  private currentD0(): number | null {
    const spec = techniqueById(this.activeId ?? '');
    if (!spec?.params.some((p) => p.key === 'd0')) return null;
    return Number(this.cards.get(spec.id)?.getParams().d0);
  }
  private onCutoff(d0: number): void {
    const spec = techniqueById(this.activeId ?? '');
    if (!spec || !spec.params.some((p) => p.key === 'd0')) return;
    this.cards.get(spec.id)!.setParams({ d0 });
    void this.run(spec, this.cards.get(spec.id)!.getParams());
  }
  private onParams(spec: TechniqueSpec, params: Params): void {
    if (spec.id !== this.activeId) return;
    if (spec.pickRect) this.stage.setPickRect(this.stage.getView() === 'overlay' && false, { x: Number(params.tx), y: Number(params.ty), w: Number(params.tw), h: Number(params.th) });
    clearTimeout(this.timers.get('k'));
    this.timers.set('k', window.setTimeout(() => { this.refreshKernel(); this.refreshSE(); }, 120));
  }
  private refreshKernel(): void {
    const spec = techniqueById(this.activeId ?? '');
    const card = spec ? this.cards.get(spec.id) : null;
    if (!spec || !card || spec.explainer !== 'kernel') return;
    let kg = this.kernels.get(spec.id);
    if (!kg) { kg = new KernelGrid(); this.kernels.set(spec.id, kg); card.explainerSlot.appendChild(kg.el); }
    kg.update(spec.id, card.getParams(), (r) => this.stage.inspector.neighbourhood(r), this.stage.inspector.resultValue());
  }
  private refreshSE(): void {
    const spec = techniqueById(this.activeId ?? '');
    const card = spec ? this.cards.get(spec.id) : null;
    if (!spec || !card || spec.explainer !== 'structuring' || !this.working) return;
    if (!card.explainerSlot.contains(this.se.el)) card.explainerSlot.appendChild(this.se.el);
    const pos = this.stage.inspector.pos;
    this.se.update(card.getParams(), this.working, pos.x || Math.floor(this.working.w / 2), pos.y || Math.floor(this.working.h / 2));
  }

  // =========================================================== export / import
  private exportPng(): void {
    const r = this.stage.getResult();
    if (!r) return;
    const c = document.createElement('canvas');
    c.width = r.w; c.height = r.h;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
    c.toBlob((b) => { if (b) { download(b, 'dip-lab-result.png'); this.dirty = false; this.say('Result PNG saved to your downloads. It was created locally.'); } }, 'image/png');
  }
  private exportCfg(spec: TechniqueSpec, params: Params): void {
    const sample = this.src?.id && ALL_SAMPLE_IDS.includes(this.src.id) ? this.src.id : undefined;
    download(new Blob([JSON.stringify(exportConfig(spec.id, params, sample), null, 2)], { type: 'application/json' }), `dip-lab-${spec.id}.json`);
    this.say(`Config for ${spec.id} saved. It contains parameters only, never image data.`);
  }
  async importConfigText(text: string): Promise<void> {
    const r = importConfig(text, TECHNIQUES, ALL_SAMPLE_IDS);
    if (!r.ok) { this.say(`Could not import: ${r.reason}`); return; }
    this.activate(r.technique, true);
    if (r.sample) await this.pickSample(r.sample, false);
    this.cards.get(r.technique)?.setParams(r.params);
    this.say(`Imported ${r.technique} parameters${r.sample ? ` and loaded "${r.sample}"` : ''}. Press Run.`);
  }
}
