import type { SelfCheckSpec } from '../core/types';

/**
 * Predict → run → reveal (SRS §6.3). The learner commits to an option first;
 * only then can the preset be run, and only after the run can the answer be revealed.
 */
export const SELF_CHECKS: Record<string, SelfCheckSpec> = {
  F04: {
    prompt: 'The ramp sample is a perfectly smooth 0→255 gradient. If we keep only L = 4 gray levels, what will the Result look like?',
    options: ['Still a smooth gradient, just a bit noisier', 'Four flat bands with hard steps between them', 'Almost entirely black', 'Unchanged'],
    correct: 1,
    preset: { sample: 'ramp', params: { levels: 4 } },
    explanation: 'Each pixel is mapped to one of only 4 values, so the gradient becomes 4 flat bands. Check the Exact panel: bin = ⌊r·4/256⌋. The Diff view shows the error is a sawtooth, not random noise.',
  },
  P02: {
    prompt: 'Brightness b = +100 with clip OFF is applied to the ramp. What happens to the brightest pixels (r ≈ 250)?',
    options: ['They stay white', 'They wrap around and become dark', 'They become mid-gray', 'They are clipped at 255 anyway'],
    correct: 1,
    preset: { sample: 'ramp', params: { b: 100, clip: false } },
    explanation: '250 + 100 = 350, and 350 mod 256 = 94, so the bright end turns dark. The Exact panel says "(r + b) mod 256". With clip ON the same input would saturate at 255 instead.',
  },
  P05: {
    prompt: 'You apply gamma γ = 0.5 to the low-contrast scene. Which description is right?',
    options: ['Midtones get brighter; black and white stay put', 'Everything gets darker', 'Only the brightest pixels change', 'Black becomes gray'],
    correct: 0,
    preset: { sample: 'low-contrast', params: { gamma: 0.5 } },
    explanation: 's = 255·(r/255)^0.5. A value of 0 stays 0 and 255 stays 255, but the middle bends upward (r = 64 → ≈128). Everything in this scene sits in the dark half, so the whole picture lifts.',
  },
  H02: {
    prompt: 'After global histogram equalisation of the low-contrast scene, how will the occupied gray range compare to before?',
    options: ['Narrower', 'Spread across nearly the full 0–255 range', 'Identical', 'Only the dark half is used'],
    correct: 1,
    preset: { sample: 'low-contrast', params: {} },
    explanation: 'Equalisation remaps levels through the cumulative histogram, so a narrow band is stretched over nearly the whole range. The histogram panel shows min and max moving apart. Gaps between bins remain: levels were moved, not created.',
  },
  S03: {
    prompt: 'The salt-and-pepper sample has 8% fully black/white pixels. What does a 3×3 median do to those dots?',
    options: ['Turns each dot into a gray blur', 'Removes almost all of them', 'Makes them larger', 'Does nothing'],
    correct: 1,
    preset: { sample: 'impulse-noise', params: { k: 3 } },
    explanation: 'An isolated outlier is the largest or smallest of the 9 values in its window, so the median picks a neighbour instead. A box or Gaussian filter would average the outlier in and leave a gray smudge. Try S02 on the same input to see the difference.',
  },
  S04: {
    prompt: 'On the noisy step edge, bilateral (σ_color = 30) vs Gaussian blur of similar strength: what happens at the edge?',
    options: ['Bilateral keeps the step sharp and still smooths flat areas', 'Bilateral blurs the edge more than Gaussian', 'Both are identical', 'Bilateral removes the edge'],
    correct: 0,
    preset: { sample: 'step-edge', params: { d: 9, sigmaColor: 30, sigmaSpace: 50 } },
    explanation: 'The edge is a 90-level jump, far larger than σ_color = 30, so pixels across it get almost zero weight. Flat areas (noise ≈ ±10) fall under σ_color and are averaged. Raise σ_color to 200 and watch it turn into a Gaussian.',
  },
  E01: {
    prompt: 'Canny with very low thresholds (low 10, high 20) on the slightly noisy shapes image. What do you expect?',
    options: ['Clean outlines of just the shapes', 'Outlines plus lots of clutter from noise and gradients', 'Nothing at all', 'Only the colored circle'],
    correct: 1,
    preset: { sample: 'shapes', params: { t1: 10, t2: 20, l2: false, preblur: 0 } },
    explanation: 'With such low thresholds almost any small gradient (including noise) counts as an edge, so the map fills with specks. Try 50/150 for clean outlines, or add a pre-blur of 5.',
  },
  M02: {
    prompt: 'Opening with a 5×5 ellipse is applied to the particle image (binarised with Otsu). What happens to the 1–2 px bright specks and the large blobs?',
    options: ['Specks removed; large blobs roughly kept', 'Specks kept; blobs removed', 'Everything removed', 'Everything grows'],
    correct: 0,
    preset: { sample: 'blobs', params: { op: 'open', shape: 'ellipse', k: 5, iters: 1, binarize: true } },
    explanation: 'Erosion deletes anything smaller than the structuring element; dilation then regrows the survivors back to about their original size. Specks are gone for good, blobs are restored. Closing would instead fill small dark holes.',
  },
};
