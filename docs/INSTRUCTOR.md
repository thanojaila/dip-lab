# Instructor guide

DIP Lab is a student-made, local-only teaching aid. It has no LMS integration, no grading and no accounts. Switch on **Instructor mode** (header) to see this guide inside the page, including per-segment notes.

## Scenarios

1. **10-minute live demo.** Load the *Low-contrast scene* sample. Ask the class to predict what gamma 0.5 will do, then Run P05. Repeat with CLAHE (H03) and compare the histograms.
2. **Noise clinic.** Add salt-and-pepper noise (N02, 10%), press *Use Result as input*, then run Gaussian blur (S02) and pin the result; run the median filter (S03) and compare the pinned pane with the new Result.
3. **Edge preservation.** Load the *Noisy step edge*. Run Gaussian blur (S02, k 9, σ 3), pin it, then bilateral (S04) with σ color 30, then 200. Ask when bilateral stops protecting the edge.
4. **Canny thresholds.** Same image (*Colored shapes*), three presets: 10/20, 50/150, 100/200. Discuss clutter versus broken contours, then add a pre-blur.
5. **Morphology story.** *Particles with speckles*: Otsu (P06), opening (M02) removes the speckles, closing fills the holes, gradient outlines the blobs, then count them with M03.
6. **Homework warm-up.** Ask students to reproduce "gamma = 0.5 on the low-contrast sample" and share the exported **config JSON**. The file holds only technique id, parameters and a sample id; it never contains image data.

## Segment guide

### foundations
- **Goal:** pixels are samples; gray conversion and quantization throw information away.
- **Demo:** checkerboard + nearest at scale 0.25, then area; ramp at L = 4.
- **Discuss:** why do we resize with INTER_AREA when shrinking? Where do false contours come from?

### point
- **Goal:** point operations are lookup tables; they never use neighbours.
- **Demo:** brightness with clip off on the ramp (wrap-around), gamma on the low-contrast sample.
- **Discuss:** which of negative, gamma, log is invertible? What does clipping destroy?

### histogram
- **Goal:** the histogram is a global summary; equalisation and CLAHE reshape it.
- **Demo:** equalise the low-contrast sample and watch the CDF straighten; raise the CLAHE clip limit until noise appears.
- **Discuss:** why do two very different images share the same histogram?

### noise
- **Goal:** linear filters average; median ranks.
- **Demo:** the noise clinic scenario above.
- **Discuss:** what does the median do to a 1-pixel-wide line? How does σ relate to kernel size?

### sharpen
- **Goal:** smoothing and sharpening are two sides of the same filter family; bilateral adds an intensity term.
- **Demo:** step edge with bilateral σ color 30 vs 200; unsharp amount sweep to show halos.
- **Discuss:** why is sharpening noisy images a bad idea?

### edges
- **Goal:** edges are large derivatives; Canny adds thinning and hysteresis.
- **Demo:** Sobel on the shapes sample, then Canny with three threshold pairs.
- **Discuss:** which parameter controls clutter, and which controls broken contours?

### morphology
- **Goal:** morphological operators act with a structuring element, not a weighted sum.
- **Demo:** the morphology story scenario above.
- **Discuss:** why is opening not the inverse of erosion?

### beyond
- **Goal:** know what the browser build deliberately leaves out.
- **Discuss:** which course lab (Python) covers frequency-domain filtering? Why is SIFT absent from the default OpenCV.js build?
