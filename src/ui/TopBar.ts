import { h } from './dom';

export interface TopBarHooks {
  onMap(): void;
  onInstructor(): void;
  onTheme(): void;
}

/** Logo, world map, progress, theme and instructor toggles, plus the always-visible notice line. */
export class TopBar {
  readonly el: HTMLElement;
  private pill = h('span', { class: 'progress-pill', role: 'status', 'aria-live': 'polite' }, '0 / 0 stamps');
  readonly instructorBtn: HTMLButtonElement;
  private themeBtn: HTMLButtonElement;
  private engine = h('div', { class: 'engine-slot' });

  constructor(hooks: TopBarHooks) {
    this.instructorBtn = h('button', { type: 'button', class: 'btn small', 'aria-pressed': 'false', onclick: hooks.onInstructor }, 'Instructor');
    this.themeBtn = h('button', { type: 'button', class: 'btn small icon', 'aria-label': 'Switch between light and dark theme', onclick: hooks.onTheme }, '☾');
    this.el = h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'topbar-row' },
        h('h1', { class: 'logo' }, h('span', { class: 'logo-mark', 'aria-hidden': 'true' }, '◩'), 'DIP Lab'),
        h('button', { type: 'button', class: 'btn small', onclick: hooks.onMap }, 'World map'),
        this.pill,
        h('span', { class: 'topbar-spacer' }),
        this.instructorBtn,
        this.themeBtn),
      h('div', { class: 'notice-line', role: 'region', 'aria-label': 'Privacy and status notice' },
        h('div', {},
          h('span', {}, h('strong', {}, 'Private and unofficial:'), ' images never leave this tab; student-made, not a graded course project or official UH software. '),
          h('details', {}, h('summary', {}, 'Details'),
            h('p', {}, h('strong', {}, 'Private by design: '), 'every image is processed locally in this browser tab. Nothing is uploaded, and there are no accounts, analytics, trackers or remote fonts.'),
            h('p', {}, h('strong', {}, 'Unofficial learning aid: '), 'a student-made study resource. It is not a graded course project or Canvas submission, it is not official University of Houston software, and it makes no claim of instructor endorsement or course credit.'),
            this.engine))),
    );
  }

  setProgress(n: number, total: number): void {
    this.pill.textContent = `${n} / ${total} stamps`;
  }
  setTheme(dark: boolean): void {
    this.themeBtn.textContent = dark ? '☀' : '☾';
  }
  get engineSlot(): HTMLElement {
    return this.engine;
  }
}
