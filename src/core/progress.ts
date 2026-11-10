/** Stamps and challenge results. Lives only in localStorage under one key; nothing leaves the tab. */
export const PROGRESS_KEY = 'diplab.v2.progress';

export interface StampState { demo: boolean; predict: boolean }
export interface ChallengeState { passed: boolean; best: number }
export interface ProgressData {
  v: 2;
  stamps: Record<string, StampState>;
  challenges: Record<string, ChallengeState>;
}

export type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const empty = (): ProgressData => ({ v: 2, stamps: {}, challenges: {} });

export class Progress {
  private data: ProgressData = empty();
  constructor(private store: KV | null, private validIds: readonly string[]) {
    this.load();
  }

  private load(): void {
    try {
      const raw = this.store?.getItem(PROGRESS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<ProgressData>;
      if (d.v !== 2) return;
      for (const id of this.validIds) {
        const s = d.stamps?.[id];
        if (s) this.data.stamps[id] = { demo: s.demo === true, predict: s.predict === true };
        const c = d.challenges?.[id];
        if (c) this.data.challenges[id] = { passed: c.passed === true, best: Number(c.best) || 0 };
      }
    } catch {
      this.data = empty();
    }
  }

  private save(): void {
    try {
      this.store?.setItem(PROGRESS_KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable: progress lasts for this visit only */
    }
  }

  /** Record that the hero demo was run or the prediction was committed. Returns true if this completed the stamp. */
  earn(id: string, part: 'demo' | 'predict'): boolean {
    if (!this.validIds.includes(id)) return false;
    const before = this.hasStamp(id);
    const s = (this.data.stamps[id] ??= { demo: false, predict: false });
    s[part] = true;
    this.save();
    return !before && this.hasStamp(id);
  }

  hasStamp(id: string): boolean {
    const s = this.data.stamps[id];
    return !!s && s.demo && s.predict;
  }
  part(id: string): StampState {
    return this.data.stamps[id] ?? { demo: false, predict: false };
  }
  count(ids: readonly string[] = this.validIds): number {
    return ids.filter((i) => this.hasStamp(i)).length;
  }

  recordChallenge(id: string, passed: boolean, value: number): void {
    const c = (this.data.challenges[id] ??= { passed: false, best: 0 });
    c.passed = c.passed || passed;
    c.best = Math.max(c.best, value);
    this.save();
  }
  challenge(id: string): ChallengeState | undefined {
    return this.data.challenges[id];
  }

  /** "Reset my progress": removes the app's one key. */
  reset(): void {
    this.data = empty();
    try {
      this.store?.removeItem(PROGRESS_KEY);
    } catch {
      /* ignore */
    }
  }
}
