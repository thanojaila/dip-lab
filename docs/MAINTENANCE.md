# Maintenance

## Pinned engine
OpenCV.js **4.10.0** via `@techstark/opencv-js@4.10.0-release.1`, vendored at `public/opencv/opencv.js` (served from the same origin; no CDN). To upgrade: bump the dev dependency, `cp node_modules/@techstark/opencv-js/dist/opencv.js public/opencv/opencv.js`, update `OPENCV_VERSION` in `src/core/opencvLoader.ts` and `THIRD_PARTY_NOTICES.md`, then run `npm test` (it exercises every API against the real library) and the browser smoke check below.

## Add a technique (FR-20)
1. **Algorithm:** add a runner `(ctx) => { mat, vars, warnings? }` to the matching file in `src/alg/` (or a new one) and register it in the `RUNNERS` map in `src/registry/techniques.ts`. Rules: never delete `ctx.input` / `ctx.rgba`; delete every temporary `cv.Mat` in `finally`; return a new 8UC1 or 8UC3 `mat` (the app deletes it).
2. **Spec:** add a definition to `DEFS` (id, title, segment, tier, params, `requiredCvApis`, blurb, `sampleHint`) and its id to `ORDER`.
3. **Exact template:** add `EXACT[id]` in `src/exact/templates.ts` following `Exact: … Parameters: … Domain: … Border: … Display mapping: …`. Every `{name}` must come from `vars` or a param (tests fail on unresolved names).
4. **Notes:** 3–5 bullets in `src/notes/effects.ts`; a misconception in `src/notes/misconceptions.ts`; optionally a self-check in `src/notes/selfchecks.ts` (preset must reference a real sample and in-range params).
5. **Tests:** `npm test` already runs every registered technique in gray and RGB on its sample; add a correctness assertion to `tests/alg.test.ts`.
6. Add the technique to `docs/INSTRUCTOR.md` if it belongs in a scenario.

New segment: add it to `src/registry/segments.ts` and a `### <segment-id>` block under "Segment guide" in `docs/INSTRUCTOR.md`.

## Capability probe
`src/core/capability.ts` lists the APIs probed at start-up. A technique whose `requiredCvApis` are missing renders as **Unavailable** with the missing names. Never assume `cv.SIFT`.

## Release checklist
- `npm test && npm run build`
- Serve `dist/` and load it in a real browser: engine loads, a card runs, no console errors (CSP is active in the build).
- Confirm no course binaries or analytics were added (`git grep -il "analytics\|gtag"`, check `public/`).
- Update the changelog below and `APP_VERSION` in `src/core/types.ts` (config JSON carries it; a different major version is rejected on import).

## Changelog
- **1.0.0** – MVP: 27 techniques in 7 segments, guided path, exact-transform panel, self-checks, instructor mode, PNG + config export/import, capability probe.

## Known limits / roadmap
- No Web Worker yet (NFR-05 optional); bilateral with large `d` on big images can take seconds.
- Phase 2: frequency domain (Q01–Q04). Stretch: histogram matching, Harris, template matching, contours, Hough.
- OpenCV nondeterminism: none known for the shipped operators on a given build; noise uses an in-app seeded PRNG, not OpenCV's RNG.
