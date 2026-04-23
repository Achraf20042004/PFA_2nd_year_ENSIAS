"""
Inference pipeline: domain adapter preprocessing + HuggingFace registry.

Single entry-point for running inference on raw image bytes. The adapter
handles resize/colour-space; the registry handles model loading and prediction.
"""
import time

from .adapters import get_adapter
from .registry import HUGGINGFACE_MODELS, predict as _predict


def predict_image(image_bytes: bytes, maladie: str) -> dict:
    """
    Run full inference on raw image bytes for the given disease domain.

    Args:
        image_bytes: Raw bytes of the original image file.
        maladie: Disease key — one of: pneumonie, melanome, retinopathie.

    Returns:
        {
            "label":      "malade" | "sain",
            "confidence": float (0-1),
            "raw_label":  str (original HuggingFace label),
            "latency_ms": int (inference time, excluding preprocessing),
            "model_id":   str (HuggingFace model identifier),
        }
    """
    adapter = get_adapter(maladie)
    pil_image = adapter.preprocess(image_bytes)

    t0 = time.monotonic()
    result = _predict(maladie, pil_image)
    result["latency_ms"] = int((time.monotonic() - t0) * 1000)
    result["model_id"] = HUGGINGFACE_MODELS[maladie.lower()]["model_id"]
    return result
