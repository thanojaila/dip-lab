import type { Cv } from './types';

/**
 * Resolve whatever the OpenCV.js UMD build exposes (a ready module, a thenable,
 * or a module waiting on onRuntimeInitialized) into a ready `cv`.
 * Exported separately so it can be tested under node.
 */
export async function resolveCv(raw: unknown): Promise<Cv> {
  let c = raw as Record<string, unknown> & { then?: unknown; onRuntimeInitialized?: () => void };
  if (typeof c === 'function') c = await (c as unknown as () => Promise<typeof c>)();
  if (c && typeof c.then === 'function') {
    // The emscripten module is itself thenable; resolving it directly would loop.
    c = await new Promise((resolve, reject) => {
      (c.then as (ok: (m: typeof c) => void, err: (e: unknown) => void) => void)(
        (m) => {
          delete m.then;
          resolve(m);
        },
        reject,
      );
    });
  }
  if (!c.Mat) {
    await new Promise<void>((resolve) => {
      c.onRuntimeInitialized = () => resolve();
    });
  }
  return c as unknown as Cv;
}

let pending: Promise<Cv> | null = null;

/** Load the vendored, version-pinned OpenCV.js (see public/opencv + docs/MAINTENANCE.md). */
export function loadOpenCv(url = `${import.meta.env.BASE_URL}opencv/opencv.js`): Promise<Cv> {
  if (pending) return pending;
  pending = new Promise<Cv>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => {
      resolveCv((window as unknown as { cv: unknown }).cv).then(resolve, reject);
    };
    s.onerror = () => {
      pending = null;
      reject(new Error('Could not load OpenCV.js. Check that opencv/opencv.js is served next to the page.'));
    };
    document.head.appendChild(s);
  });
  return pending;
}

export const OPENCV_VERSION = '4.10.0';
