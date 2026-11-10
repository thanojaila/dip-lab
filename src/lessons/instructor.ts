import guide from '../../docs/INSTRUCTOR.md?raw';

export interface InstructorGuide {
  /** Markdown of everything except the per-segment guide. */
  main: string;
  /** Per-segment markdown keyed by segment id (from "### <id>" under "## Segment guide"). */
  segments: Record<string, string>;
}

/** Split the static markdown into the general part and per-segment notes. Pure. */
export function parseInstructor(md: string): InstructorGuide {
  const marker = md.indexOf('## Segment guide');
  if (marker < 0) return { main: md, segments: {} };
  const main = md.slice(0, marker).trimEnd();
  const rest = md.slice(marker + '## Segment guide'.length);
  const segments: Record<string, string> = {};
  const parts = rest.split(/^### /m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    segments[part.slice(0, nl).trim()] = part.slice(nl + 1).trim();
  }
  return { main, segments };
}

export const INSTRUCTOR: InstructorGuide = parseInstructor(guide);
