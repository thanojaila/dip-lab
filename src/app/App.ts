import { missingApis, probe, type CapabilityMap } from '../core/capability';
import { exportConfig, importConfig } from '../core/config';
import { loadOpenCv, OPENCV_VERSION } from '../core/opencvLoader';
import { matToPixels, pixelsToMat, prepareInput, withMats, type Pixels } from '../core/matIO';
import { MAX_SIDE, planResize, validateUpload } from '../core/resizePolicy';
import { TEST_PATTERNS as SAMPLES, TP_IDS as SAMPLE_IDS, patternById as sampleById } from '../core/testPatterns';
import { APP_VERSION, type Cv, type ImageMeta, type Params, type SegmentSpec, type TechniqueSpec } from '../core/types';
import { fillTemplate } from '../exact/templates';
import { SEGMENTS, TECHNIQUES, defaultParams, techniquesIn } from '../registry';
import { Attribution } from '../ui/Attribution';
import { Banners } from '../ui/Banners';
import { Beyond, EngineStatus } from '../ui/Beyond';
import { clear, h, nextId, prefersReducedMotion } from '../ui/dom';
import { ExactPanel } from '../ui/ExactPanel';
import { HistogramPanel } from '../ui/Histogram';
import { InstructorPanel, InstructorSegmentNotes } from '../ui/InstructorPanel';
import { Stage } from '../ui/Stage';
import { TechniqueCard } from '../ui/TechniqueCard';
import { Toc } from '../ui/Toc';

const PROGRESS_KEY = 'diplab.progress.v1';

function loadProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string' && SEGMENTS.some((s) => s.id === x)) : []);
  } catch {
    return new Set();
  }
}
function saveProgress(p: Set<string>): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...p]));
  } catch {
    /* storage unavailable: progress simply is not remembered */
  }
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // NFR-04: do not leak object URLs
}

export class App {
  private cv: Cv | null = null;
  private caps: CapabilityMap = {};
  private base: Pixels | null = null;
  private working: Pixels | null = null;
  private inputView: Pixels | null = null;
  private meta: ImageMeta | null = null;
  private gray = true;
  private busy = false;
  private dirty = false;
  private progress = loadProgress();
  private cards = new Map<string, TechniqueCard>();
  private segEls = new Map<string, HTMLElement>();
  private currentSeg: string | null = SEGMENTS[0].id;
  private instructorOn = false;

  private exact = new ExactPanel();
  private hist = new HistogramPanel();
  private stage: Stage;
  private toc: Toc;
  private message = h('p', { class: 'status', role: 'status', 'aria-live': 'polite' });
  private engine = h('div', { class: 'engine-slot' }, h('p', { class: 'status' }, `Loading OpenCV.js ${OPENCV_VERSION} (about 10 MB; cached by your browser after the first visit)…`));
  private metaLine = h('p', { class: 'meta-line' });
  private sampleSelect = h('select', { id: 'sample-select' });
  private instructorBtn: HTMLButtonElement;
  private instructorPanel = InstructorPanel();
  private beyondSlot = h('div', {});

