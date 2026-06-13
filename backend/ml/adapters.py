"""
Image preprocessing adapters for the 3 fixed medical domains.

Each adapter applies a consistent normalization pipeline so every image
arrives at the model with identical appearance characteristics regardless
of the original scanner, camera, zoom level or exposure:

  1. Convert to RGB
  2. Center-crop to square  → removes border padding, standardises zoom
  3. Normalize contrast/brightness → equalises lighting across images
  4. Resize to model input size

Domain → Adapter mapping:
  pneumonie  → ChestAdapter  (256×256 · autocontrast)
  melanome   → SkinAdapter   (224×224 · autocontrast)
  tumeur     → BrainAdapter  (224×224 · histogram equalization)
"""
import io
import logging
from abc import ABC, abstractmethod

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared helper
# ---------------------------------------------------------------------------

def _center_crop_square(img: Image.Image) -> Image.Image:
    """
    Crop the largest centered square from the image.

    Ensures all images have a 1:1 aspect ratio before resizing, which
    prevents the model from seeing squashed or stretched anatomy.
    """
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top  = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


# ---------------------------------------------------------------------------
# Adapters
# ---------------------------------------------------------------------------

class BaseAdapter(ABC):
    """Abstract base for all preprocessing adapters."""

    @abstractmethod
    def preprocess(self, image_bytes: bytes) -> Image.Image:
        """Convert raw image bytes to a normalized, model-ready PIL.Image."""


class ChestAdapter(BaseAdapter):
    """
    Chest X-ray adapter for pneumonia detection.

    Model : nickmuchi/vit-finetuned-chest-xray-pneumonia
    Size  : 256×256
    Mode  : RGB (X-rays often greyscale; model expects 3-channel)

    Normalization:
      - Center crop → consistent anatomical framing
      - autocontrast(cutoff=2) → clips 2% extremes and stretches to [0,255],
        equalising exposure differences between X-ray machines
    """

    SIZE = (256, 256)

    def preprocess(self, image_bytes: bytes) -> Image.Image:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = _center_crop_square(img)
        img = ImageOps.autocontrast(img, cutoff=2)
        return img.resize(self.SIZE, Image.LANCZOS)


class SkinAdapter(BaseAdapter):
    """
    Skin lesion adapter for melanoma detection.

    Model : SeyedAli/Melanoma-Classification
    Size  : 224×224
    Mode  : RGB

    Normalization:
      - Center crop → consistent lesion framing
      - autocontrast(cutoff=1) → mild clipping to equalize camera exposure
        without altering the natural colour of the lesion
    """

    SIZE = (224, 224)

    def preprocess(self, image_bytes: bytes) -> Image.Image:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = _center_crop_square(img)
        img = ImageOps.autocontrast(img, cutoff=1)
        return img.resize(self.SIZE, Image.LANCZOS)


class BrainAdapter(BaseAdapter):
    """
    Brain MRI adapter for tumor detection.

    Model : Devarshi/Brain-Tumor-Classification
    Size  : 224×224
    Mode  : RGB

    Normalization:
      - Center crop → consistent brain framing
      - equalize() → full histogram equalization; MRI scanners produce very
        different absolute intensity scales, so a full equalization is needed
        to bring every scan to the same perceptual range before classification
    """

    SIZE = (224, 224)

    def preprocess(self, image_bytes: bytes) -> Image.Image:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = _center_crop_square(img)
        img = ImageOps.equalize(img)
        return img.resize(self.SIZE, Image.LANCZOS)


# ---------------------------------------------------------------------------
# Domain registry — keys must match Dataset.maladie values (lowercased)
# ---------------------------------------------------------------------------

DOMAIN_ADAPTERS: dict[str, BaseAdapter] = {
    "pneumonie": ChestAdapter(),
    "melanome":  SkinAdapter(),
    "tumeur":    BrainAdapter(),
}


def get_adapter(maladie: str) -> BaseAdapter:
    """
    Return the preprocessing adapter for a given disease name.

    Args:
        maladie: Disease name as stored in Dataset.maladie (case-insensitive).

    Raises:
        ValueError: If no adapter is registered for the given disease.
    """
    key = maladie.lower().strip()
    if key not in DOMAIN_ADAPTERS:
        raise ValueError(
            f"No preprocessing adapter for disease '{maladie}'. "
            f"Registered domains: {list(DOMAIN_ADAPTERS)}"
        )
    return DOMAIN_ADAPTERS[key]
