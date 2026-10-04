"""
HuggingFace model registry.

Manages the 3 fixed pre-trained models for MedTrain AI. Models are downloaded
on first use and cached in ml_cache/ (relative to the backend root). The cache
directory can be overridden via the ML_CACHE_DIR environment variable.

Fixed models:
  pneumonie  → nickmuchi/vit-finetuned-chest-xray-pneumonia
  melanome   → SeyedAli/Melanoma-Classification
  tumeur     → Devarshi/Brain-Tumor-Classification
"""
import logging
import os
from pathlib import Path

# Force offline mode before any HuggingFace library is imported.
# huggingface_hub reads these at import time; setting them here guarantees
# they are in place regardless of what the container environment provides.
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"

from PIL import Image  # noqa: E402

logger = logging.getLogger(__name__)

# Import transformers/torch lazily so the backend starts without them installed.
try:
    import torch
    import torch.nn.functional as F
    from transformers import AutoImageProcessor, AutoModelForImageClassification
except ImportError:  # pragma: no cover
    torch = None  # type: ignore[assignment]
    F = None  # type: ignore[assignment]
    AutoImageProcessor = None  # type: ignore[assignment,misc]
    AutoModelForImageClassification = None  # type: ignore[assignment,misc]

# ml_cache/ lives next to the backend/ root by default
_DEFAULT_CACHE = Path(__file__).resolve().parent.parent / "ml_cache"
CACHE_DIR = Path(os.getenv("ML_CACHE_DIR", str(_DEFAULT_CACHE)))

# ---------------------------------------------------------------------------
# Fixed model configurations
# ---------------------------------------------------------------------------

HUGGINGFACE_MODELS: dict[str, dict] = {
    "pneumonie": {
        "model_id": "nickmuchi/vit-finetuned-chest-xray-pneumonia",
        "label_map": {
            "PNEUMONIA": "malade",
            "NORMAL": "sain",
        },
    },
    "melanome": {
        "model_id": "SeyedAli/Melanoma-Classification",
        "label_map": {
            "melanoma": "malade",
            "nevus": "sain",
            "benign": "sain",
            "malignant": "malade",
        },
    },
    "tumeur": {
        "model_id": "Devarshi/Brain-Tumor-Classification",
        "label_map": {
            "glioma_tumor": "malade",
            "meningioma_tumor": "malade",
            "pituitary_tumor": "malade",
            "no_tumor": "sain",
        },
    },
}

# In-memory cache: { maladie -> {"processor": ..., "model": ...} }
_MODEL_CACHE: dict = {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_pipeline(maladie: str) -> dict:
    """
    Load and return the processor + model for the given disease.

    Always loads from the local CACHE_DIR (local_files_only=True). Raises
    OSError if the model has not been pre-downloaded to that directory.

    Args:
        maladie: Disease key (case-insensitive), one of the HUGGINGFACE_MODELS keys.

    Returns:
        {"processor": AutoImageProcessor, "model": AutoModelForImageClassification}

    Raises:
        ValueError: If the disease is not registered.
        ImportError: If transformers/torch are not installed.
        OSError: If the model is not found in CACHE_DIR.
    """
    key = maladie.lower().strip()
    if key not in HUGGINGFACE_MODELS:
        raise ValueError(
            f"No HuggingFace model registered for disease '{maladie}'. "
            f"Registered: {list(HUGGINGFACE_MODELS)}"
        )

    if AutoImageProcessor is None:
        raise ImportError(
            "transformers and torch are required for inference. "
            "Install with: pip install transformers torch"
        )

    if key not in _MODEL_CACHE:
        model_id = HUGGINGFACE_MODELS[key]["model_id"]

        # Reuse an already-loaded pipeline when two diseases share the same model_id
        # (e.g. retinopathie reuses the pneumonie model).
        for cached_key, cached_entry in _MODEL_CACHE.items():
            if HUGGINGFACE_MODELS[cached_key]["model_id"] == model_id:
                logger.info("Reusing in-memory pipeline from '%s' for '%s'.", cached_key, key)
                _MODEL_CACHE[key] = cached_entry
                break
        else:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            logger.info("Loading '%s' from local cache %s …", model_id, CACHE_DIR)

            # Processor — AutoImageProcessor first; some ViT checkpoints need the
            # explicit ViTImageProcessor class. Both calls use local_files_only=True.
            try:
                processor = AutoImageProcessor.from_pretrained(
                    model_id, cache_dir=str(CACHE_DIR), local_files_only=True
                )
            except (ValueError, OSError):
                from transformers import ViTImageProcessor
                processor = ViTImageProcessor.from_pretrained(
                    model_id, cache_dir=str(CACHE_DIR), local_files_only=True
                )

            model = AutoModelForImageClassification.from_pretrained(
                model_id, cache_dir=str(CACHE_DIR), local_files_only=True
            )
            model.eval()

            _MODEL_CACHE[key] = {"processor": processor, "model": model}
            logger.info("Model '%s' loaded and cached in memory.", key)

    return _MODEL_CACHE[key]


def predict(maladie: str, pil_image: Image.Image) -> dict:
    """
    Run inference on a preprocessed PIL image.

    Args:
        maladie: Disease key (case-insensitive).
        pil_image: A PIL.Image already preprocessed by the domain adapter.

    Returns:
        {
            "label":      "malade" | "sain",
            "confidence": float (0-1),
            "raw_label":  str (original HuggingFace label),
        }
    """
    cached = get_pipeline(maladie)
    processor = cached["processor"]
    model = cached["model"]

    inputs = processor(images=pil_image, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)

    predicted_idx = outputs.logits.argmax(-1).item()
    raw_label = model.config.id2label[predicted_idx]
    confidence = F.softmax(outputs.logits, dim=-1)[0][predicted_idx].item()

    label_map = HUGGINGFACE_MODELS[maladie.lower()]["label_map"]
    canonical_label = label_map.get(raw_label, raw_label.lower())

    return {
        "label": canonical_label,
        "confidence": round(confidence, 4),
        "raw_label": raw_label,
    }


def clear_cache() -> None:
    """Evict all loaded models from memory (useful in tests or after reload)."""
    _MODEL_CACHE.clear()
    logger.debug("HuggingFace model cache cleared.")


def list_models() -> list[dict]:
    """Return metadata for all registered models (without loading them)."""
    return [
        {
            "maladie": key,
            "model_id": cfg["model_id"],
            "loaded": key in _MODEL_CACHE,
        }
        for key, cfg in HUGGINGFACE_MODELS.items()
    ]
