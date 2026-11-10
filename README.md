# DIP Lab

An interactive, **local-only** teaching lab for classical digital image processing. One scrolling page, guided segments, upload (or a built-in synthetic sample) → adjust parameters → **Run** → see **Original | Result | Diff** with a histogram, and read an **Exact transform** statement filled with your numbers.

> **Unofficial.** A student-made study aid. It is **not** a graded course project or Canvas submission, and **not** official University of Houston software. It makes no claim of instructor endorsement or course credit.

## Privacy

- Images are processed **only in your browser tab** (OpenCV.js compiled to WebAssembly). Nothing is uploaded.
- No accounts, no analytics, no trackers, no fingerprinting, no GPU.
- Exported config JSON contains technique id + parameters (+ optionally a built-in sample id). **Never pixels.**
- Only a list of finished segment ids may be kept in `localStorage` (try/catch-guarded; the page works without it).
- Production builds ship a strict CSP (same-origin only). It must allow `'unsafe-eval'` because the vendored OpenCV.js uses `new Function`; DIP Lab's own code does not use `eval`.

## What is in it (MVP)

| Segment | Techniques |
|---|---|
| 0 Foundations | F01 load/inspect · F02 gray · F03 resize/sampling · F04 quantization |
| 1 Point | P01 negative · P02 brightness (clip/wrap) · P03 contrast stretch · P04 log · P05 gamma · P06 threshold/Otsu |
| 2 Histogram | H01 histogram + CDF · H02 equalisation · H03 CLAHE |
| 3 Noise & smoothing | N01 Gaussian noise · N02 salt-and-pepper · S01 box · S02 Gaussian · S03 median |
| 4 Edge-preserving & sharpening | S04 bilateral · S05 unsharp · S06 Laplacian |
| 5 Edges | S08 Sobel · S07 Prewitt/Roberts (stretch) · E01 Canny |
| 6 Morphology | M01 erode/dilate · M02 open/close/gradient · M03 Otsu + component count |

Every card has parameter-effect notes, a misconception callout, and (per segment) a **predict → run → reveal** self-check. Also: ≥ 5 synthetic samples with "teaches…" blurbs, pin-to-compare, "use result as input" chaining, result PNG export, config JSON export/import, instructor mode, capability probe, and keyboard use (`Ctrl/Cmd+Enter` runs a card).

**Not in the browser MVP:** frequency domain (Phase 2), features such as Harris/template/Hough (stretch), and SIFT, HOG, snakes, neural nets (out; SIFT is never assumed and is reported as unavailable). A Web Worker for heavy ops is not implemented yet; bilateral warns when `d` is large.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + real-OpenCV algorithm tests (node)
npm run build      # type-check + static build in dist/
npm run preview    # serve dist/ locally
```

`dist/` is a fully static site: host it on GitHub Pages / Cloudflare Pages, or zip it and serve with any static server (`npx vite preview`, `python3 -m http.server -d dist`). First load downloads ~10 MB of OpenCV.js; browsers cache it afterwards. Chrome, Firefox, Edge work; Safari is best-effort.

## For instructors

See [`docs/INSTRUCTOR.md`](docs/INSTRUCTOR.md): six ready-made teaching scenarios (10-minute demo, noise clinic, edge preservation, Canny thresholds, morphology story, homework warm-up) plus per-segment goals, demos and discussion prompts. Switch on **Instructor mode** in the header to see them inside the page. There is no LMS integration or grade sync.

## For maintainers

See [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md) (pin OpenCV, add a technique via the registry, changelog).

## Licenses

App code: MIT (`LICENSE`). OpenCV.js: Apache-2.0 (`THIRD_PARTY_NOTICES.md`). Recommended course text for the theory: Gonzalez & Woods, *Digital Image Processing*, 4th ed. (not reproduced). No course PDFs, notebooks or images are included.
