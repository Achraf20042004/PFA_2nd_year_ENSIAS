"""
HuggingFace model registry.

Manages the 3 fixed pre-trained models for MedTrain AI. Models are downloaded
on first use and cached in ml_cache/ (relative to the backend root). The cache
directory can be overridden via the ML_CACHE_DIR environment variable.

Fixed models:
  pneumonie     → nickmuchi/vit-finetuned-chest-xray-pneumonia
  melanome      → anonymous-german-shepherd/skin-cancer
  retinopathie  → nickmuchi/vit-finetuned-chest-xray-pneumonia  (placeholder)
"""
import logging
import os
from pathlib import Path

from PIL import Image

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
    "retinopathie": {
        # Placeholder: reuses the already-cached pneumonia model until a
        # reliable ophthalmology model is available on HuggingFace.
        "model_id": "nickmuchi/vit-finetuned-chest-xray-pneumonia",
        "label_map": {
            "PNEUMONIA": "malade",
            "NORMAL": "sain",
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

    Downloads to CACHE_DIR on first call; subsequent calls return the
    in-memory cached objects.

    Args:
        maladie: Disease key (case-insensitive), one of the HUGGINGFACE_MODELS keys.

    Returns:
        {"processor": AutoImageProcessor, "model": AutoModelForImageClassification}

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

    if AutoImageProcessor is None:
        raise ImportError(
            "transformers and torch are required for inference. "
            "Install with: pip install transformers torch"
        )

    print(f"[get_pipeline] key={key!r}  cache keys={list(_MODEL_CACHE)}", flush=True)

    if key not in _MODEL_CACHE:
        model_id = HUGGINGFACE_MODELS[key]["model_id"]
        print(f"[get_pipeline] model_id={model_id!r}", flush=True)

        # Reuse an already-loaded pipeline if another disease shares the same model_id.
        print(f"[get_pipeline] scanning in-memory cache for model_id match …", flush=True)
        for cached_key, cached_entry in _MODEL_CACHE.items():
            if HUGGINGFACE_MODELS[cached_key]["model_id"] == model_id:
                print(f"[get_pipeline] reusing in-memory entry from {cached_key!r}", flush=True)
                _MODEL_CACHE[key] = cached_entry
                break
        else:
            print(f"[get_pipeline] no in-memory match — loading from disk/network", flush=True)
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            print(f"[get_pipeline] CACHE_DIR={CACHE_DIR}  exists={CACHE_DIR.exists()}", flush=True)

            import concurrent.futures
            import functools

            def _load_processor():
                print("[get_pipeline] _load_processor: start", flush=True)
                try:
                    p = AutoImageProcessor.from_pretrained(
                        model_id, cache_dir=str(CACHE_DIR), local_files_only=True
                    )
                    print("[get_pipeline] _load_processor: AutoImageProcessor OK (local)", flush=True)
                    return p
                except (ValueError, OSError) as exc:
                    print(f"[get_pipeline] _load_processor: local failed ({exc}), trying ViTImageProcessor local …", flush=True)
                try:
                    from transformers import ViTImageProcessor
                    p = ViTImageProcessor.from_pretrained(
                        model_id, cache_dir=str(CACHE_DIR), local_files_only=True
                    )
                    print("[get_pipeline] _load_processor: ViTImageProcessor OK (local)", flush=True)
                    return p
                except OSError as exc:
                    print(f"[get_pipeline] _load_processor: ViT local failed ({exc}), falling back to network …", flush=True)
                try:
                    p = AutoImageProcessor.from_pretrained(model_id, cache_dir=str(CACHE_DIR))
                    print("[get_pipeline] _load_processor: AutoImageProcessor OK (network)", flush=True)
                    return p
                except ValueError:
                    from transformers import ViTImageProcessor
                    p = ViTImageProcessor.from_pretrained(model_id, cache_dir=str(CACHE_DIR))
                    print("[get_pipeline] _load_processor: ViTImageProcessor OK (network)", flush=True)
                    return p

            def _load_model():
                print("[get_pipeline] _load_model: start", flush=True)
                try:
                    m = AutoModelForImageClassification.from_pretrained(
                        model_id, cache_dir=str(CACHE_DIR), local_files_only=True
                    )
                    print("[get_pipeline] _load_model: OK (local)", flush=True)
                    return m
                except OSError as exc:
                    print(f"[get_pipeline] _load_model: local failed ({exc}), falling back to network …", flush=True)
                m = AutoModelForImageClassification.from_pretrained(
                    model_id, cache_dir=str(CACHE_DIR)
                )
                print("[get_pipeline] _load_model: OK (network)", flush=True)
                return m

            TIMEOUT = 30

            print(f"[get_pipeline] launching _load_processor (timeout={TIMEOUT}s) …", flush=True)
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                fut = ex.submit(_load_processor)
                try:
                    processor = fut.result(timeout=TIMEOUT)
                except concurrent.futures.TimeoutError:
                    raise TimeoutError(
                        f"[get_pipeline] _load_processor timed out after {TIMEOUT}s "
                        f"for model {model_id!r}"
                    )
            print(f"[get_pipeline] processor loaded: {type(processor).__name__}", flush=True)

            print(f"[get_pipeline] launching _load_model (timeout={TIMEOUT}s) …", flush=True)
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                fut = ex.submit(_load_model)
                try:
                    model = fut.result(timeout=TIMEOUT)
                except concurrent.futures.TimeoutError:
                    raise TimeoutError(
                        f"[get_pipeline] _load_model timed out after {TIMEOUT}s "
                        f"for model {model_id!r}"
                    )
            print(f"[get_pipeline] model loaded: {type(model).__name__}", flush=True)

            print("[get_pipeline] calling model.eval() …", flush=True)
            model.eval()
            _MODEL_CACHE[key] = {"processor": processor, "model": model}
            print(f"[get_pipeline] cached under key={key!r}", flush=True)
            logger.info("Model '%s' loaded and cached in %s.", key, CACHE_DIR)

    print(f"[get_pipeline] returning cache entry for key={key!r}", flush=True)
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
