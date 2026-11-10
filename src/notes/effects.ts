/** What turning each parameter up does visually (FR-09: 3–5 bullets each). Original wording. */
export const EFFECT_NOTES: Record<string, string[]> = {
  F01: [
    'Every upload is shrunk so its longest side is at most 1024 px; this keeps every filter fast on a laptop.',
    'Shrinking uses INTER_AREA, which averages the source pixels each output pixel covers, so thin lines do not shimmer.',
    'The pixel count is what every later cost estimate refers to: filters scale with width × height.',
  ],
  F02: [
    'Gray is a weighted sum: green counts most (0.587) because human vision is most sensitive there.',
    'A plain average (R+G+B)/3 would make saturated blue and red look brighter than they feel.',
    'All later segments can work on gray (default) or RGB; switch with the "Work in grayscale" toggle.',
  ],
  F03: [
    'Scale < 1 throws pixels away; scale > 1 invents them by interpolation.',
    'Nearest keeps hard blocky edges; linear is smooth but softer; cubic is crisper and can ring near edges.',
    'Compare Original and Result at the same screen size: the pixel grid is easiest to see with nearest at scale 4.',
    'INTER_AREA is the right choice for shrinking because it averages instead of skipping pixels.',
  ],
  F04: [
    'Fewer levels L means fewer distinct gray values: L = 2 is a pure black/white poster.',
    'False contours (visible bands) appear in smooth gradients well before the image looks "noisy".',
    'Around 32 levels most photos still look fine; the ramp sample shows bands first.',
  ],
  P01: [
    'Dark becomes bright and bright becomes dark; mid-gray 128 stays almost where it is.',
    'Useful for seeing fine bright-on-dark detail the way a radiologist would.',
    'Applying it twice gives back the original exactly, so Diff after a double negative is black.',
  ],
  P02: [
    'Raising b slides every value up; with clip ON, values pile up at 255 and highlights lose detail.',
    'Lowering b below 0 pushes shadows into pure black the same way.',
    'Turn clip OFF to see the uint8 wrap-around bug: bright pixels jump to dark.',
  ],
  P03: [
    'Raising p_low (or lowering p_high) clips more pixels to 0 or 255 and boosts contrast in the middle.',
    'Using percentiles instead of min/max stops one stray hot pixel from ruining the stretch.',
    'An image that already spans 0–255 does not change; try the low-contrast sample.',
  ],
  P04: [
    'Raising α strengthens the effect: dark regions are lifted, bright regions are compressed.',
    'The log curve is steepest near 0, so shadow detail gains the most.',
    'It cannot create detail that quantisation already erased; dark noise gets lifted too.',
  ],
  P05: [
    'γ < 1 brightens midtones and opens up shadows; γ > 1 darkens midtones.',
    'Black (0) and white (255) never move for any γ, only the middle bends.',
    'γ = 1 is the identity, so Diff should be completely black.',
  ],
  P06: [
    'Raising T turns more pixels black (fewer values exceed the threshold).',
    'Otsu picks T for you from the histogram; it works best when the histogram has two clear humps.',
    'Uneven lighting breaks any single global threshold.',
  ],
  H01: [
    'A narrow histogram means low contrast; a histogram hugging the left means a dark image.',
    'The CDF is the running total: a steep CDF segment means many pixels share those levels.',
    'Gaps ("comb" pattern) after contrast changes show that levels were stretched apart, not created.',
  ],
  H02: [
    'Equalisation spreads popular gray levels apart so the CDF becomes a straight line.',
    'Flat regions and noise get amplified because they occupy many pixels.',
    'It is global: one mapping for the whole image, so a bright corner can still wash out detail elsewhere.',
  ],
  H03: [
    'Raising clip limit allows more local contrast but also more noise amplification.',
    'More tiles means more local adaptation; too many tiles and each tile sees too little to be stable.',
    'Tile borders are blended, so you should not see a grid; if you do, lower the clip limit.',
  ],
  N01: [
    'Raising σ makes the grain stronger; σ = 25 is clearly visible on a flat area.',
    'The same seed always gives the same noise, so results are reproducible and shareable.',
    'Noise is clipped at 0 and 255, so very dark/bright regions look less noisy than they should.',
  ],
  N02: [
    'Raising the amount adds more isolated black and white dots.',
    'Each corrupted pixel is completely wrong, unlike Gaussian noise where every pixel is slightly wrong.',
    'Averaging filters smear each dot into a gray blotch; ranking filters can throw it away.',
  ],
  S01: [
    'Raising k blurs more and costs more; every pixel in the window counts equally.',
    'Edges soften and also grow a faint "plateau" look because the box is a hard-edged kernel.',
    'Noise is reduced by roughly the window area, but so is detail.',
  ],
  S02: [
    'Raising σ blurs more; raising k only helps while the window is still narrower than about 6σ.',
    'Center pixels count more than far ones, so edges stay a bit more natural than with a box.',
    'Setting σ = 0 lets OpenCV choose σ from k.',
  ],
  S03: [
    'Raising k removes larger specks but starts deleting thin lines and sharp corners.',
    'The output is always an existing pixel value, so no new gray levels appear.',
    'Edges stay sharp: a median across a step edge picks one side, not a blend.',
  ],
  S04: [
    'Raising σ_color lets more different-looking neighbours mix; large values make it behave like a Gaussian blur.',
    'Raising σ_space widens how far neighbours can reach (together with d).',
    'Raising d enlarges the neighbourhood and the run time, roughly quadratically.',
    'Small σ_color keeps edges perfectly crisp but leaves noise untouched.',
  ],
  S05: [
    'Raising k adds more of the detail layer (f − blurred) back in, so edges look crisper.',
    'Raising σ targets coarser detail; small σ sharpens fine texture.',
    'Too much k creates bright/dark halos beside edges and amplifies noise.',
  ],
  S06: [
    'It adds back the Laplacian (second derivative) so edges gain overshoot on both sides.',
    'The 8-neighbour version is stronger and also boosts diagonal detail.',
    'It has no parameters to tune, so noise gets amplified a lot; smooth first if the input is noisy.',
  ],
  S08: [
    'Larger ksize averages across more rows before differencing, so it is smoother and less noisy but thicker.',
    'Edge strength is shown relative to the strongest edge in the image, not an absolute scale.',
    'It responds to every intensity change, including noise, so you see a thick cloud of weak edges.',
  ],
  S07: [
    'Prewitt is Sobel without the extra weight on the center row; it is a bit more sensitive to noise.',
    'Roberts uses 2×2 diagonal differences: very sharp, very noisy, and shifts the edge by half a pixel.',
    'All three (Sobel, Prewitt, Roberts) are small convolutions; only the weights differ.',
  ],
  E01: [
    'Raising the high threshold keeps only the strongest edges; the picture gets cleaner and more broken.',
    'Raising the low threshold reduces how far weak edges can extend from a strong one.',
    'Edges are exactly 1 pixel thick because of non-maximum suppression.',
    'A pre-blur removes noise edges before detection; too much blur loses fine edges and rounds corners.',
  ],
  M01: [
    'Erosion shrinks bright regions and removes small bright specks; dilation grows them and fills small dark holes.',
    'A bigger SE or more iterations changes the result more, and removes larger features.',
    'The SE shape matters: a rectangle favors axis-aligned shapes, an ellipse is more rotation-neutral.',
  ],
  M02: [
    'Opening removes small bright objects/specks while keeping the size of larger ones.',
    'Closing fills small dark holes and gaps between bright objects.',
    'Gradient (dilation − erosion) draws a boundary about one SE wide around each object.',
  ],
  M03: [
    'Raising min area deletes more of the tiny components (usually noise).',
    'Counts depend on the binarisation: a bad threshold merges or splits particles.',
    '8-connectivity treats diagonal neighbours as touching; 4-connectivity would count more pieces.',
  ],
};
