"""
Image preprocessing adapters for the 3 fixed medical domains.

Each adapter accepts raw image bytes and returns a PIL.Image ready for
HuggingFace pipeline inference. Adapters handle resizing and colour-space
normalisation for each domain's specific requirements.

Domain → Adapter mapping:
  pneumonie     → ChestAdapter   (256×256, grayscale input → RGB)
  melanome      → SkinAdapter    (224×224, RGB)
  retinopathie  → FundusAdapter  (256×256, RGB)  [placeholder: reuses pneumonia model]
"""
import io
import logging
from abc import ABC, abstractmethod

from PIL import Image

logger = logging.getLogger(__name__)


class BaseAdapter(ABC):
    """Abstract base for all preprocessing adapters."""

    @abstractmethod
    def preprocess(self, image_bytes: bytes) -> Image.Image:
        """Convert raw image bytes to a preprocessed PIL.Image."""


class ChestAdapter(BaseAdapter):
    """
    Chest X-ray adapter for pneumonia detection.

    Model: nickmuchi/vit-finetuned-chest-xray-pneumonia
    Size : 256×256
    Mode : RGB  (X-rays are often greyscale; model expects 3-channel input)
    """

    SIZE = (256, 256)

    def preprocess(self, image_bytes: bytes) -> Image.Image:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return img.resize(self.SIZE, Image.LANCZOS)


class SkinAdapter(BaseAdapter):
    """
    Skin lesion adapter for melanoma detection.

    Model: SeyedAli/Melanoma-Classification
    Size : 224×224
    Mode : RGB
    """

    SIZE = (224, 224)

    def preprocess(self, image_bytes: bytes) -> Image.Image:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return img.resize(self.SIZE, Image.LANCZOS)


class FundusAdapter(BaseAdapter):
    """
    Fundus / retinal adapter for diabetic retinopathy detection.

    Placeholder model: nickmuchi/vit-finetuned-chest-xray-pneumonia (256×256).
    Size matches ChestAdapter so the already-cached model is reused end-to-end.
    """

    SIZE = (256, 256)

    def preprocess(self, image_bytes: bytes) -> Image.Image:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return img.resize(self.SIZE, Image.LANCZOS)


# ---------------------------------------------------------------------------
# Domain registry — keys must match Dataset.maladie values (lowercased)
# ---------------------------------------------------------------------------

DOMAIN_ADAPTERS: dict[str, BaseAdapter] = {
    "pneumonie": ChestAdapter(),
    "melanome": SkinAdapter(),
    "retinopathie": FundusAdapter(),
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
