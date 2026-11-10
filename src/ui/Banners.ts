import { h } from './dom';

/** Persistent privacy + unofficial banners (FR-18). Intentionally not dismissible. */
export function Banners(): HTMLElement {
  return h(
    'div',
    { class: 'banners', role: 'region', 'aria-label': 'Privacy and status notices' },
    h('p', { class: 'banner banner-privacy' }, h('strong', {}, 'Private by design: '), 'every image is processed locally in this browser tab. Nothing is uploaded, and there are no accounts, analytics or trackers.'),
    h('p', { class: 'banner banner-unofficial' }, h('strong', {}, 'Unofficial learning aid: '), 'student-made study resource. It is not a graded course project or Canvas submission, and it is not official University of Houston software.'),
  );
}
