/**
 * Course Colab code behind each concept. The `code` strings are copied verbatim from the
 * class-activity notebooks, so a learner can compare "the cell I ran in Colab" with the
 * in-browser result. Only concepts that have a real notebook cell appear here.
 */
export interface ColabSnippet {
  notebook: string;
  cell: string;
  code: string;
  note?: string;
}

const LOAD = `import cv2
import numpy as np
import matplotlib.pyplot as plt

# Load Lena as a grayscale image
img = cv2.imread("lena.jpg", cv2.IMREAD_GRAYSCALE)

if img is None:
    raise FileNotFoundError("Place lena.jpg in the same folder as this notebook.")

print("Image shape:", img.shape)
print("Number of pixels:", img.size)
print("Intensity range:", img.min(), "to", img.max())`;

export const COLAB: Record<string, ColabSnippet[]> = {
  F01: [
    { notebook: 'Class_Activity_Quantization.ipynb', cell: 'Cell 1: load and inspect', code: LOAD, note: 'The lab shows shape and pixel count in the Exact panel; the intensity range is in the histogram scope.' },
    {
      notebook: 'image_read_write.ipynb',
      cell: '1. Read the image',
      code: `img = Image.open(INPUT_PATH)
img.load()  # force read

print(f"Format: {img.format}")
print(f"Mode:   {img.mode}")
print(f"Size:   {img.size}  (width x height)")`,
    },
  ],
  F02: [
    {
      notebook: 'image_read_write.ipynb',
      cell: '3. Transform: grayscale',
      code: `gray = img.convert("L")

plt.figure(figsize=(6, 6))
plt.imshow(gray, cmap="gray")
plt.axis("off")
plt.title("Grayscale")
plt.show()`,
      note: 'PIL convert("L") uses 0.299R + 0.587G + 0.114B, the same weights as cv.COLOR_RGBA2GRAY here.',
    },
  ],
  F03: [
    {
      notebook: 'Class_Activity_Interpolation.ipynb',
      cell: 'Cell 1: nearest / linear / cubic on a 2×2 image',
      code: `import cv2
import numpy as np
import matplotlib.pyplot as plt

# Tiny image so we can inspect the actual pixel values
tiny = np.array([
    [100, 140],
    [120, 160]
], dtype=np.uint8)

nearest_tiny = cv2.resize(tiny, (6, 6), interpolation=cv2.INTER_NEAREST)
linear_tiny  = cv2.resize(tiny, (6, 6), interpolation=cv2.INTER_LINEAR)
cubic_tiny   = cv2.resize(tiny, (6, 6), interpolation=cv2.INTER_CUBIC)

print("Original 2x2 image:")
print(tiny)

print("\\nNearest Neighbor:")
print(nearest_tiny)

print("\\nBilinear:")
print(linear_tiny)

print("\\nBicubic:")
print(cubic_tiny)`,
      note: 'Use the pixel inspector on the Result to read the same kind of numbers on a real photo.',
    },
    {
      notebook: 'Class_Activity_Interpolation.ipynb',
      cell: 'Cell 3: shrink to 64×64, then enlarge three ways',
      code: `small = cv2.resize(
    img,
    (64, 64),
    interpolation=cv2.INTER_AREA
)

nearest = cv2.resize(
    small,
    (img.shape[1], img.shape[0]),
    interpolation=cv2.INTER_NEAREST
)

linear = cv2.resize(
    small,
    (img.shape[1], img.shape[0]),
    interpolation=cv2.INTER_LINEAR
)

cubic = cv2.resize(
    small,
    (img.shape[1], img.shape[0]),
    interpolation=cv2.INTER_CUBIC
)`,
      note: 'In the lab: shrink first (Scale below 1), promote the Result to input, then enlarge with the interpolator to compare.',
    },
  ],
  F04: [
    {
      notebook: 'Class_Activity_Quantization.ipynb',
      cell: 'Cell 2: quantize to N gray levels',
      code: `# Change only this value
levels = 16

# Step 1: Map each 8-bit intensity (0–255) to a quantization level
level_index = np.floor((img.astype(np.float32) / 256) * levels).astype(int)

# Step 2: Map the quantization levels back to display intensities (0–255)
quantized = np.round(
    level_index * (255 / (levels - 1))
).astype(np.uint8)

print("Image shape:", quantized.shape)
print("Requested gray levels:", levels)
print("Actual unique values used:", len(np.unique(quantized)))
print("Quantized intensity values:", np.unique(quantized))`,
      note: 'Same maths as the lab: bin = floor(r·L/256), out = round(bin·255/(L−1)), applied as a 256-entry lookup table.',
    },
  ],
  F05: [
    {
      notebook: 'Class_Activity_Spatial_Frequency_Aliasing.ipynb',
      cell: 'Cell 2: undersample by skipping pixels',
      code: `# Undersampling
sample_every = 8

undersampled = img[::sample_every, ::sample_every]

# Enlarge only for visual comparison
view = cv2.resize(
    undersampled,
    (img.shape[1], img.shape[0]),
    interpolation=cv2.INTER_NEAREST
)`,
      note: 'Choose "Skip pixels (img[::n, ::n])" under Shrink with to run exactly this.',
    },
    {
      notebook: 'Class_Activity_2_Spatial_Sampling.ipynb',
      cell: 'Cell 2: downsample with INTER_AREA',
      code: `# Change only this value
sample_size = 64

# Downsample
small = cv2.resize(
    img,
    (sample_size, sample_size),
    interpolation=cv2.INTER_AREA
)

# Enlarge again ONLY so both images can be viewed at the same display size
sampled_view = cv2.resize(
    small,
    (img.shape[1], img.shape[0]),
    interpolation=cv2.INTER_NEAREST
)`,
      note: 'Choose "Area (average first)". The notebook sets an output size (64×64); the lab sets a shrink factor.',
    },
  ],
  H01: [
    {
      notebook: 'Histogram_Processing_Class_Activity_colab.ipynb',
      cell: 'Cell 3: histogram of each result',
      code: `plt.figure(figsize=(15, 4))
for i, (result, c) in enumerate(zip(clahe_results, clip_limits)):
    plt.subplot(1, 3, i + 1)
    plt.hist(result.ravel(), bins=256, range=(0, 1))
    plt.title(f"Histogram: {c}")
    plt.xlabel("Pixel Intensity")
    plt.ylabel("Frequency")

plt.tight_layout()
plt.show()`,
      note: '256 bins like the lab scope. The notebook uses 0–1 floats; the lab uses 0–255 integers.',
    },
  ],
  H03: [
    {
      notebook: 'Histogram_Processing_Class_Activity_colab.ipynb',
      cell: 'Cell 2: CLAHE at three clip limits',
      code: `from PIL import Image
import numpy as np
from skimage import exposure, img_as_float
import matplotlib.pyplot as plt
image = Image.open("beans_g.png").convert("L")
image = np.array(image)
image_float = img_as_float(image)

clip_limits = [0.01, 0.03, 0.10]

# Apply CLAHE using each clip_limit
clahe_results = [
    exposure.equalize_adapthist(image_float, clip_limit=c)
    for c in clip_limits
]`,
      note: 'scikit-image clip_limit is a fraction (0.01–1); OpenCV clipLimit here is a multiple of the average bin height (1–40). Different scales, so results will not match number for number.',
    },
  ],
  G01: [
    {
      notebook: 'image_read_write.ipynb',
      cell: '4–5. Transform: resize and rotate',
      code: `resized = img.resize((img.width // 2, img.height // 2))
print(f"Resized to: {resized.size}")

rotated = img.rotate(90, expand=True)`,
      note: 'PIL expand=True grows the canvas. The lab keeps the canvas fixed, so corners are lost, which is the point of that card.',
    },
  ],
};
