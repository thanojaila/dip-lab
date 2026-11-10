"""Optional: fetch three more openly licensed images that need a network download.
Run on your own machine:  pip install scikit-image pooch pillow  &&  python fetch_extras.py public/samples
  eagle          CC0, Dayane Machado            (very high detail: resize and sharpening demos)
  human_mitosis  CC0, David Root                (cell nuclei: threshold + count)
  skin           public domain, Kilbad          (stained tissue in colour)
Licence text: skimage.data docstrings. Add each one to manifest.json and ATTRIBUTION.md if you use it.
"""
import sys, numpy as np
from pathlib import Path
from PIL import Image
import skimage.data as d

out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
out.mkdir(parents=True, exist_ok=True)
for name in ("eagle", "human_mitosis", "skin"):
    a = np.asarray(getattr(d, name)())
    im = Image.fromarray(a)
    im.thumbnail((1024, 1024), Image.LANCZOS)
    ext = "jpg" if a.ndim == 3 else "png"
    im.save(out / f"{name}.{ext}", quality=92)
    print("saved", name, im.size)
