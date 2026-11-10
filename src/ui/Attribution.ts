import { OPENCV_VERSION } from '../core/opencvLoader';
import { APP_VERSION } from '../core/types';
import { h } from './dom';

export function Attribution(): HTMLElement {
  return h(
    'section',
    { class: 'panel attribution', id: 'attribution', 'aria-labelledby': 'attr-h' },
    h('h2', { id: 'attr-h' }, 'Attribution, privacy and licenses'),
    h('h3', {}, 'Privacy'),
    h('ul', {}, 
      h('li', {}, 'Images never leave your browser tab. There is no server-side processing, no account, no analytics SDK and no fingerprinting.'),
      h('li', {}, 'Exported config JSON holds only a technique id, parameter values, an app version and optionally the id of a built-in sample. It never contains pixels.'),
      h('li', {}, 'Your uploaded image is not stored. Only a per-browser "which segments I finished" list may be kept in local storage.'),
    ),
    h('h3', {}, 'Software and content'),
    h('ul', {}, 
      h('li', {}, `OpenCV.js ${OPENCV_VERSION} (OpenCV, Apache-2.0), packaged via @techstark/opencv-js (Apache-2.0), vendored and version-pinned in this app. Core image-processing functions are OpenCV’s.`),
      h('li', {}, 'This app’s own code is MIT-licensed (v' + APP_VERSION + '). See LICENSE and THIRD_PARTY_NOTICES.md.'),
      h('li', {}, 'Fonts: none loaded; the page uses your system font stack.'),
      h('li', {}, 'Sample images are generated procedurally in your browser from seeded code, so there are no third-party photos or licenses involved (CC0 / public domain).'),
      h('li', {}, 'Topic coverage follows a university introductory digital image processing course, used only as inspiration. No course slides, notebooks or images are included, and all explanations here are original wording.'),
      h('li', {}, 'Recommended textbook for the underlying theory: Rafael C. Gonzalez and Richard E. Woods, Digital Image Processing, 4th edition (not reproduced here).'),
    ),
    h('p', { class: 'hint' }, 'This is an unofficial, student-made learning aid. It is not a graded submission, is not official University of Houston software, and makes no claim of instructor endorsement.'),
  );
}
