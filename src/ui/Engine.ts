import type { CapabilityMap } from '../core/capability';
import { h } from './dom';

export function EngineStatus(caps: CapabilityMap, version: string, ms: number): HTMLElement {
  const missing = Object.entries(caps).filter(([, ok]) => !ok).map(([k]) => k);
  return h(
    'div',
    {},
    h('p', {}, `Engine: OpenCV.js ${version} loaded in ${(ms / 1000).toFixed(1)} s · ${missing.length ? `${missing.length} API(s) unavailable: ${missing.join(', ')}` : 'all required APIs available'}. SIFT is never assumed; the default build does not include it.`),
    h('p', { class: 'hint' }, 'cv.idft is not exported by this build, so inverse transforms use cv.dft with the DFT_INVERSE flag.'),
  );
}
