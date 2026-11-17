# DIP Lab v2

A playful, image-first, **local-only** lab for classical digital image processing. Every concept opens on a real photograph chosen because it *shows the problem*; you predict, press **Show me**, drag a before/after divider, hover the image to read the actual pixel numbers, and read an **Exact transform** statement filled with your own parameters. Everything also works on **your own uploaded image**.

> **Unofficial.** A student-made study aid. It is **not** a graded course project or Canvas submission, and **not** official University of Houston software. It makes no claim of instructor endorsement or course credit.

## What is in it

- **10 worlds, 44 runnable concepts, 3 explainer-only cards** (47 stamps in all):

| World | Concepts |
|---|---|
| 0 Pixels | F01 load/inspect · F02 colour→gray · C01 channels and HSV · F03 interpolation · F05 aliasing · F04 quantization |
| 1 Point operations | P01 negative · P02 brightness (clip vs wrap) · P03 contrast stretch · P04 log · P05 gamma · P06 threshold/Otsu |
| 2 Histograms | H01 histogram+CDF · H02 equalisation · H03 CLAHE · H04 histogram matching |
| 3 Noise and smoothing | N01 Gaussian noise · N02 salt-and-pepper · S01 box · S02 Gaussian · S03 median (with PSNR and a challenge) |
| 4 Keep the edges, sharpen | S04 bilateral · S05 unsharp · S06 Laplacian |
| 5 Edges | S08 Sobel (Gx/Gy/magnitude) · S07 Prewitt/Roberts · E01 Canny (four-step strip) |
| 6 Thresholds and morphology | T01 adaptive threshold · M01 erode/dilate · M02 open/close/gradient · M03 threshold+count · M04 top-hat/black-hat |
| 7 Frequency domain | Q01 DFT spectrum · Q02 low-pass · Q03 high-pass · Q04 ideal vs Gaussian (ringing) |
| 8 Features and shapes | FT01 template matching · FT02 Harris · FT03 contours · FT04 Hough lines · FT05 Hough circles · SIFT, HOG, active contours (explainer-only) |
| 9 Geometry (covered lightly) | G01 rotate/scale · G02 translate/shear · G03 perspective fix |

- **24 bundled photographs** with licence and credit (`public/samples/manifest.json`), plus three generated test patterns.
- **Stage:** before/after slider (keyboard operable), side by side, diff (×1/×4/×8), overlay (points, lines, circles, boxes, contours), **pixel inspector** (9×9 numbers, original and result), pipeline chips with undo, drag-and-drop upload.
- **Scopes:** histogram (before/after, CDF), transfer curve with the inspected pixel marked, draggable spectrum cutoff, heat map (match scores, Hough accumulator), numbers table (PSNR, counts).
- **Explainers:** kernel weights with "neighbourhood × weights = output", structuring element with fit/hit animation, step strips.
- **Progress:** a stamp per concept for running its demo and committing to a prediction; auto-checked challenges (e.g. PSNR above 28 dB, count exactly 24 coins, find all 12 candies); a world map. Stored only in `localStorage`, with **Reset my progress**.
- **Image check-up** after upload (local statistics → friendly, hedged suggestions that link to concepts), and **Try this on my image** on every card.
- Config JSON export/import (parameters only; v1 files still import), result PNG export, instructor mode, capability probe, light/dark theme, Worker for heavy operations (DFT, Hough, large bilateral) with a cancel button.

**Deliberately not in the browser:** SIFT, HOG and active contours. They have explainer-only cards (the idea in original words, labelled "runs in Python") and never a fake demo. `cv.SIFT` is probed and reported unavailable; `cv.idft` is not exported by the vendored build, so inverse transforms use `cv.dft` with `DFT_INVERSE`.

## Privacy

- Images are processed **only in your browser tab** (OpenCV.js compiled to WebAssembly). Nothing is uploaded.
- No accounts, analytics, trackers, remote fonts, CDNs or fingerprinting. The app makes no network requests other than loading its own static files.
- Exported config JSON contains a concept id + parameters (+ optionally a bundled image id). **Never pixels.**
- Only stamps and challenge results are stored (`localStorage`, one key, guarded by try/catch; the page works without it).
- The production build ships a strict CSP (same-origin only). It must allow `'unsafe-eval'` because the vendored OpenCV.js uses `new Function`; DIP Lab's own code does not use `eval`.

## Run it

```bash
npm ci
npm run dev        # http://localhost:5173 (heavy ops run on the main thread in dev)
npm test           # 270+ tests, including every demo on its real image against the real OpenCV.js
npm run build      # thumbnails + type-check + static build in dist/
npm run preview    # serve dist/ locally (CSP and Workers active)
```

`dist/` is a fully static site: GitHub Pages, Cloudflare Pages, or any static server. First load downloads ~10 MB of OpenCV.js (cached afterwards). Chrome, Firefox and Edge work; Safari is best-effort.

## For instructors

[`docs/INSTRUCTOR.md`](docs/INSTRUCTOR.md): eight scenarios (10-minute demo, noise clinic, edge preservation, Canny thresholds, morphology story, **Otsu vs adaptive on the sudoku page**, **why ideal filters ring**, homework warm-up) plus per-world goals, demos and discussion prompts. Turn on **Instructor** in the top bar to see them inside the page. No LMS integration or grade sync.

## For maintainers

[`docs/MAINTENANCE.md`](docs/MAINTENANCE.md): pin OpenCV, add an image, add a concept, release checklist, changelog.

## Licenses

App code: MIT. OpenCV.js: Apache-2.0. Fonts (Baloo 2, Nunito, JetBrains Mono): SIL OFL 1.1 via Fontsource. Images: see the attribution page and `public/samples/ATTRIBUTION.md`. No course PDFs, notebooks or images are included. See `THIRD_PARTY_NOTICES.md`.

## Deploy to GitHub Pages

The build is fully static and uses relative paths (`base: './'`), so it works from any sub-path such as `https://<user>.github.io/<repo>/`. OpenCV.js, fonts and the sample photos are all bundled; nothing is fetched from the internet.

1. Push this folder to a GitHub repo whose default branch is `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the workflow manually). `.github/workflows/pages.yml` runs the tests, builds, and publishes `dist/`.

To host elsewhere or test locally: `npm run build`, then serve the `dist/` folder with any static server.
