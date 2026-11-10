/** Upload policy (FR-03, NFR-08): pure helpers, no DOM, easy to test. */
export const MAX_BYTES = 8 * 1024 * 1024;
export const MAX_SIDE = 1024;
export const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;

export interface ResizePlan {
  w: number;
  h: number;
  resized: boolean;
}

export function planResize(w: number, h: number, maxSide = MAX_SIDE): ResizePlan {
  const longest = Math.max(w, h);
  if (longest <= maxSide) return { w, h, resized: false };
  const s = maxSide / longest;
  return {
    w: Math.max(1, Math.round(w * s)),
    h: Math.max(1, Math.round(h * s)),
    resized: true,
  };
}

/** Detect the real type from magic bytes. SVG/GIF/BMP etc. return null. */
export function sniffImageType(b: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return 'image/webp';
  return null;
}

export type ValidationResult = { ok: true; type: string } | { ok: false; reason: string };

export function validateUpload(size: number, declaredType: string, head: Uint8Array): ValidationResult {
  if (size > MAX_BYTES) return { ok: false, reason: `File is ${(size / 1048576).toFixed(1)} MB; the limit is 8 MB.` };
  if (!(ALLOWED_MIME as readonly string[]).includes(declaredType))
    return { ok: false, reason: `Type "${declaredType || 'unknown'}" is not allowed. Use PNG, JPEG or WebP (SVG is rejected).` };
  const sniffed = sniffImageType(head);
  if (!sniffed) return { ok: false, reason: 'File contents are not a PNG, JPEG or WebP image.' };
  return { ok: true, type: sniffed };
}
