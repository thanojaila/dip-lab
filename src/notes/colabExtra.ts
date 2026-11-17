import type { ColabSnippet } from './colab';

/**
 * Colab-ready Python for the concepts that have no cell in the course notebooks.
 * Written for this lab (NOT copied from a notebook): each cell reproduces what the lab runs,
 * with the lab's default parameters, so it can be pasted into Colab next to `img`.
 */
const GEN = 'Written for DIP Lab (not from your notebooks)';

const SETUP = `import cv2
import numpy as np
import matplotlib.pyplot as plt

img   = cv2.imread("lena.jpg", cv2.IMREAD_GRAYSCALE)   # gray, uint8
color = cv2.imread("lena.jpg")                         # BGR, uint8`;

const SHOW = `
plt.figure(figsize=(9, 4))
plt.subplot(1, 2, 1); plt.imshow(img, cmap="gray", vmin=0, vmax=255); plt.title("Original"); plt.axis("off")
plt.subplot(1, 2, 2); plt.imshow(out, cmap="gray", vmin=0, vmax=255); plt.title("Result"); plt.axis("off")
plt.tight_layout(); plt.show()`;

const cell = (cellName: string, body: string, note?: string, withSetup = true): ColabSnippet => ({
  notebook: GEN,
  cell: cellName,
  code: `${withSetup ? SETUP + '\n\n' : ''}${body}${SHOW}`,
  note,
});

