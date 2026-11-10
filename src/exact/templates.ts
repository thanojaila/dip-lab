import type { Params } from '../core/types';

/**
 * Exact-transform templates (SRS §6.1):
 *   Exact: <equation>. Parameters: …. Domain: …. Border: …. Display mapping: ….
 * `{name}` is replaced from run vars, then params. Unresolved names stay visible (and are caught by tests).
 */
export const EXACT: Record<string, string> = {
  F01: 'Exact: decoded {origW}×{origH} from {srcNote}; {resizeNote}. Parameters: working size {w}×{h} = {pixels} pixels. Domain: 8-bit RGBA from the browser canvas, shown as-is. Border: n/a. Display mapping: none (identity).',
  F02: 'Exact: Y = 0.299·R + 0.587·G + 0.114·B per pixel (OpenCV COLOR_RGBA2GRAY, BT.601 weights), rounded to 8 bits. Parameters: none. Domain: uint8 RGB → uint8 gray. Border: n/a. Display mapping: clip (already 0–255).',
  F03: 'Exact: output pixel (x′,y′) samples the source at (x′/scale, y′/scale); {interpName} {interpBehaviour}. Parameters: scale = {scale}, {w0}×{h0} → {w}×{h}. Domain: {domain}. Border: edge pixels replicated while sampling. Display mapping: none; Original and Result are drawn at the same on-screen size with pixelated scaling so you can see individual pixels.',
  F04: 'Exact: bin = ⌊r·{L}/256⌋, out = round(bin·255/({L}−1)); {L} gray levels ≈ {bits} bits. Parameters: L = {L}. Domain: {domain}. Border: n/a (point operation). Display mapping: clip (0–255).',

  P01: 'Exact: s = 255 − r for every pixel and channel. Parameters: none. Domain: {domain}. Border: n/a. Display mapping: clip (already 0–255).',
  P02: 'Exact: s = {rule}, b = {b}. Parameters: b = {b}, clip = {clip}. Domain: {domain}. Border: n/a. Display mapping: clip ON saturates at 0/255; clip OFF wraps modulo 256.',
  P03: 'Exact: s = clip(255·(r − lo)/(hi − lo)), where lo = {lo} and hi = {hi} are the {pLow}th and {pHigh}th percentile gray levels of this image. Parameters: p_low = {pLow}%, p_high = {pHigh}%. Domain: {domain}. Border: n/a. Display mapping: clip (values outside [lo, hi] saturate).',
  P04: 'Exact: s = c·ln(1 + α·r), c = 255 / ln(1 + 255α) = {c}, so r = 255 maps to 255. Parameters: α = {alpha}. Domain: {domain}. Border: n/a. Display mapping: clip.',
  P05: 'Exact: s = 255·(r/255)^γ with γ = {gamma}. Parameters: γ = {gamma} (γ<1 brightens, γ>1 darkens). Domain: {domain}. Border: n/a. Display mapping: clip.',
  P06: 'Exact: {rule}. Parameters: mode = {mode}. Domain: uint8 gray → binary {0, 255}. Border: n/a. Display mapping: none (binary).',

  H01: 'Exact: h(v) = number of pixels with gray level v (cv.calcHist, 256 bins); CDF(v) = Σ h(0..v)/N. Parameters: N = {n} pixels, min = {min}, max = {max}, mean = {mean}, σ = {std}, {occupied} of 256 bins occupied. Domain: uint8 gray (luma). Border: n/a. Display mapping: histogram bars scaled to the tallest bin; CDF scaled 0–100%.',
  H02: 'Exact: s = round(255·(CDF(r) − CDF_min)/(N − CDF_min)), i.e. each level is remapped through the image’s own cumulative histogram (cv.equalizeHist). Parameters: none. Domain: uint8 gray. Border: n/a. Display mapping: clip (already 0–255).',
  H03: 'Exact: split the image into {tiles}×{tiles} tiles; in each tile clip histogram bins at {clip}× the average bin height, redistribute the excess, equalise, then bilinearly blend neighbouring tiles’ mappings (cv.CLAHE). Parameters: clipLimit = {clip}, tileGridSize = {tiles}×{tiles}. Domain: uint8 gray. Border: {border}. Display mapping: clip.',

  N01: 'Exact: s = clip(round(r + n)), n ~ N(0, σ²) drawn per value from a seeded mulberry32 + Box–Muller generator. Parameters: σ = {sigma}, seed = {seed}. Domain: {domain}. Border: n/a. Display mapping: clip (saturating).',
  N02: 'Exact: each pixel independently becomes 0 (pepper) with probability {half}%, 255 (salt) with probability {half}%, otherwise unchanged; ≈{corrupted} pixels corrupted. Parameters: amount = {amount}%, seed = {seed}. Domain: {domain}. Border: n/a. Display mapping: none (values are exactly 0/255 or untouched).',

  S01: 'Exact: s(x,y) = (1/{area}) · Σ r over the {k}×{k} window (each weight = {w}). Parameters: k = {k}. Domain: {domain}. Border: {border}. Display mapping: clip (already 0–255).',
  S02: 'Exact: s = Σ G(i,j)·r(x+i, y+j), G(i,j) ∝ exp(−(i²+j²)/(2σ²)), normalised to sum 1 over {k}×{k}. Parameters: k = {k}, σ = {sigma} ({sigmaNote}). Domain: {domain}. Border: {border}. Display mapping: clip.',
  S03: 'Exact: s = the {mid}th smallest of the {area} values in the {k}×{k} window (the median). Parameters: k = {k}. Domain: {domain}. Border: {border}. Display mapping: none (output is always one of the input values).',
  S04: 'Exact: s(p) = Σ_q r(q)·w(p,q) / Σ_q w(p,q), w = exp(−‖p−q‖²/(2σ_space²)) · exp(−(r(p)−r(q))²/(2σ_color²)) over a neighbourhood of diameter {d}. Parameters: d = {d}, σ_color = {sigmaColor}, σ_space = {sigmaSpace}; took {ms} ms. Domain: {domain}. Border: {border}. Display mapping: clip.',
  S05: 'Exact: s = f + k·(f − G_σ(f)) = {k1}·f − {k}·G_σ(f). Parameters: σ = {sigma}, k = {k}. Domain: {domain}. Border: {border}. Display mapping: clip (overshoot saturates; this is where halos can clip).',
  S06: 'Exact: s = f − ∇²f using the {nb}-neighbour Laplacian, implemented as one convolution with {kernelRows} (cv.filter2D). Parameters: neighbours = {nb}. Domain: {domain}. Border: {border}. Display mapping: clip.',

  S08: 'Exact: Gx and Gy from {ksize}×{ksize} Sobel derivatives; G = √(Gx² + Gy²). Parameters: ksize = {ksize}. Domain: uint8 gray → float32 gradients → uint8. Border: {border}. Display mapping: minmax, G scaled so the strongest edge (G = {max}) maps to 255.',
  S07: 'Exact: G = √(Gx² + Gy²) using {op}. Parameters: operator = {op}. Domain: uint8 gray → float32 → uint8. Border: {border}. Display mapping: minmax, strongest edge (G = {max}) maps to 255.',
  E01: 'Exact: pre-smooth ({pre}), Sobel gradients with {norm} magnitude, non-maximum suppression, then hysteresis: strong edges are pixels above {t2}; weaker pixels above {t1} are kept only if connected to a strong one. Parameters: low = {t1}, high = {t2}. Domain: uint8 gray → binary edge map. Border: OpenCV default (reflect). Display mapping: none (binary).',

  M01: 'Exact: {opName}, {shape} {k}×{k} structuring element, {iters} iteration(s); pre-processing: {pre}. Parameters: op = {op}, k = {k}, shape = {shape}, iterations = {iters}. Domain: uint8 gray. Border: constant (pixels outside the image never win a min/max). Display mapping: none.',
  M02: 'Exact: {opName}; {shape} {k}×{k} structuring element, {iters} iteration(s); pre-processing: {pre}. Parameters: op = {op}, k = {k}, shape = {shape}, iterations = {iters}. Domain: uint8 gray. Border: constant (pixels outside the image never win a min/max). Display mapping: none.',
  M03: 'Exact: Otsu threshold (T = {T}), then 8-connected component labelling; components with area ≥ {minArea} px are kept. Found {total} component(s); kept {kept}, removed {removed}. Parameters: min area = {minArea}. Domain: uint8 gray → binary {0, 255}. Border: n/a. Display mapping: none (kept components drawn white).',
};

export function fillTemplate(template: string, vars: Record<string, string | number>, params: Params): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    if (key in vars) return String(vars[key]);
    if (key in params) return String(params[key]);
    return whole;
  });
}
