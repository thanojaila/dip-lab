import manifest from '../../public/samples/manifest.json';
import type { Pixels } from './matIO';
import { patternById, SHELF_PATTERN_IDS, TEST_PATTERNS } from './testPatterns';

/** One bundled photograph, straight from public/samples/manifest.json. Add an image = edit the manifest. */
export interface ImageEntry {
  id: string;
  file: string;
  width: number;
  height: number;
  mode: 'gray' | 'rgb';
  bytes: number;
  licence: string;
  credit: string;
  origin: string;
  teaches: string;
  techniques: string[];
}

export const IMAGES: ImageEntry[] = (manifest.images as unknown as ImageEntry[]).slice();

const TITLES: Record<string, string> = {
  microaneurysms: 'Microaneurysms',
  clock_motion: 'Clock (motion blur)',
  tissue_ihc: 'Stained tissue',
  sheet_music: 'Sheet music',
  circuit_board: 'Circuit board',
  hubble: 'Hubble deep field',
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

export interface SampleRef {
  id: string;
  title: string;
  teaches: string;
  group: 'photo' | 'pattern';
  /** URL of the build-time thumbnail (photos); patterns are drawn on demand. */
  thumb?: string;
  width: number;
  height: number;
  mode: 'gray' | 'rgb';
  credit?: string;
  licence?: string;
  techniques: string[];
}

const BASE = (): string => import.meta.env?.BASE_URL ?? './';

export const SAMPLE_REFS: SampleRef[] = [
  ...IMAGES.map<SampleRef>((i) => ({
    id: i.id,
    title: TITLES[i.id] ?? cap(i.id),
    teaches: i.teaches,
    group: 'photo',
    thumb: `${BASE()}samples/thumbs/${i.id}.png`,
    width: i.width,
    height: i.height,
    mode: i.mode,
    credit: i.credit,
    licence: i.licence,
    techniques: i.techniques,
  })),
  ...TEST_PATTERNS.filter((p) => SHELF_PATTERN_IDS.includes(p.id)).map<SampleRef>((p) => ({
    id: p.id,
    title: p.title,
    teaches: p.teaches,
    group: 'pattern',
    width: 256,
    height: 256,
    mode: p.id === 'tp-ramp' || p.id === 'tp-checker' || p.id === 'tp-step-edge' ? 'gray' : 'rgb',
    techniques: [],
  })),
];

export const imageById = (id: string): ImageEntry | undefined => IMAGES.find((i) => i.id === id);
export const refById = (id: string): SampleRef | undefined => SAMPLE_REFS.find((r) => r.id === id) ?? legacyRef(id);
export const isBundledPhoto = (id: string): boolean => !!imageById(id);

/** v1 config files used these ids. */
const LEGACY: Record<string, string> = { ramp: 'tp-ramp', checker: 'tp-checker', 'step-edge': 'tp-step-edge', 'low-contrast': 'tp-low-contrast', 'impulse-noise': 'tp-impulse-noise', blobs: 'tp-blobs' };
export function normalizeSampleId(id: string): string {
  if (LEGACY[id]) return LEGACY[id];
  return id;
}
function legacyRef(id: string): SampleRef | undefined {
  const p = patternById(id);
  return p ? { id: p.id, title: p.title, teaches: p.teaches, group: 'pattern', width: 256, height: 256, mode: 'rgb', techniques: [] } : undefined;
}
export const ALL_SAMPLE_IDS: string[] = [...IMAGES.map((i) => i.id), ...TEST_PATTERNS.map((p) => p.id), ...Object.keys(LEGACY)];

/** Best images for a technique: manifest lists first (stable order). */
export function bestFor(techniqueId: string): SampleRef[] {
  return SAMPLE_REFS.filter((r) => r.techniques.includes(techniqueId));
}

const cache = new Map<string, Promise<Pixels>>();

/** Decode a bundled image (same-origin fetch) or generate a test pattern. */
export function loadSamplePixels(rawId: string): Promise<Pixels> {
  const id = normalizeSampleId(rawId);
  const hit = cache.get(id);
  if (hit) return hit;
  const pat = patternById(id);
  const p: Promise<Pixels> = pat
    ? Promise.resolve(pat.make())
    : (async () => {
        const entry = imageById(id);
        if (!entry) throw new Error(`Unknown sample "${rawId}"`);
        const res = await fetch(`${BASE()}samples/${entry.file}`);
        if (!res.ok) throw new Error(`Could not load ${entry.file}`);
        const bmp = await createImageBitmap(await res.blob());
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        const d = ctx.getImageData(0, 0, c.width, c.height);
        return { w: d.width, h: d.height, data: d.data };
      })();
  cache.set(id, p);
  return p;
}