export const COLAB_EXTRA: Record<string, ColabSnippet[]> = {
  C01: [
    {
      notebook: GEN,
      cell: 'Split channels, then select a colour by hue',
      code: `import cv2
import numpy as np
import matplotlib.pyplot as plt

color = cv2.imread("smarties.jpg")            # OpenCV reads BGR
b, g, r = cv2.split(color)                    # the three channel planes
hsv = cv2.cvtColor(color, cv2.COLOR_BGR2HSV)
h, s, v = cv2.split(hsv)                      # OpenCV hue is degrees / 2 (0-180)

hue, width, sat_min, val_min = 0, 10, 120, 100   # red is near 0 (and 180)
lo = (hue - width) % 180
hi = (hue + width) % 180
if lo <= hi:
    mask = cv2.inRange(hsv, (lo, sat_min, val_min), (hi, 255, 255))
else:                                          # hue range wraps around 180
    mask = cv2.inRange(hsv, (lo, sat_min, val_min), (179, 255, 255)) | \\
           cv2.inRange(hsv, (0, sat_min, val_min), (hi, 255, 255))

plt.figure(figsize=(12, 3))
for i, (name, im) in enumerate([("Red", r), ("Green", g), ("Blue", b), ("Hue", h), ("Selected colour", mask)]):
    plt.subplot(1, 5, i + 1); plt.imshow(im, cmap="gray"); plt.title(name); plt.axis("off")
plt.tight_layout(); plt.show()`,
      note: GEN + '. Same hue window and wrap-around handling as the lab.',
    },
  ],

  P01: [cell('Negative: s = 255 - r', `out = 255 - img`)],
  P02: [cell('Brightness: clip vs wrap', `b = 60
clipped = np.clip(img.astype(np.int16) + b, 0, 255).astype(np.uint8)   # saturate at 0 / 255
wrapped = (img.astype(np.int16) + b).astype(np.uint8)                  # uint8 wrap-around (the classic bug)
out = clipped`, 'Change out to "wrapped" to see the wrap-around bug the lab shows with Clip turned off.')],
  P03: [cell('Contrast stretch with percentiles', `p_low, p_high = 2, 98
lo, hi = np.percentile(img, [p_low, p_high])
out = np.clip(255 * (img.astype(np.float32) - lo) / max(hi - lo, 1), 0, 255).astype(np.uint8)`)],
  P04: [cell('Log transform: s = c * ln(1 + alpha*r)', `alpha = 1.0
c = 255 / np.log(1 + 255 * alpha)          # so r = 255 maps to 255
out = np.clip(c * np.log(1 + alpha * img.astype(np.float32)), 0, 255).astype(np.uint8)`)],
  P05: [cell('Gamma: s = 255 * (r/255)^gamma', `gamma = 0.5                                 # < 1 brightens, > 1 darkens
lut = np.array([255 * (i / 255) ** gamma for i in range(256)]).round().astype(np.uint8)
out = cv2.LUT(img, lut)`)],
  P06: [cell('Threshold and Otsu', `T = 128
_, fixed = cv2.threshold(img, T, 255, cv2.THRESH_BINARY)
otsu_T, otsu = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
print("Otsu chose T =", otsu_T)
out = otsu`)],

  H02: [cell('Global histogram equalisation', `out = cv2.equalizeHist(img)

plt.figure(figsize=(9, 3))
plt.subplot(1, 2, 1); plt.hist(img.ravel(), 256, (0, 256)); plt.title("Before")
plt.subplot(1, 2, 2); plt.hist(out.ravel(), 256, (0, 256)); plt.title("After")
plt.show()`)],
  H04: [
    {
      notebook: GEN,
      cell: 'Histogram matching to a reference image',
      code: `import cv2
import numpy as np
import matplotlib.pyplot as plt

src = cv2.imread("lena.jpg", cv2.IMREAD_GRAYSCALE)
ref = cv2.imread("reference.jpg", cv2.IMREAD_GRAYSCALE)

def cdf(a):
    h = np.bincount(a.ravel(), minlength=256).astype(np.float64)
    return np.cumsum(h) / h.sum()

cs, cr = cdf(src), cdf(ref)
# smallest reference level j with CDF_ref(j) >= CDF_src(i), for every source level i
lut = np.searchsorted(cr, cs - 1e-12).clip(0, 255).astype(np.uint8)
out = cv2.LUT(src, lut)

plt.figure(figsize=(12, 3))
for i, (name, im) in enumerate([("Source", src), ("Reference", ref), ("Matched", out)]):
    plt.subplot(1, 3, i + 1); plt.imshow(im, cmap="gray", vmin=0, vmax=255); plt.title(name); plt.axis("off")
plt.show()`,
      note: GEN + '. For colour, run it once per R, G, B plane, as the lab does.',
    },
  ],

  N01: [cell('Gaussian noise', `sigma, seed = 20, 0
rng = np.random.default_rng(seed)
out = np.clip(np.round(img + rng.normal(0, sigma, img.shape)), 0, 255).astype(np.uint8)
print("PSNR:", cv2.PSNR(img, out), "dB")`, 'The lab uses its own seeded mulberry32 generator, so the noise pattern differs even with the same seed; the statistics match.')],
  N02: [cell('Salt-and-pepper noise', `amount, seed = 8, 0                          # percent of pixels corrupted
rng = np.random.default_rng(seed)
r = rng.random(img.shape)
out = img.copy()
out[r < amount / 200] = 0                     # pepper
out[(r >= amount / 200) & (r < amount / 100)] = 255   # salt
print("PSNR:", cv2.PSNR(img, out), "dB")`, 'Half of the corrupted pixels become 0 and half 255, as in the lab.')],

  S01: [cell('Box blur', `k = 5
out = cv2.blur(img, (k, k))`)],
  S02: [cell('Gaussian blur', `k, sigma = 5, 0                               # sigma 0 = OpenCV picks it from k
out = cv2.GaussianBlur(img, (k, k), sigma)`)],
  S03: [cell('Median filter', `k = 3
out = cv2.medianBlur(img, k)
print("PSNR vs original:", cv2.PSNR(img, out), "dB")`, 'Add salt-and-pepper noise first (N02), then compare PSNR to the 28 dB challenge.')],
  S04: [cell('Bilateral filter', `d, sigma_color, sigma_space = 9, 40, 5
out = cv2.bilateralFilter(img, d, sigma_color, sigma_space)`)],
  S05: [cell('Unsharp mask / high-boost', `sigma, k = 2, 1.5
blur = cv2.GaussianBlur(img, (0, 0), sigma)
out = cv2.addWeighted(img, 1 + k, blur, -k, 0)     # f + k * (f - blur)`)],
  S06: [cell('Laplacian sharpen', `# 4-neighbour kernel: f - Laplacian(f)
kernel = np.array([[ 0, -1,  0],
                   [-1,  5, -1],
                   [ 0, -1,  0]], dtype=np.float32)
# 8-neighbour: [[-1,-1,-1],[-1, 9,-1],[-1,-1,-1]]
out = cv2.filter2D(img, -1, kernel)`)],

  S08: [cell('Sobel: Gx, Gy and magnitude', `ksize = 3
gx = cv2.Sobel(img, cv2.CV_32F, 1, 0, ksize=ksize)
gy = cv2.Sobel(img, cv2.CV_32F, 0, 1, ksize=ksize)
mag = cv2.magnitude(gx, gy)
out = cv2.convertScaleAbs(mag)                   # |.| then clip to 0-255 uint8`)],
  S07: [cell('Prewitt and Roberts', `prewitt_x = np.array([[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]], np.float32)
prewitt_y = prewitt_x.T
gx = cv2.filter2D(img.astype(np.float32), -1, prewitt_x)
gy = cv2.filter2D(img.astype(np.float32), -1, prewitt_y)
prewitt = cv2.convertScaleAbs(cv2.magnitude(gx, gy))

roberts_x = np.array([[1, 0], [0, -1]], np.float32)
roberts_y = np.array([[0, 1], [-1, 0]], np.float32)
rx = cv2.filter2D(img.astype(np.float32), -1, roberts_x)
ry = cv2.filter2D(img.astype(np.float32), -1, roberts_y)
roberts = cv2.convertScaleAbs(cv2.magnitude(rx, ry))
out = prewitt`)],
  E01: [cell('Canny', `t1, t2, preblur = 50, 150, 0
src = cv2.GaussianBlur(img, (preblur, preblur), 0) if preblur else img   # preblur must be odd
out = cv2.Canny(src, t1, t2, L2gradient=False)`)],

  T01: [cell('Adaptive threshold', `block, C = 11, 2                              # block must be odd
out = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                            cv2.THRESH_BINARY, block, C)
# plain mean: cv2.ADAPTIVE_THRESH_MEAN_C`)],

  M01: [cell('Erode and dilate', `_, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)  # objects bright
se = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))   # MORPH_RECT / MORPH_CROSS also
eroded  = cv2.erode(binary, se, iterations=1)
dilated = cv2.dilate(binary, se, iterations=1)
out = eroded`)],
  M02: [cell('Open, close, gradient', `_, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
se = cv2.getStructuringElement(cv2.MORPH_RECT, (41, 1))     # a line-shaped element, 41 wide x 1 high
opened   = cv2.morphologyEx(binary, cv2.MORPH_OPEN,     se)
closed   = cv2.morphologyEx(binary, cv2.MORPH_CLOSE,    se)
gradient = cv2.morphologyEx(binary, cv2.MORPH_GRADIENT, se)
out = opened`)],
  M03: [cell('Threshold, clean up, count', `_, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
min_area, open_k = 200, 0
if open_k:
    se = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_k, open_k))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, se)
n, labels, stats, _ = cv2.connectedComponentsWithStats(binary)
kept = sum(1 for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= min_area)   # label 0 is background
print("Objects counted:", kept)
out = binary`)],
  M04: [cell('Top-hat and black-hat', `se = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61))
tophat   = cv2.morphologyEx(img, cv2.MORPH_TOPHAT,   se)     # bright things smaller than the element
blackhat = cv2.morphologyEx(img, cv2.MORPH_BLACKHAT, se)     # dark things smaller than the element
_, out = cv2.threshold(tophat, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)`)],

  Q01: [cell('DFT log-magnitude spectrum', `f = np.fft.fftshift(np.fft.fft2(img.astype(np.float32)))
spectrum = np.log1p(np.abs(f))
out = (255 * spectrum / spectrum.max()).astype(np.uint8)`, 'The lab uses cv2.dft with an optimal size and zero padding; numpy fft2 gives the same spectrum shape.')],
  Q02: [cell('Low-pass filter (Gaussian or ideal)', `d0, kind = 30, "gaussian"
rows, cols = img.shape
u, v = np.meshgrid(np.arange(cols) - cols // 2, np.arange(rows) - rows // 2)
D = np.sqrt(u ** 2 + v ** 2)
H = np.exp(-(D ** 2) / (2 * d0 ** 2)) if kind == "gaussian" else (D <= d0).astype(np.float32)

F = np.fft.fftshift(np.fft.fft2(img.astype(np.float32)))
out = np.clip(np.real(np.fft.ifft2(np.fft.ifftshift(F * H))), 0, 255).astype(np.uint8)`)],
  Q03: [cell('High-pass filter', `d0, kind = 30, "gaussian"
rows, cols = img.shape
u, v = np.meshgrid(np.arange(cols) - cols // 2, np.arange(rows) - rows // 2)
D = np.sqrt(u ** 2 + v ** 2)
H = 1 - (np.exp(-(D ** 2) / (2 * d0 ** 2)) if kind == "gaussian" else (D <= d0).astype(np.float32))

F = np.fft.fftshift(np.fft.fft2(img.astype(np.float32)))
hp = np.real(np.fft.ifft2(np.fft.ifftshift(F * H)))
out = np.clip(hp + 128, 0, 255).astype(np.uint8)          # +128 so negatives stay visible`)],
  Q04: [cell('Ideal vs Gaussian low-pass: ringing', `d0 = 30
rows, cols = img.shape
u, v = np.meshgrid(np.arange(cols) - cols // 2, np.arange(rows) - rows // 2)
D = np.sqrt(u ** 2 + v ** 2)
F = np.fft.fftshift(np.fft.fft2(img.astype(np.float32)))

def lowpass(H):
    return np.clip(np.real(np.fft.ifft2(np.fft.ifftshift(F * H))), 0, 255).astype(np.uint8)

ideal    = lowpass((D <= d0).astype(np.float32))          # hard cutoff: ripples (ringing) near edges
gaussian = lowpass(np.exp(-(D ** 2) / (2 * d0 ** 2)))     # smooth cutoff: no ringing
out = ideal`)],

  FT01: [cell('Template matching', `tx, ty, tw, th, score = 190, 90, 17, 22, 0.9
template = img[ty:ty + th, tx:tx + tw]
res = cv2.matchTemplate(img, template, cv2.TM_CCOEFF_NORMED)
ys, xs = np.where(res >= score)
print("Matches at or above", score, ":", len(xs))

out = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
for x, y in zip(xs, ys):
    cv2.rectangle(out, (x, y), (x + tw, y + th), (0, 255, 0), 1)
out = out[:, :, ::-1]                                      # BGR -> RGB for matplotlib`, 'The lab thins overlapping hits; add non-max suppression if you see many boxes on one object.')],
  FT02: [cell('Harris corners', `block, k, thr = 2, 0.04, 0.01
resp = cv2.cornerHarris(np.float32(img), block, 3, k)
corners = resp > thr * resp.max()
print("Corner pixels:", int(corners.sum()))

out = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
out[corners] = (0, 0, 255)
out = out[:, :, ::-1]`)],
  FT03: [cell('Contours', `_, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
min_area = 20
kept = [c for c in contours if cv2.contourArea(c) >= min_area]
print("Contours:", len(kept))

out = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
cv2.drawContours(out, kept, -1, (0, 255, 0), 1)
out = out[:, :, ::-1]`)],
  FT04: [cell('Hough lines', `t1, t2, votes, min_len, max_gap = 50, 150, 100, 100, 10
edges = cv2.Canny(img, t1, t2)
lines = cv2.HoughLinesP(edges, 1, np.pi / 180, votes, minLineLength=min_len, maxLineGap=max_gap)
print("Lines:", 0 if lines is None else len(lines))

out = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
for x1, y1, x2, y2 in ([] if lines is None else lines.reshape(-1, 4)):   # reshape: shape differs across OpenCV versions
    cv2.line(out, (x1, y1), (x2, y2), (0, 0, 255), 2)
out = out[:, :, ::-1]`)],
  FT05: [cell('Hough circles', `blur = cv2.medianBlur(img, 5)
circles = cv2.HoughCircles(blur, cv2.HOUGH_GRADIENT, dp=1, minDist=30,
                           param1=100, param2=30, minRadius=10, maxRadius=40)
print("Circles:", 0 if circles is None else circles.shape[1])

out = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
for x, y, r in ([] if circles is None else np.round(circles[0]).astype(int)):
    cv2.circle(out, (x, y), r, (0, 255, 0), 2)
out = out[:, :, ::-1]`)],

  G02: [cell('Translate and shear', `tx, ty, shear = 60, 0, 0.2
M = np.float32([[1, shear, tx],
                [0, 1,     ty]])
h, w = img.shape
out = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR,
                     borderMode=cv2.BORDER_REPLICATE)     # BORDER_CONSTANT = black, BORDER_REFLECT_101 = mirror`)],
  G03: [cell('Perspective fix from four corners', `# corners in order: top-left, top-right, bottom-right, bottom-left
src = np.float32([[68, 86], [497, 72], [527, 503], [40, 515]])
size = 450
dst = np.float32([[0, 0], [size, 0], [size, size], [0, size]])
M = cv2.getPerspectiveTransform(src, dst)
out = cv2.warpPerspective(img, M, (size, size))`, 'The corner numbers are the lab’s sudoku sample; read yours off the stage.')],
};
