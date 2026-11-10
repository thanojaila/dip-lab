import { h } from './dom';

export type ChallengeView =
  | { kind: 'idle'; prompt: string; best?: number; passedBefore: boolean; metric: string }
  | { kind: 'unavailable'; prompt: string; why: string }
  | { kind: 'result'; prompt: string; passed: boolean; value: number; metric: string };

/** Challenge status with text and an icon (never colour alone). Never blocks progress. */
export class ChallengeBadge {
  readonly el = h('div', { class: 'challenge', role: 'group' });
  private status = h('p', { class: 'state', 'aria-live': 'polite' });
  private prompt = h('p', {});

  constructor() {
    this.el.appendChild(h('h4', {}, 'Challenge'));
    this.el.appendChild(this.prompt);
    this.el.appendChild(this.status);
  }

  set(v: ChallengeView): void {
    this.prompt.textContent = v.prompt;
    this.el.classList.toggle('passed', v.kind === 'result' && v.passed);
    if (v.kind === 'unavailable') this.status.textContent = `– ${v.why}`;
    else if (v.kind === 'idle') this.status.textContent = v.passedBefore ? `✓ You passed this before${v.best !== undefined ? ` (best ${fmt(v.best)} ${v.metric})` : ''}. Run again to retry.` : 'Not tried yet. The check runs on the bundled image, locally.';
    else this.status.textContent = `${v.passed ? '✓ Passed' : '✗ Not yet'}: ${v.metric} = ${fmt(v.value)}`;
  }
}
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
