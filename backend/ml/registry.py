"""
HuggingFace model registry.

Manages the 3 fixed pre-trained models for MedTrain AI. Models are downloaded
on first use and cached in ml_cache/ (relative to the backend root). The cache
directory can be overridden via the ML_CACHE_DIR environment variable.

Fixed models:
  pneumonie     → nickmuchi/vit-finetuned-chest-xray-pneumonia
  melanome      → anonymous-german-shepherd/skin-cancer
  retinopathie  → gauravlochab/diabetic-retinopathy-vit-base  (HF equivalent)
"""
import logging
import os
from pathlib import Path

from PIL import Image

logger = logging.getLogger(__name__)

# Import transformers lazily so the backend runs without it installed;
# the attribute is a module-level name so tests can patch ml.registry.pipeline.
try:
    from transformers import pipeline
except ImportError:  # pragma: no cover
    pipeline = None  # type: ignore[assignment]

# ml_cache/ lives next to the backend/ root by default
_DEFAULT_CACHE = Path(__file__).resolve().parent.parent / "ml_cache"
CACHE_DIR = Path(os.getenv("ML_CACHE_DIR", str(_DEFAULT_CACHE)))

# ---------------------------------------------------------------------------
# Fixed model configurations
# ---------------------------------------------------------------------------

HUGGINGFACE_MODELS: dict[str, dict] = {
    "pneumonie": {
        "model_id": "nickmuchi/vit-finetuned-chest-xray-pneumonia",
        "task": "image-classification",
        # Map raw HF label → MedTrain canonical label
        "label_map": {
            "PNEUMONIA": "malade",
            "NORMAL": "sain",
        },
    },
    "melanome": {
        "model_id": "anonymous-german-shepherd/skin-cancer",
        "task": "image-classification",
        "label_map": {
            "malignant": "malade",
            "benign": "sain",
        },
    },
    "retinopathie": {
        # Replace with a more specific fundus model when available.
        "model_id": "gauravlochab/diabetic-retinopathy-vit-base",
        "task": "image-classification",
        "label_map": {
            "DR": "malade",
            "No_DR": "sain",
        },
    },
}

# In-memory pipeline cache: { maladie -> transformers.Pipeline }
_PIPELINE_CACHE: dict = {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_pipeline(maladie: str):
    """
    Return the HuggingFace pipeline for the given disease.

    Downloads the model on first call and caches it in CACHE_DIR.
    Subsequent calls return the in-memory cached pipeline.

    Args:
        maladie: Disease key (case-insensitive), one of the HUGGINGFACE_MODELS keys.

    Raises:
        ValueError: If the disease is not registered.
        ImportError: If transformers/torch are not installed.
    """
    key = maladie.lower().strip()
    if key not in HUGGINGFACE_MODELS:
        raise ValueError(
            f"No HuggingFace model registered for disease '{maladie}'. "
            f"Registered: {list(HUGGINGFACE_MODELS)}"
        )

    if pipeline is None:
        raise ImportError(
            "transformers is required for inference. "
            "Install it with: pip install transformers torch"
        )

    if key not in _PIPELINE_CACHE:
        config = HUGGINGFACE_MODELS[key]
        logger.info("Loading HF model for '%s': %s", key, config["model_id"])
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _PIPELINE_CACHE[key] = pipeline(
            config["task"],
            model=config["model_id"],
            cache_dir=str(CACHE_DIR),
        )
        logger.info("Model '%s' loaded and cached in %s.", key, CACHE_DIR)

    return _PIPELINE_CACHE[key]


def predict(maladie: str, pil_image: Image.Image) -> dict:
    """
    Run inference on a preprocessed PIL image.

    Args:
        maladie: Disease key (case-insensitive).
        pil_image: A PIL.Image already preprocessed by the domain adapter.

    Returns:
        {
            "label":      "malade" | "sain",
            "confidence": float (0–1),
            "raw_label":  str (original HuggingFace label),
        }
    """
    pipe = get_pipeline(maladie)
    results = pipe(pil_image)

    # results is a list of {"label": ..., "score": ...}, pick the top
    top = max(results, key=lambda r: r["score"])

    label_map = HUGGINGFACE_MODELS[maladie.lower()]["label_map"]
    canonical_label = label_map.get(top["label"], top["label"].lower())

    return {
        "label": canonical_label,
        "confidence": round(top["score"], 4),
        "raw_label": top["label"],
    }


def clear_cache() -> None:
    """Evict all loaded pipelines from memory (useful in tests or after reload)."""
    _PIPELINE_CACHE.clear()
    logger.debug("HuggingFace pipeline cache cleared.")


def list_models() -> list[dict]:
    """Return metadata for all registered models (without loading them)."""
    return [
        {
            "maladie": key,
            "model_id": cfg["model_id"],
            "task": cfg["task"],
            "loaded": key in _PIPELINE_CACHE,
        }
        for key, cfg in HUGGINGFACE_MODELS.items()
    ]
