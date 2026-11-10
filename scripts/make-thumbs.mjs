// Build-time thumbnails: public/samples/thumbs/<id>.png (max side 112). Run by `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const root = path.resolve(import.meta.dirname, '../public/samples');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
fs.mkdirSync(path.join(root, 'thumbs'), { recursive: true });
const MAX = 112;

function decode(file) {
  const buf = fs.readFileSync(path.join(root, file));
  if (file.endsWith('.png')) {
    const p = PNG.sync.read(buf);
    return { w: p.width, h: p.height, data: p.data };
  }
  const j = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { w: j.width, h: j.height, data: j.data };
}

for (const im of manifest.images) {
  const src = decode(im.file);
  const s = Math.min(1, MAX / Math.max(src.w, src.h));
  const w = Math.max(1, Math.round(src.w * s));
  const h = Math.max(1, Math.round(src.h * s));
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * src.h) / h), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * src.h) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * src.w) / w), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * src.w) / w));
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const o = (yy * src.w + xx) * 4;
        for (let c = 0; c < 4; c++) acc[c] += src.data[o + c];
        n++;
      }
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out.data[o + c] = Math.round(acc[c] / n);
    }
  }
  fs.writeFileSync(path.join(root, 'thumbs', `${im.id}.png`), PNG.sync.write(out));
}
console.log(`thumbs: ${manifest.images.length}`);
