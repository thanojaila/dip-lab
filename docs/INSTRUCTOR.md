# Instructor guide

DIP Lab is a student-made, local-only teaching aid. It has no LMS integration, no grading and no accounts. Switch on **Instructor mode** (top bar) to see this guide inside the page, including per-world notes. Every scenario uses the bundled photographs, so nothing needs to be uploaded.

## Scenarios

1. **10-minute live demo.** Open *Point operations*, concept **Gamma**, hero image *rocket*. Ask the class to predict what gamma 0.5 does to the night scene before pressing Run, then read the transfer curve. Repeat with **CLAHE** on the *retina* (green plane) and compare histograms.
2. **Noise clinic.** *Noise and smoothing*: add 8% salt-and-pepper to the *cameraman* (N02), press *Use result as input*, then run **Gaussian blur** (S02) and **Median** (S03). The scope table shows PSNR against the clean photo (about 24 dB against about 30 dB). The challenge is to beat 28 dB.
3. **Edge preservation.** *Keep the edges*: **Bilateral** on the *cat*. Compare the Gaussian thumbnail with the bilateral result around the whiskers, then raise σ color until bilateral turns into a Gaussian.
4. **Canny thresholds.** *Edges*: **Canny** on the *cameraman* with 100/200, then 20/40 (the grass floods with edges). Walk through the four-step strip: smooth, gradient, thin edges, hysteresis.
5. **Morphology story.** *Thresholds and morphology*: **Open** on *sheet music* with a 41×1 line keeps the staff; with 1×5 it keeps stems and heads. Then **Threshold and count** on the *coins*: 96 raw components, 24 after the area filter.
6. **Otsu vs adaptive on the sudoku page.** *Point operations* **Threshold and Otsu** on the *sudoku*: the shaded half goes black. Then **Adaptive threshold** in *Thresholds and morphology*: the whole grid is readable. Ask: what assumption did Otsu make?
7. **Why ideal filters ring.** *Frequency domain*: **Ideal vs Gaussian** on the *cameraman* at D0 = 30. Show the ripples beside the tripod and the table of values outside 0–255, then switch to the Gaussian mask.
8. **Homework warm-up.** Ask students to reproduce "gamma 0.5 on the rocket" and share the exported **config JSON**. The file holds only the concept id, parameters and an image id; it never contains image data.

## Segment guide

### pixels
- **Goal:** pixels are samples; gray conversion, interpolation and quantization throw information away.
- **Demo:** brick ÷ 6 with nearest then area (aliasing); cameraman at 4 gray levels (false contours); smarties hue mask (red wraps).
- **Discuss:** why do we average before shrinking? Why does red need two hue ranges?

### point
- **Goal:** point operations are lookup tables you can draw as a curve; they never use neighbours.
- **Demo:** brightness with clip off on the rocket (wrap-around); log on the Hubble image; Otsu on the cell versus the sudoku.
- **Discuss:** which of negative, gamma and log are invertible? What does clipping destroy?

### hist
- **Goal:** the histogram is a global summary; equalisation and CLAHE reshape it; matching copies another distribution.
- **Demo:** retina green plane: global equalisation washes out the optic disc, CLAHE does not.
- **Discuss:** why can two very different images share one histogram?

### noise
- **Goal:** linear filters average; the median ranks.
- **Demo:** the noise clinic above, with PSNR.
- **Discuss:** what does the median do to a 1-pixel line? How does σ relate to kernel size?

### sharpen
- **Goal:** smoothing and sharpening are two sides of one filter family; bilateral adds an intensity term.
- **Demo:** cat whiskers; circuit board versus the motion-blurred clock under unsharp masking.
- **Discuss:** why is sharpening a noisy image a bad idea?

### edges
- **Goal:** edges are large derivatives; Canny adds thinning and hysteresis.
- **Demo:** Sobel on the brick wall: Gx versus Gy; Canny threshold pairs.
- **Discuss:** which parameter controls clutter and which controls broken contours?

### morph
- **Goal:** thresholds make binary shapes; morphology acts with a structuring element, not a weighted sum.
- **Demo:** the morphology story and the sudoku scenario; top-hat before Otsu on the coins.
- **Discuss:** why is opening not the inverse of erosion? Why must the top-hat element be larger than the coins?

### freq
- **Goal:** the spectrum shows which waves an image contains; masks multiply it.
- **Demo:** brick, gravel and clock spectra; the ringing scenario.
- **Discuss:** why does a sharp cutoff in frequency ring in space?

### features
- **Goal:** template matching, corners, contours, lines and circles each answer a different question.
- **Demo:** cards template (rotated pips are missed); Hough accumulator on the sudoku; coins versus candies for circles.
- **Discuss:** which of these methods is rotation invariant? Why are SIFT, HOG and snakes explainer-only here?

### geometry
- **Goal:** affine and perspective maps, and what interpolation costs.
- **Demo:** rotate 30° in one pass and in six; straighten the sudoku page with four corners.
- **Discuss:** this world is syllabus-listed but covered lightly in the lab. How many point pairs define a perspective map?