  constructor(private root: HTMLElement) {
    this.stage = new Stage({
      onPin: () => this.pin(),
      onUseAsInput: () => this.useResultAsInput(),
      onExportPng: () => this.exportPng(),
      onResetImage: () => this.resetImage(),
    });
    this.toc = new Toc(SEGMENTS, { onNext: () => this.nextConcept(), onGuidedChange: () => this.refreshProgress() });
    this.instructorBtn = h('button', { type: 'button', class: 'btn secondary', 'aria-pressed': 'false', onclick: () => this.toggleInstructor() }, 'Instructor mode');
    window.addEventListener('beforeunload', (e) => {
      if (this.dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  async start(): Promise<void> {
    this.build();
    this.loadSample('tp-low-contrast', false);
    const t0 = performance.now();
    try {
      this.cv = await loadOpenCv();
      this.caps = probe(this.cv as unknown as Record<string, unknown>);
      this.rebuildBeyond();
      clear(this.engine);
      this.engine.appendChild(EngineStatus(this.caps, OPENCV_VERSION, performance.now() - t0));
      this.rebuildCardsAvailability();
      this.recomputeInputView();
      this.setReady(true);
      this.say('Engine ready. Pick a technique and press Run.');
    } catch (e) {
      clear(this.engine);
      this.engine.appendChild(h('p', { class: 'error', role: 'alert' }, `OpenCV.js failed to load: ${(e as Error).message} Techniques are disabled; the page cannot process images without it.`));
    }
  }

  // ---------- layout ----------
  private build(): void {
    const header = h(
      'header',
      { class: 'site-header' },
      h('div', { class: 'title-row' }, h('h1', {}, 'DIP Lab'), h('p', { class: 'subtitle' }, 'Interactive digital image processing, in your browser'), this.instructorBtn),
      Banners(),
      this.engine,
    );

    const imagePanel = this.buildSourcePanel();
    const segments = SEGMENTS.map((s) => this.buildSegment(s));
    const left = h('div', { class: 'col-left' }, this.buildIntro(), imagePanel, this.instructorPanel, ...segments, Attribution());
    const right = h('aside', { class: 'col-right', 'aria-label': 'Results' }, this.stage.el, this.exact.el, this.hist.el);

    this.root.append(
      h('a', { class: 'skip', href: '#main' }, 'Skip to the lab'),
      header,
      this.toc.el,
      h('main', { id: 'main', class: 'layout' }, left, right),
      h('footer', { class: 'site-footer' }, h('p', {}, `DIP Lab v${APP_VERSION} · MIT licensed · `, h('a', { href: '#attribution' }, 'Attribution and privacy'))),
    );
    this.observeSegments();
    this.refreshProgress();
    this.setReady(false);
  }

  private buildIntro(): HTMLElement {
    return h(
      'section',
      { class: 'panel intro', 'aria-labelledby': 'intro-h' },
      h('h2', { id: 'intro-h' }, 'How to use this lab'),
      h('ol', {}, h('li', {}, 'Pick a built-in sample or upload your own image (it stays on your computer).'), h('li', {}, 'Work through the segments in order, or turn off "Guided path" to browse freely.'), h('li', {}, 'Set parameters and press Run (or Ctrl/Cmd + Enter inside a card).'), h('li', {}, 'Compare Original, Result and Diff, then read the Exact transform panel to see precisely what ran.'), h('li', {}, 'Try the "Predict, then check" boxes: commit to a guess before you run.')),
    );
  }

  private buildSourcePanel(): HTMLElement {
    for (const s of SAMPLES) this.sampleSelect.appendChild(h('option', { value: s.id }, s.title));
    (this.sampleSelect as HTMLSelectElement).value = 'tp-low-contrast';
    this.sampleSelect.addEventListener('change', () => this.loadSample((this.sampleSelect as HTMLSelectElement).value));
    const fileId = nextId('file');
    const cfgId = nextId('cfg');
    const grayId = nextId('gray');
    const grayBox = h('input', { type: 'checkbox', id: grayId, checked: true });
    grayBox.addEventListener('change', () => {
      this.gray = (grayBox as HTMLInputElement).checked;
      this.recomputeInputView();
      this.say(`Now working in ${this.gray ? 'grayscale' : 'RGB'}. Run a technique again to see its effect.`);
    });
    const file = h('input', { type: 'file', id: fileId, accept: 'image/png,image/jpeg,image/webp' });
    file.addEventListener('change', () => {
      const f = (file as HTMLInputElement).files?.[0];
      if (f) void this.loadUpload(f);
      (file as HTMLInputElement).value = '';
    });
    const cfg = h('input', { type: 'file', id: cfgId, accept: 'application/json,.json' });
    cfg.addEventListener('change', () => {
      const f = (cfg as HTMLInputElement).files?.[0];
      if (f) void this.importConfigFile(f);
      (cfg as HTMLInputElement).value = '';
    });
    const blurb = h('p', { class: 'hint', id: 'sample-blurb' });
    this.sampleSelect.addEventListener('change', () => {
      blurb.textContent = 'Teaches ' + (sampleById((this.sampleSelect as HTMLSelectElement).value)?.teaches ?? '');
    });
    blurb.textContent = 'Teaches ' + (sampleById('tp-low-contrast')?.teaches ?? '');
    this.sampleSelect.setAttribute('aria-describedby', 'sample-blurb');
    return h(
      'section',
      { class: 'panel source', id: 'source', 'aria-labelledby': 'source-h' },
      h('h2', { id: 'source-h' }, 'Image'),
      h('div', { class: 'param' }, h('label', { for: 'sample-select' }, 'Built-in synthetic sample'), this.sampleSelect, blurb),
      h('div', { class: 'param' }, h('label', { for: fileId }, 'Or upload an image (PNG, JPEG or WebP, up to 8 MB; longest side is reduced to ' + MAX_SIDE + ' px)'), file),
      h('div', { class: 'param' }, h('label', { class: 'inline', for: grayId }, grayBox, ' Work in grayscale (recommended)')),
      h('div', { class: 'param' }, h('label', { for: cfgId }, 'Import a shared technique config (.json, parameters only)'), cfg),
      this.metaLine,
      this.message,
    );
  }

  private buildSegment(seg: SegmentSpec): HTMLElement {
    const el = h('section', { class: 'segment', id: `seg-${seg.id}`, 'aria-labelledby': `seg-h-${seg.id}` });
    const status = h('span', { class: 'seg-status' });
    el.appendChild(h('header', { class: 'seg-head' }, h('p', { class: 'seg-num' }, `Segment ${seg.index}`), h('h2', { id: `seg-h-${seg.id}` }, seg.title, ' ', status), h('p', { class: 'tagline' }, seg.tagline)));
    const notes = InstructorSegmentNotes(seg.id);
    if (notes) el.appendChild(notes);
    if (seg.id === 'beyond') el.appendChild(this.beyondSlot);
    for (const t of techniquesIn(seg.id)) {
      const card = new TechniqueCard(t, {
        missingApis: [],
        sampleTitle: t.sampleHint ? sampleById(t.sampleHint)?.title : undefined,
        onRun: (spec, params) => void this.run(spec, params),
        onLoadSample: (id) => {
          (this.sampleSelect as HTMLSelectElement).value = id;
          this.loadSample(id);
        },
        onExportConfig: (spec, params) => this.exportCfg(spec, params),
        onSelfCheckRun: (spec) => this.runSelfCheck(spec),
        onSelfCheckRevealed: (spec) => this.onRevealed(spec),
      });
      this.cards.set(t.id, card);
      el.appendChild(card.el);
    }
    this.segEls.set(seg.id, el);
    return el;
  }

  private rebuildBeyond(): void {
    clear(this.beyondSlot);
    this.beyondSlot.appendChild(Beyond(this.cv ? typeof (this.cv as unknown as Record<string, unknown>).SIFT === 'function' : null));
  }

  private rebuildCardsAvailability(): void {
    // Replace each card with one that knows which APIs are missing (FR-14: never silent failure).
    for (const t of TECHNIQUES) {
      const missing = missingApis(t, this.caps);
      if (!missing.length) continue;
      const old = this.cards.get(t.id)!;
      const params = old.getParams();
      const card = new TechniqueCard(t, {
        missingApis: missing,
        sampleTitle: undefined,
        onRun: () => undefined,
        onLoadSample: () => undefined,
        onExportConfig: (spec, p) => this.exportCfg(spec, p),
        onSelfCheckRun: async () => false,
        onSelfCheckRevealed: () => undefined,
      });
      card.setParams(params);
      old.el.replaceWith(card.el);
      this.cards.set(t.id, card);
    }
  }

  private setReady(ready: boolean): void {
    for (const c of this.cards.values()) c.setReady(ready);
  }

  private say(msg: string): void {
    this.message.textContent = msg;
  }

  // ---------- image source ----------
  private setWorking(px: Pixels, meta: ImageMeta, resetBase: boolean): void {
    this.working = px;
    this.meta = meta;
    if (resetBase) this.base = px;
    this.stage.setPinned(null, '');
    this.recomputeInputView();
    this.exact.set('Ready', 'Run a technique to see exactly what was computed, with your numbers filled in.');
    this.hist.set(this.inputView, null);
    this.metaLine.textContent = `Working image: ${meta.w}×${meta.h} px (${meta.w * meta.h} pixels), ${meta.source.startsWith('sample:') ? 'synthetic sample' : meta.source === 'chained' ? 'previous result' : 'your upload'}.`;
  }

  private loadSample(id: string, announce = true): void {
    const s = sampleById(id);
    if (!s) return;
    const px = s.make();
    this.setWorking(px, { source: `sample:${id}`, origW: px.w, origH: px.h, w: px.w, h: px.h, resized: false, limit: MAX_SIDE }, true);
    (this.sampleSelect as HTMLSelectElement).value = id;
    if (announce) this.say(`Loaded sample "${s.title}". It teaches ${s.teaches}`);
  }

  private async loadUpload(file: File): Promise<void> {
    if (!this.cv) {
      this.say('Please wait for OpenCV.js to finish loading, then upload again.');
      return;
    }
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const v = validateUpload(file.size, file.type, head);
    if (!v.ok) {
      this.say(`Rejected: ${v.reason}`);
      return;
    }
    let bmp: ImageBitmap;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      this.say('Rejected: this file could not be decoded as an image.');
      return;
    }
    const cv = this.cv;
    try {
      if (bmp.width * bmp.height > 40_000_000) {
        this.say(`Rejected: ${bmp.width}×${bmp.height} is too many pixels to decode safely (limit 40 megapixels).`);
        return;
      }
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0);
      const full = ctx.getImageData(0, 0, c.width, c.height);
      const plan = planResize(bmp.width, bmp.height, MAX_SIDE);
      let px: Pixels = { w: full.width, h: full.height, data: full.data };
      if (plan.resized) {
        px = withMats((track) => {
          const src = track(pixelsToMat(cv, px));
          const dst = track(new cv.Mat());
          cv.resize(src, dst, new cv.Size(plan.w, plan.h), 0, 0, cv.INTER_AREA);
          return matToPixels(cv, dst);
        });
      }
      this.setWorking(px, { source: 'upload', origW: bmp.width, origH: bmp.height, w: px.w, h: px.h, resized: plan.resized, limit: MAX_SIDE }, true);
      this.say(plan.resized ? `Decoded ${bmp.width}×${bmp.height}; resized to ${px.w}×${px.h} (INTER_AREA) because the longest side is limited to ${MAX_SIDE} px.` : `Decoded ${bmp.width}×${bmp.height}; no resize needed.`);
    } finally {
      bmp.close();
    }
  }

  private recomputeInputView(): void {
    if (!this.working) return;
    if (!this.cv) {
      this.inputView = this.working;
    } else {
      const cv = this.cv;
      const w = this.working;
      this.inputView = withMats((track) => {
        const rgba = track(pixelsToMat(cv, w));
        const inp = track(prepareInput(cv, rgba, this.gray));
        return matToPixels(cv, inp);
      });
    }
    this.stage.setInput(this.inputView, `${this.gray ? 'gray' : 'RGB'} ${this.inputView.w}×${this.inputView.h}`);
    this.hist.set(this.inputView, null);
  }

  private resetImage(): void {
    if (!this.base) return;
    const m = this.meta;
    this.setWorking(this.base, { ...(m as ImageMeta), source: m?.source === 'chained' ? 'upload' : (m?.source ?? 'upload'), w: this.base.w, h: this.base.h }, false);
    this.say('Reset to the original image.');
  }

  // ---------- running ----------
  private async run(spec: TechniqueSpec, params: Params, quiet = false): Promise<boolean> {
    if (!this.cv || !this.working || !this.meta) return false;
    if (this.busy) return false;
    this.busy = true;
    const card = this.cards.get(spec.id);
    card?.setBusy(true);
    if (!quiet) this.exact.setStatus(`Running ${spec.id}…`);
    await nextFrame();
    const cv = this.cv;
    try {
      const t0 = performance.now();
      const meta = this.meta;
      const out = withMats((track) => {
        const rgba = track(pixelsToMat(cv, this.working!));
        const input = track(prepareInput(cv, rgba, this.gray));
        const res = spec.run({ cv, rgba, input, grayMode: this.gray, params, meta });
        track(res.mat);
        return { px: matToPixels(cv, res.mat), vars: res.vars, warnings: res.warnings ?? [], domain: input.channels() === 1 ? 'uint8 gray' : 'uint8 RGB' };
      });
      const ms = Math.round(performance.now() - t0);
      const vars = { domain: out.domain, ...out.vars };
      const exact = fillTemplate(spec.exactTemplate, vars, params);
      this.stage.setResult(out.px, `${spec.id} ${spec.title}, ${out.px.w}×${out.px.h}`);
      this.hist.set(this.inputView, out.px);
      this.exact.set(`${spec.id} ${spec.title}`, exact, out.warnings, ms);
      this.dirty = true;
      return true;
    } catch (e) {
      this.exact.error(`${spec.id} failed (${(e as Error)?.message ?? String(e)}). Try smaller parameters or a smaller image.`);
      return false;
    } finally {
      this.busy = false;
      card?.setBusy(false);
    }
  }

  private async runSelfCheck(spec: TechniqueSpec): Promise<boolean> {
    const sc = spec.selfCheck;
    if (!sc) return false;
    if (sc.preset.sample) this.loadSample(sc.preset.sample, false);
    const card = this.cards.get(spec.id);
    const params = { ...defaultParams(spec), ...sc.preset.params };
    card?.setParams(params);
    return this.run(spec, params);
  }

  private onRevealed(spec: TechniqueSpec): void {
    const seg = spec.segment;
    const all = techniquesIn(seg).filter((t) => t.selfCheck);
    if (all.every((t) => this.cards.get(t.id)?.selfCheck?.revealed)) {
      this.progress.add(seg);
      saveProgress(this.progress);
      this.refreshProgress();
      this.say(`Segment "${SEGMENTS.find((s) => s.id === seg)?.title}" completed. Use "Next concept" to continue.`);
    }
  }

  // ---------- stage actions ----------
  private pin(): void {
    const r = this.stage.getResult();
    if (!r) return;
    this.stage.setPinned(r, this.stageCaption());
    this.say('Pinned. Run another technique or preset, then choose "Pinned" in the Diff selector to compare them.');
  }

  private stageCaption(): string {
    const t = this.exact.el.querySelector('.exact-text')?.textContent ?? '';
    return t.split(' — ')[0] || 'result';
  }

  private useResultAsInput(): void {
    const r = this.stage.getResult();
    if (!r || !this.meta) return;
    this.setWorking(r, { ...this.meta, w: r.w, h: r.h, source: 'chained' }, false);
    this.say('The result is now the working image, so you can chain operations (for example noise, then median). Use "Reset to original image" to start over.');
  }

  private exportPng(): void {
    const r = this.stage.getResult();
    if (!r) return;
    const c = document.createElement('canvas');
    c.width = r.w;
    c.height = r.h;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
    c.toBlob((b) => {
      if (b) {
        download(b, 'dip-lab-result.png');
        this.dirty = false;
        this.say('Result PNG saved to your downloads. It was created locally.');
      }
    }, 'image/png');
  }

  private exportCfg(spec: TechniqueSpec, params: Params): void {
    const sample = this.meta?.source.startsWith('sample:') ? this.meta.source.slice(7) : undefined;
    const text = JSON.stringify(exportConfig(spec.id, params, sample), null, 2);
    download(new Blob([text], { type: 'application/json' }), `dip-lab-${spec.id}.json`);
    this.say(`Config for ${spec.id} saved. It contains parameters only, never image data.`);
  }

  private async importConfigFile(f: File): Promise<void> {
    if (f.size > 64 * 1024) {
      this.say('Rejected: config files are tiny; this one is over 64 KB.');
      return;
    }
    const r = importConfig(await f.text(), TECHNIQUES, SAMPLE_IDS);
    if (!r.ok) {
      this.say(`Could not import: ${r.reason}`);
      return;
    }
    if (r.sample) this.loadSample(r.sample, false);
    const card = this.cards.get(r.technique);
    card?.setParams(r.params);
    document.getElementById(`tech-${r.technique}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    card?.focusRun();
    this.say(`Imported ${r.technique} parameters${r.sample ? ` and loaded sample "${r.sample}"` : ''}. Press Run.`);
  }

  // ---------- guided path ----------
  private refreshProgress(): void {
    const guided = this.toc.isGuided();
    this.toc.render(this.progress, this.currentSeg);
    const firstOpen = SEGMENTS.filter((s) => s.id !== 'beyond').find((s) => !this.progress.has(s.id));
    for (const s of SEGMENTS) {
      const el = this.segEls.get(s.id);
      if (!el) continue;
      const done = this.progress.has(s.id);
      el.classList.toggle('is-next', guided && firstOpen?.id === s.id);
      el.classList.toggle('is-done', done);
      const st = el.querySelector('.seg-status');
      if (st) st.textContent = done ? '✓ done' : guided && firstOpen?.id === s.id ? 'Up next' : '';
    }
  }

  private nextConcept(): void {
    const i = SEGMENTS.findIndex((s) => s.id === this.currentSeg);
    const next = SEGMENTS[Math.min(SEGMENTS.length - 1, i + 1)];
    const el = this.segEls.get(next.id);
    el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    el?.querySelector<HTMLElement>('h2')?.focus?.();
  }

  private observeSegments(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) {
          this.currentSeg = vis.target.id.replace('seg-', '');
          this.toc.render(this.progress, this.currentSeg);
        }
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    for (const el of this.segEls.values()) io.observe(el);
  }

  private toggleInstructor(): void {
    this.instructorOn = !this.instructorOn;
    this.instructorBtn.setAttribute('aria-pressed', String(this.instructorOn));
    this.instructorPanel.classList.toggle('hidden', !this.instructorOn);
    for (const n of this.root.querySelectorAll('[data-instructor]')) n.classList.toggle('hidden', !this.instructorOn);
    if (this.instructorOn) this.instructorPanel.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }
}
