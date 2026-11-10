/// <reference lib="webworker" />
import { resolveCv } from '../core/opencvLoader';
import { executeRun, type RunRequest } from '../core/runTechnique';
import type { Cv } from '../core/types';

/** Classic worker: loads its own copy of OpenCV.js, then runs techniques off the main thread. */
let cvPromise: Promise<Cv> | null = null;
const scope = self as unknown as DedicatedWorkerGlobalScope & { importScripts(...u: string[]): void; cv: unknown };

interface Msg { type: 'run'; seq: number; req: RunRequest; opencvUrl: string }

scope.onmessage = async (e: MessageEvent<Msg>) => {
  const { seq, req, opencvUrl } = e.data;
  try {
    if (!cvPromise) {
      scope.importScripts(opencvUrl);
      cvPromise = resolveCv(scope.cv);
    }
    const cv = await cvPromise;
    const out = executeRun(cv, req);
    const transfer: Transferable[] = [out.pixels.data.buffer];
    scope.postMessage({ seq, ok: true, out }, transfer);
  } catch (err) {
    scope.postMessage({ seq, ok: false, error: (err as Error)?.message ?? String(err) });
  }
};
