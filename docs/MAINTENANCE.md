# Maintenance

## Pinned engine
OpenCV.js **4.10.0** via `@techstark/opencv-js@4.10.0-release.1`, vendored at `public/opencv/opencv.js` (same origin, no CDN). To upgrade: bump the dev dependency, `cp node_modules/@techstark/opencv-js/dist/opencv.js public/opencv/opencv.js`, update `OPENCV_VERSION` in `src/core/opencvLoader.ts` and `THIRD_PARTY_NOTICES.md`, then run `npm test` (it runs every API and every hero demo against the real library) and the browser checks below. Do not swap the build without saying so: the probe list (`requiredCvApis`) decides which cards render as Unavailable.

## Add an image
1. Put the file in `public/samples/images/` (PNG or JPEG, longest side ≤ 1024). Only openly licensed images, never photos of identifiable people, never course images.
2. Add an entry to `public/samples/manifest.json`: `id`, `file`, `width`, `height`, `mode` (`gray` or `rgb`), `bytes`, `licence`, `credit`, `origin`, `teaches` (one line), `techniques` (concept ids it suits).
3. Add a row to `public/samples/ATTRIBUTION.md` (the attribution page is generated from the manifest).
4. `npm run build` (generates `public/samples/thumbs/<id>.png`), then `npm test`: the manifest tests check the file exists, decodes at the declared size, has licence/credit, a thumbnail and an attribution row.
5. To make it a concept's hero, set `heroImage`/`alsoGoodOn` in `src/registry/techniques.ts`.

## Add a concept
1. **Algorithm:** add a runner `(ctx) => RunResult` to the matching file in `src/alg/` and register it in `RUNNERS` in `src/registry/techniques.ts`. Rules: never delete `ctx.input` / `ctx.rgba` / `ctx.reference`; delete every temporary `cv.Mat`/`MatVector` in `finally`; return a new 8UC1/8UC3 `mat` (the caller deletes it). Optional extras: `overlay` (shapes), `metrics`, `intermediates`, `curve`, `spectrum`, `heatmap`, `summary`.
2. **Spec:** add a definition to `DEFS` (id, title, segment = world id, tier, params, `requiredCvApis`, blurb, `heroImage`, `heroParams`, optional `heroPipeline`, `needs`, `scope`, `explainer`, `challenge`) and the id is picked up in display order from `DEFS`.
3. **Content (all required, tests enforce them):** `QUESTIONS` (opening question), `EXACT` template (`Exact: … Parameters: … Domain: … Border: … Display mapping: …`, every `{name}` filled from vars or params), `EFFECT_NOTES` (3–5 bullets), `MISCONCEPTIONS` ("Watch out: …"), `SELF_CHECKS` (predict-then-reveal; defaults to the hero demo).
4. **Tests:** `tests/hero.test.ts` already runs every hero demo on its real image; add a directional assertion for the behaviour you teach (tolerance bands, not exact numbers).
5. Add it to a scenario or world note in `docs/INSTRUCTOR.md` if it belongs there.

Heavy operations: set `heavy: true` and the app runs it in the Worker (`src/worker/cvWorker.ts`, a classic worker that loads its own OpenCV.js). In `npm run dev` Workers are not used (the worker format differs); use `npm run preview` to test them.

New world: add it to `src/registry/segments.ts` and a `### <world-id>` block under "Segment guide" in `docs/INSTRUCTOR.md`.

## Capability probe
`src/core/capability.ts` + each concept's `requiredCvApis`. A concept whose APIs are missing renders as **Unavailable** with the missing names. Never assume `cv.SIFT`. `cv.idft` is absent in the 4.10 build: use `cv.dft` with `DFT_INVERSE | DFT_SCALE | DFT_REAL_OUTPUT`.

## Release checklist
- `npm ci && npm test && npm run build`
- `npm run preview`, then in a real browser: the engine loads, run every card's **Show me** (including the Worker-backed ones), upload an image and run **Try this on my image**, check there are no console errors and no requests to other origins.
- Run an axe audit in both themes and at 390 px width (a clean result was recorded for 2.0.0).
- Confirm no analytics, remote fonts or course binaries were added.
- Update the changelog and `APP_VERSION` in `src/core/types.ts` (config JSON carries it; majors 1 and 2 import).

## Changelog
- **2.0.0** – Playful image-first redesign: 24 bundled photographs, before/after stage with pixel inspector, scopes and explainers, worlds 0–9 (adds colour/HSV, aliasing, adaptive threshold, top-hat, histogram matching, frequency domain, template matching, Harris, contours, Hough lines/circles, geometry), stamps/challenges/world map, image check-up, Worker for heavy operations, explainer-only SIFT/HOG/active contours.
- **1.0.0** – MVP: 27 techniques in 7 segments, guided path, exact-transform panel, self-checks, instructor mode, PNG + config export/import, capability probe.

## Known limits
- The eight OpenCV sample images record no original photographer (see `ATTRIBUTION.md`). If a strictly documented set is needed, drop them and use the fallbacks listed in the v2 handoff.
- Cancel terminates the Worker; its OpenCV copy reloads (about a second) on the next heavy run.
- OpenCV.js can differ slightly from OpenCV-Python; tests assert direction and tolerance bands.
