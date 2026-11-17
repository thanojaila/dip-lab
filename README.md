# DIP Lab

**Live: https://thanojaila.github.io/dip-lab/**

DIP Lab is a free, in-browser playground for learning **classical digital image processing**. Instead of reading about a filter, you open a real photograph, press a button, and watch what the algorithm does to the pixels. It covers 44 techniques from "what is a pixel?" to Canny edges, morphology, the Fourier transform and Hough circles.

Everything runs in your browser tab. There is no server, no account, and your images never leave your computer.

> **Unofficial.** A student-made study aid. It is not a graded course project and not official University of Houston software, and it makes no claim of instructor endorsement or course credit.

## What it does

Pick a concept (for example *Median filter*) and the lab opens on a photograph chosen because it **shows the problem** that technique solves: a photo full of salt-and-pepper noise for the median filter, a skewed sudoku page for perspective correction, a washed-out retina for histogram equalisation.

From there you can:

- **Predict, then reveal.** Commit to a guess about what will happen, then press **Show me**.
- **Compare before and after** by dragging a divider across the image, or switch to side-by-side, a difference map (×1, ×4, ×8), or an overlay of detected points, lines, circles and contours.
- **Read the real pixel numbers.** Hover over the image to see the 9×9 grid of actual values, original next to result.
- **See the exact maths with your own numbers.** An *Exact transform* line states the formula the lab just ran, filled in with your parameters, for example `bin = ⌊r·8/256⌋, out = round(bin·255/(8−1))`.
- **Use your own image.** Drop in any photo, get a short check-up of its statistics with suggested techniques, and press **Try this on my image** on any card.
- **Chain steps.** Add noise, then smooth it, then sharpen it, with undo, and promote any result to be the next input.
- **Take on challenges.** For example: beat 28 dB PSNR on a noisy photo, count exactly 24 coins, or find all 12 candies. They are checked automatically.
- **Copy the Python.** Every concept has a Colab-ready code cell (OpenCV, NumPy, Matplotlib) that reproduces what the lab did, so you can take it into a notebook. All cells are written for this lab.

Alongside the image there are small instruments that explain what is happening: histogram with cumulative curve, transfer curve with the inspected pixel marked, a draggable frequency-spectrum cutoff, heat maps for template matching and the Hough accumulator, and a numbers table (PSNR, object counts). Kernel and structuring-element explainers animate the "neighbourhood × weights = output" idea.

## The ten worlds

| World | What you explore |
|---|---|
| 0 Pixels | load and inspect, colour to gray, channels and HSV, interpolation, aliasing, quantization |
| 1 Point operations | negative, brightness (clip vs wrap-around), contrast stretch, log, gamma, threshold and Otsu |
| 2 Histograms | histogram and CDF, equalisation, CLAHE, histogram matching |
| 3 Noise and smoothing | Gaussian and salt-and-pepper noise; box, Gaussian and median filters |
| 4 Keep the edges, sharpen | bilateral filter, unsharp mask, Laplacian sharpening |
| 5 Edges | Sobel, Prewitt and Roberts, Canny |
| 6 Thresholds and morphology | adaptive threshold, erode and dilate, open, close and gradient, counting objects, top-hat and black-hat |
| 7 Frequency domain | DFT spectrum, low-pass, high-pass, ideal vs Gaussian (ringing) |
| 8 Features and shapes | template matching, Harris corners, contours, Hough lines and circles |
| 9 Geometry | rotate and scale, translate and shear, perspective correction |

That is 44 runnable concepts. SIFT, HOG and active contours appear as explainer-only cards: the idea is described, clearly labelled "runs in Python", and never faked with a demo.

You earn a stamp on each concept by running its demo and making a prediction. Progress is a simple world map.

## Privacy

- Images are processed only in your browser (OpenCV.js compiled to WebAssembly). Nothing is uploaded.
- No accounts, analytics, trackers, CDNs or remote fonts. The page only loads its own static files.
- Exported settings files contain a concept id and parameters, never pixels.
- Only your stamps and challenge results are remembered, in your browser's `localStorage`. **Reset my progress** clears them.

## Built with

TypeScript and Vite, with [OpenCV.js](https://opencv.org) 4.10 doing the image processing in WebAssembly. Heavy operations (DFT, Hough, large bilateral filters) run in a Web Worker with a cancel button. The test suite runs every demo on its real image against the real OpenCV.js build.

## Run it yourself

```bash
npm ci
npm run dev       # http://localhost:5173
npm test
npm run build     # static site in dist/
```

`dist/` is a plain static site that works on GitHub Pages or any static host. The first load downloads about 10 MB of OpenCV.js, which the browser caches. Chrome, Firefox and Edge work; Safari is best-effort.

## More documentation

- [`docs/INSTRUCTOR.md`](docs/INSTRUCTOR.md): teaching scenarios and discussion prompts. Turn on **Instructor** in the top bar to see them inside the page.
- [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md): how to add an image or a concept.

## Licences and credits

App code: MIT. OpenCV.js: Apache-2.0. Fonts (Baloo 2, Nunito, JetBrains Mono): SIL OFL 1.1. The 24 bundled photographs are openly licensed; credits are on the app's attribution page and in `public/samples/ATTRIBUTION.md`. No course slides, notebooks, code or images are included. See `THIRD_PARTY_NOTICES.md`.
