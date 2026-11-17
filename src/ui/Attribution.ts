import { IMAGES } from '../core/sampleRegistry';
import { OPENCV_VERSION } from '../core/opencvLoader';
import { APP_VERSION } from '../core/types';
import { h } from './dom';

export function Attribution(onReset: () => void): HTMLElement {
  return h(
    'section',
    { class: 'panel attribution', id: 'attribution', 'aria-labelledby': 'attr-h' },
    h('h2', { id: 'attr-h' }, 'Attribution, privacy and licenses'),
    h('h3', {}, 'Privacy'),
    h('ul', {},
      h('li', {}, 'Images never leave your browser tab. There is no server-side processing, no account, no analytics SDK, no remote fonts and no fingerprinting. The app makes no network requests at run time other than loading its own static files.'),
      h('li', {}, 'Exported config JSON holds only a concept id, parameter values, an app version and optionally the id of a bundled image. It never contains pixels.'),
      h('li', {}, 'Stamps and challenge results are stored only in this browser (localStorage), under one key. ', h('button', { type: 'button', class: 'link', onclick: onReset }, 'Reset my progress'), '.'),
    ),
    h('h3', {}, 'Software and fonts'),
    h('ul', {},
      h('li', {}, `OpenCV.js ${OPENCV_VERSION} (OpenCV, Apache-2.0), packaged via @techstark/opencv-js (Apache-2.0), vendored and version-pinned. The core image-processing functions are OpenCV’s.`),
      h('li', {}, `DIP Lab v${APP_VERSION} application code: MIT (see LICENSE and THIRD_PARTY_NOTICES.md).`),
      h('li', {}, 'Fonts, bundled with the app via Fontsource and licensed under the SIL Open Font License 1.1: Baloo 2 (Ek Type), Nunito (Vernon Adams, Cyreal et al.), JetBrains Mono (JetBrains).'),
    ),
    h('h3', {}, `Bundled images (${IMAGES.length})`),
    h('p', { class: 'hint' }, 'Redistributable images only. None come from course materials. Three further generated test patterns (ramp, checkerboard, noisy step edge) are drawn by code and are CC0.'),
    h('div', { style: undefined },
      h('table', { class: 'attr-table' },
        h('thead', {}, h('tr', {}, ...['Image', 'Credit', 'Licence', 'Origin'].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, ...IMAGES.map((i) => h('tr', {}, h('td', {}, i.id), h('td', {}, i.credit), h('td', {}, i.licence), h('td', {}, i.origin)))))),
    h('h3', {}, 'Course and text'),
    h('p', {}, 'Topic coverage follows a university introductory digital image processing course, used only as inspiration. No course slides, notebooks, code or images are included; all explanations and all Python code cells are original. Recommended textbook for the theory: Rafael C. Gonzalez and Richard E. Woods, Digital Image Processing, 4th edition (not reproduced here).'),
    h('p', { class: 'hint' }, 'Unofficial, student-made learning aid. Not a graded submission, not official University of Houston software, and no claim of instructor endorsement.'),
  );
}
