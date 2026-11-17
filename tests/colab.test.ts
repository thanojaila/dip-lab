import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { TECHNIQUES } from '../src/registry/techniques';
import { COLAB } from '../src/notes/colab';
import { COLAB_EXTRA } from '../src/notes/colabExtra';

describe('Colab code cells', () => {
  it('every key is a real concept and every cell has code', () => {
    const ids = new Set(TECHNIQUES.map((t) => t.id));
    for (const [id, cells] of [...Object.entries(COLAB), ...Object.entries(COLAB_EXTRA)]) {
      expect(ids.has(id), id).toBe(true);
      for (const c of cells) {
        expect(c.code.trim().length, id).toBeGreaterThan(10);
        expect(c.notebook, id).toBeTruthy();
      }
    }
  });

  it('every runnable concept has at least one Colab cell', () => {
    const missing = TECHNIQUES.filter((t) => !t.explainerOnly && !t.colab?.length).map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it('dumps cells for the Python syntax check when COLAB_DUMP is set', () => {
    const dir = process.env.COLAB_DUMP;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    for (const t of TECHNIQUES) (t.colab ?? []).forEach((c, i) => writeFileSync(`${dir}/${t.id}_${i}.py`, c.code));
  });
});
