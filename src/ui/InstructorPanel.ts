import { INSTRUCTOR } from '../lessons/instructor';
import { renderMarkdown } from '../lessons/markdown';
import { h } from './dom';

/** Static lesson hooks from docs/INSTRUCTOR.md (FR-17). Toggled from the header. */
export function InstructorPanel(): HTMLElement {
  const el = h('section', { class: 'panel instructor hidden', id: 'instructor-panel', 'aria-labelledby': 'instructor-h' }, h('h2', { id: 'instructor-h' }, 'Instructor mode'));
  el.appendChild(renderMarkdown(INSTRUCTOR.main, 3));
  return el;
}

/** Per-segment notes block, shown only in instructor mode. */
export function InstructorSegmentNotes(segmentId: string): HTMLElement | null {
  const md = INSTRUCTOR.segments[segmentId];
  if (!md) return null;
  const box = h('details', { class: 'instructor-note hidden', 'data-instructor': '1', open: true }, h('summary', {}, 'Instructor notes for this segment'));
  box.appendChild(renderMarkdown(md, 4));
  return box;
}
