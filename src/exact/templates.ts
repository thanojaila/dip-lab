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

  H01: 'Exact: h(v) = number of pixels with gray level v (cv.calcHist, 256 bins); CDF(v) = Σ h(0..v)/N. Parameters: plane = {chan}; N = {n} pixels, min = {min}, max = {max}, mean = {mean}, σ = {std}, {occupied} of 256 bins occupied. Domain: uint8, {chan} plane. Border: n/a. Display mapping: histogram bars scaled to the tallest bin; CDF scaled 0–100%.',
  H02: 'Exact: s = round(255·(CDF(r) − CDF_min)/(N − CDF_min)), i.e. each level is remapped through the image’s own cumulative histogram (cv.equalizeHist). Parameters: plane = {chan}. Domain: uint8, {chan} plane. Border: n/a. Display mapping: clip (already 0–255).',
  H03: 'Exact: split the image into {tiles}×{tiles} tiles; in each tile clip histogram bins at {clip}× the average bin height, redistribute the excess, equalise, then bilinearly blend neighbouring tiles’ mappings (cv.CLAHE). Parameters: clipLimit = {clip}, tileGridSize = {tiles}×{tiles}, plane = {chan}. Domain: uint8, {chan} plane. Border: {border}. Display mapping: clip.',

  N01: 'Exact: s = clip(round(r + n)), n ~ N(0, σ²) drawn per value from a seeded mulberry32 + Box–Muller generator. Parameters: σ = {sigma}, seed = {seed}. Domain: {domain}. Border: n/a. Display mapping: clip (saturating).',
  N02: 'Exact: each pixel independently becomes 0 (pepper) with probability {half}%, 255 (salt) with probability {half}%, otherwise unchanged; ≈{corrupted} pixels corrupted. Parameters: amount = {amount}%, seed = {seed}. Domain: {domain}. Border: n/a. Display mapping: none (values are exactly 0/255 or untouched).',

  S01: 'Exact: s(x,y) = (1/{area}) · Σ r over the {k}×{k} window (each weight = {w}). Parameters: k = {k}. Domain: {domain}. Border: {border}. Display mapping: clip (already 0–255).',
  S02: 'Exact: s = Σ G(i,j)·r(x+i, y+j), G(i,j) ∝ exp(−(i²+j²)/(2σ²)), normalised to sum 1 over {k}×{k}. Parameters: k = {k}, σ = {sigma} ({sigmaNote}). Domain: {domain}. Border: {border}. Display mapping: clip.',
  S03: 'Exact: s = the {mid}th smallest of the {area} values in the {k}×{k} window (the median). Parameters: k = {k}. Domain: {domain}. Border: {border}. Display mapping: none (output is always one of the input values).',
  S04: 'Exact: s(p) = Σ_q r(q)·w(p,q) / Σ_q w(p,q), w = exp(−‖p−q‖²/(2σ_space²)) · exp(−(r(p)−r(q))²/(2σ_color²)) over a neighbourhood of diameter {d}. Parameters: d = {d}, σ_color = {sigmaColor}, σ_space = {sigmaSpace}; took {ms} ms. Domain: {domain}. Border: {border}. Display mapping: clip.',
  S05: 'Exact: s = f + k·(f − G_σ(f)) = {k1}·f − {k}·G_σ(f). Parameters: σ = {sigma}, k = {k}. Domain: {domain}. Border: {border}. Display mapping: clip (overshoot saturates; this is where halos can clip).',
  S06: 'Exact: s = f − ∇²f using the {nb}-neighbour Laplacian, implemented as one convolution with {kernelRows} (cv.filter2D). Parameters: neighbours = {nb}. Domain: {domain}. Border: {border}. Display mapping: clip.',

  S08: 'Exact: Gx and Gy from {ksize}×{ksize} Sobel derivatives; showing {what}. Parameters: ksize = {ksize}, view = {view}. Domain: uint8 gray → float32 gradients → uint8. Border: {border}. Display mapping: minmax, the strongest value ({max}) maps to 255.',
  S07: 'Exact: G = √(Gx² + Gy²) using {op}. Parameters: operator = {op}. Domain: uint8 gray → float32 → uint8. Border: {border}. Display mapping: minmax, strongest edge (G = {max}) maps to 255.',
  E01: 'Exact: pre-smooth ({pre}), Sobel gradients with {norm} magnitude, non-maximum suppression, then hysteresis: strong edges are pixels above {t2}; weaker pixels above {t1} are kept only if connected to a strong one. Parameters: low = {t1}, high = {t2}. Domain: uint8 gray → binary edge map. Border: OpenCV default (reflect). Display mapping: none (binary).',

  M01: 'Exact: {opName}, {shape} {se} structuring element, {iters} iteration(s); pre-processing: {pre}. Parameters: op = {op}, size = {k}, shape = {shape}, iterations = {iters}. Domain: uint8 gray. Border: constant (pixels outside the image never win a min/max). Display mapping: none.',
  M02: 'Exact: {opName}; {shape} {se} structuring element, {iters} iteration(s); pre-processing: {pre}. Parameters: op = {op}, size = {k}, shape = {shape}, iterations = {iters}. Domain: uint8 gray. Border: constant (pixels outside the image never win a min/max). Display mapping: none.',
  M03: 'Exact: threshold (T = {T}, {polarity}), {open}, then 8-connected component labelling; components with area ≥ {minArea} px are kept. Found {total} raw component(s); kept {kept}, removed {removed}. Parameters: min area = {minArea}. Domain: uint8 gray → binary {0, 255}. Border: n/a. Display mapping: none (kept components drawn white).',

  F05: 'Exact: shrink by ÷{factor} to {w}×{h} with {interpName}, then enlarge back with nearest-neighbour so you can see what survived. Nearest keeps every {factor}th sample and ignores the rest; INTER_AREA averages each {factor}×{factor} block first. Parameters: factor = {factor}, interpolation = {interp}. Domain: {domain}. Border: n/a. Display mapping: none.',
  C01: 'Exact: convert RGB → HSV (OpenCV scale: H 0–180, S 0–255, V 0–255) and keep pixels with H in {hueRanges}, S ≥ {satMin}, V ≥ {valMin}. {wraps}. Showing: {view}. Found {blobs} blobs of at least 150 px ({specks} smaller specks ignored). Parameters: hue = {hue}, half-width = {width}. Domain: uint8 RGB → HSV. Border: n/a. Display mapping: the mask view keeps selected pixels and dims the rest; other views are single planes (hue scaled by 255/180).',
  T01: 'Exact: for each pixel, T(x,y) = {method} of its {block}×{block} neighbourhood − C; out = 255 if r > T(x,y) else 0. For comparison, Otsu uses one global T = {T}. Parameters: block = {block}, C = {C}, method = {method}. Domain: uint8 gray → binary {0, 255}. Border: {border}. Display mapping: none (binary).',
  M04: 'Exact: {opName}, {shape} {se} element; {post}. {total} raw components, {kept} with area ≥ {minArea} px. Parameters: op = {op}, size = {k}, shape = {shape}, min area = {minArea}. Domain: uint8 gray → binary or gray. Border: constant. Display mapping: none.',
  H04: 'Exact: for each level i, output the smallest level j with CDF_ref(j) ≥ CDF_src(i), using the reference "{refName}". Parameters: reference = {refName}. Domain: {domain}. Border: n/a (point operation). Display mapping: clip (already 0–255).',

  Q01: 'Exact: zero-pad {w}×{h} to {W}×{H} (cv.getOptimalDFTSize), F = DFT(f), swap quadrants so zero frequency is in the middle, show log(1 + |F|) scaled so the maximum is 255. 95% of the non-DC energy lies within {r95} px of the centre. Parameters: none. Domain: float32 gray. Border: zero padding. Display mapping: log scale, maximum → 255.',
  Q02: 'Exact: g = IDFT(F · H), H = {kind}, cutoff D0 = {d0} px on the {W}×{H} padded spectrum. Parameters: D0 = {d0}, kind = {kind}. Domain: float32 gray → uint8. Border: zero padding, cropped back after filtering. Display mapping: clip.',
  Q03: 'Exact: g = IDFT(F · (1 − H_low)), H_low = {kind}, D0 = {d0}. The DC term is removed, so the mean is about 0 and values are signed. Parameters: D0 = {d0}. Domain: float32 → uint8. Border: zero padding, cropped back. Display mapping: {display}.',
  Q04: 'Exact: the same D0 = {d0} with two masks. Ideal: values {idealMin} to {idealMax} before clipping; Gaussian: {gaussMin} to {gaussMax}. Showing: {show}. Parameters: D0 = {d0}, show = {show}. Domain: float32 → uint8. Border: zero padding. Display mapping: clip, so anything outside 0–255 (the ringing overshoot) is cut off.',

  FT01: 'Exact: slide the {w}×{h} template cut at ({x}, {y}) over the gray image; score = normalised cross-correlation of mean-removed patches (TM_CCOEFF_NORMED); keep peaks ≥ {score} after suppressing duplicates. Found {matches}. Parameters: score ≥ {score}. Domain: uint8 gray. Border: only positions fully inside the image. Display mapping: boxes drawn over the original.',
  FT02: 'Exact: Harris response R = det(M) − k·trace(M)², M = windowed sum of gradient products over a {block}×{block} window, k = {k}; keep local maxima of R above {frac}·max(R). Found {n} corners. Parameters: block = {block}, k = {k}, threshold = {frac}. Domain: uint8 gray → float32. Border: OpenCV default (reflect). Display mapping: points drawn over the original.',
  FT03: 'Exact: binarise (T = {T}, {polarity}), then trace outer boundaries (cv.findContours, RETR_EXTERNAL, CHAIN_APPROX_SIMPLE). {count} contours with area ≥ {minArea}; the largest has {largest} points. Parameters: threshold, polarity, min area. Domain: uint8 gray → binary. Border: n/a. Display mapping: contours drawn over the original.',
  FT04: 'Exact: Canny({t1}, {t2}), then probabilistic Hough: each edge pixel votes for every line (ρ, θ) through it; lines with ≥ {votes} votes, length ≥ {minLen} px and gaps ≤ {maxGap} px become segments. Found {n}. Parameters: votes = {votes}, min length = {minLen}, max gap = {maxGap}. Domain: uint8 gray → binary edges. Border: n/a. Display mapping: segments drawn over the original; the scope shows the full accumulator.',
  FT05: 'Exact: median {med}×{med}, then Hough gradient: edge pixels vote along their gradient direction for circle centres; centres with at least {p2} votes, {minDist} px apart, radii {rMin}–{rMax}, Canny high threshold {p1}. Found {n}. Parameters: minDist = {minDist}, param1 = {p1}, param2 = {p2}. Domain: uint8 gray. Border: n/a. Display mapping: circles drawn over the original.',

  G01: 'Exact: [x′; y′] = s·R(θ)·([x; y] − c) + c with θ = {angle}°, s = {scale}, applied in {passes} pass(es) of {step}° each, bilinear interpolation every pass; output stays {w}×{h}. Parameters: angle = {angle}, scale = {scale}, passes = {passes}. Domain: uint8. Border: constant (black). Display mapping: none.',
  G02: 'Exact: x′ = x + {shear}·y + {tx}, y′ = y + {ty}; bilinear sampling; output stays {w}×{h}; pixels sampled from outside use: {borderName}. Parameters: shift = ({tx}, {ty}), shear = {shear}. Domain: uint8. Border: {borderName}. Display mapping: none.',
  G03: 'Exact: solve the 3×3 homography H that sends the four corners {corners} to the corners of a {size}×{size} square (cv.getPerspectiveTransform), then warp with bilinear sampling (cv.warpPerspective). Parameters: output size = {size}. Domain: uint8. Border: constant (black). Display mapping: none.',
};

export function fillTemplate(template: string, vars: Record<string, string | number>, params: Params): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    if (key in vars) return String(vars[key]);
    if (key in params) return String(params[key]);
    return whole;
  });
}
