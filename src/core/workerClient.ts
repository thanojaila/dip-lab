import type { RunOutput, RunRequest } from './runTechnique';

/** Runs heavy techniques (DFT, Hough, big bilateral) in a Worker with cancel. Null worker => caller falls back to the main thread. */
export class HeavyRunner {
  private worker: Worker | null = null;
  private seq = 0;
  private pendingReject: ((e: Error) => void) | null = null;

  static available(): boolean {
    return typeof Worker !== 'undefined' && !import.meta.env.DEV;
  }

  run(req: RunRequest, opencvUrl: string): Promise<RunOutput> {
    if (!this.worker) this.worker = new Worker(new URL('../worker/cvWorker.ts', import.meta.url));
    const w = this.worker;
    const seq = ++this.seq;
    return new Promise<RunOutput>((resolve, reject) => {
      this.pendingReject = reject;
      const onMsg = (e: MessageEvent<{ seq: number; ok: boolean; out?: RunOutput; error?: string }>) => {
        if (e.data.seq !== seq) return;
        w.removeEventListener('message', onMsg);
        this.pendingReject = null;
        if (e.data.ok && e.data.out) resolve(e.data.out);
        else reject(new Error(e.data.error ?? 'Worker failed'));
      };
      w.addEventListener('message', onMsg);
      w.addEventListener('error', (ev) => reject(new Error(ev.message || 'Worker error')), { once: true });
      w.postMessage({ type: 'run', seq, req, opencvUrl });
    });
  }

  /** Abort the running job. The worker is discarded (its OpenCV copy reloads on the next heavy run). */
  cancel(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pendingReject?.(new Error('Cancelled'));
    this.pendingReject = null;
  }
}
