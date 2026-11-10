import type { CapabilityMap } from '../core/capability';
import { h } from './dom';

/** Content for the "Beyond this build" segment: honest scope notes + live probe of unsupported APIs. */
export function Beyond(sift: boolean | null): HTMLElement {
  const siftText = sift === null ? 'checking…' : sift ? 'present in this build' : 'not available in this build (expected)';
  return h(
    'div',
    { class: 'beyond' },
    h('article', { class: 'card' }, h('h3', {}, 'Frequency domain (Phase 2)'), h('p', {}, 'DFT magnitude, ideal/Gaussian low- and high-pass filters, and the ringing-versus-smooth-cutoff lesson are planned after this MVP is polished. They need float32 FFT buffers and are heavier in the browser.'), h('p', { class: 'callout', role: 'note' }, 'Misconception to look forward to: an ideal cutoff looks like the "cleanest" filter, but its sharp edge in frequency rings in space; a Gaussian mask is smoother.')),
    h('article', { class: 'card' }, h('h3', {}, 'Features (stretch)'), h('p', {}, 'Template matching, Harris corners, contours and Hough transforms are stretch goals. Until they land, use the Python labs from your course.')),
    h('article', { class: 'card' }, h('h3', {}, 'Deliberately not in the browser'), h('ul', {}, h('li', {}, `SIFT: cv.SIFT is ${siftText}. The default OpenCV.js build omits xfeatures2d/SIFT, so this lab never assumes it.`), h('li', {}, 'HOG, active contours (snakes), neural networks / YOLO, and Wiener / full deconvolution: out of scope for a lightweight WASM page.'), h('li', {}, 'Geometric transforms and compression appear in the syllabus but are not covered here yet.'))),
  );
}

export function EngineStatus(caps: CapabilityMap, version: string, ms: number): HTMLElement {
  const missing = Object.entries(caps).filter(([, ok]) => !ok).map(([k]) => k);
  return h(
    'details',
    { class: 'engine' },
    h('summary', {}, `Engine: OpenCV.js ${version} loaded in ${(ms / 1000).toFixed(1)} s · ${missing.length ? `${missing.length} API(s) unavailable` : 'all required APIs available'}`),
    h('ul', { class: 'caps' }, ...Object.entries(caps).map(([k, ok]) => h('li', {}, `${ok ? '✓' : '✗ unavailable:'} cv.${k}`))),
  );
}
