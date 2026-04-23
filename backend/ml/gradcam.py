"""
Grad-CAM / Attention Rollout heatmap generation for HuggingFace ViT models.

For ViT (Vision Transformer) models — which all three MedTrain models are —
standard CNN Grad-CAM is not applicable. This module implements:

  1. Attention Rollout  — propagates attention through all transformer layers;
                          gives a spatial map of "what the model attended to".
  2. Gradient Saliency fallback — input × gradient magnitude; architecture-agnostic.

Both methods produce a (H×W) attention map that is then overlaid as a
jet-colourmap heatmap on the original image and returned as PNG bytes.

Public API:
    generate_heatmap(maladie, image_bytes) -> bytes  (PNG overlay)
"""
import io
import logging

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def generate_heatmap(maladie: str, image_bytes: bytes) -> bytes:
    """
    Generate a heatmap overlay PNG for the given image.

    Uses Attention Rollout for ViT-based models, falls back to gradient
    saliency for other architectures.

    Args:
        maladie:     Disease key (case-insensitive), e.g. "pneumonie".
        image_bytes: Raw bytes of the original image (JPEG / PNG).

    Returns:
        PNG bytes of the blended heatmap overlay image.

    Raises:
        ImportError: If transformers / torch are not installed.
        ValueError:  If no adapter is registered for the given disease.
    """
    import torch
    from ml.adapters import get_adapter
    from ml.registry import get_pipeline

    adapter = get_adapter(maladie)
    pil_image = adapter.preprocess(image_bytes)

    pipe = get_pipeline(maladie)
    model = pipe.model
    # HF pipelines expose either feature_extractor or image_processor
    processor = getattr(pipe, "image_processor", None) or getattr(pipe, "feature_extractor", None)

    inputs = processor(images=pil_image, return_tensors="pt")
    model.eval()

    attention_map = _try_attention_rollout(model, inputs)
    if attention_map is None:
        attention_map = _gradient_saliency(model, inputs)

    return _overlay_heatmap(pil_image, attention_map)


# ---------------------------------------------------------------------------
# Attention Rollout (ViT)
# ---------------------------------------------------------------------------


def _try_attention_rollout(model, inputs) -> "np.ndarray | None":
    """
    Attempt attention rollout. Returns None if the model does not expose
    attention weights (e.g. non-ViT architectures).
    """
    import torch

    try:
        with torch.no_grad():
            outputs = model(**inputs, output_attentions=True)
    except TypeError:
        return None  # model does not accept output_attentions

    attentions = getattr(outputs, "attentions", None)
    if not attentions:
        return None

    return _attention_rollout(attentions)


def _attention_rollout(attentions) -> np.ndarray:
    """
    Compute attention rollout from a list of per-layer attention tensors.

    Each tensor has shape (batch=1, heads, seq_len, seq_len).
    Returns a 2-D float32 array of shape (patch_grid, patch_grid).
    """
    import torch

    result = None
    for layer_attn in attentions:
        # Average across attention heads: (seq_len, seq_len)
        attn = layer_attn[0].mean(dim=0)
        # Add residual connection and re-normalise rows
        attn = attn + torch.eye(attn.size(0), device=attn.device)
        attn = attn / attn.sum(dim=-1, keepdim=True)
        result = attn if result is None else torch.matmul(result, attn)

    # CLS token (index 0) attention to spatial patch tokens (indices 1:)
    cls_attn = result[0, 1:].detach().cpu().numpy()  # (num_patches,)

    num_patches = len(cls_attn)
    patch_grid = int(num_patches ** 0.5)
    # Guard against non-square patch counts (pad if needed)
    cls_attn = cls_attn[: patch_grid * patch_grid]
    return cls_attn.reshape(patch_grid, patch_grid).astype(np.float32)


# ---------------------------------------------------------------------------
# Gradient Saliency fallback
# ---------------------------------------------------------------------------


def _gradient_saliency(model, inputs) -> np.ndarray:
    """
    Compute input × gradient saliency map. Works for any differentiable model.
    Returns a 2-D float32 array (H_in, W_in) — the input spatial dimensions.
    """
    import torch

    pixel_values = inputs["pixel_values"].clone().requires_grad_(True)
    modified_inputs = {**inputs, "pixel_values": pixel_values}

    outputs = model(**modified_inputs)
    target_class = outputs.logits.argmax(dim=-1)
    outputs.logits[0, target_class].backward()

    # pixel_values: (1, C, H, W)
    saliency = (pixel_values.grad.abs() * pixel_values.abs())[0]  # (C, H, W)
    saliency = saliency.mean(dim=0).detach().cpu().numpy()  # (H, W)
    return saliency.astype(np.float32)


# ---------------------------------------------------------------------------
# Heatmap overlay
# ---------------------------------------------------------------------------


def _overlay_heatmap(pil_image: Image.Image, attention_map: np.ndarray) -> bytes:
    """
    Normalise *attention_map*, apply a jet colourmap, and blend it 50/50
    with *pil_image*. Returns PNG bytes.
    """
    w, h = pil_image.size

    # Normalise to [0, 1]
    attn = attention_map.copy().astype(np.float32)
    attn -= attn.min()
    if attn.max() > 1e-6:
        attn /= attn.max()

    # Resize to image dimensions
    attn_img = Image.fromarray((attn * 255).astype(np.uint8))
    attn_resized = np.array(attn_img.resize((w, h), Image.BILINEAR)).astype(np.float32) / 255.0

    # Jet colourmap: blue → cyan → green → yellow → red
    r = np.clip(1.5 - abs(4.0 * attn_resized - 3.0), 0.0, 1.0)
    g = np.clip(1.5 - abs(4.0 * attn_resized - 2.0), 0.0, 1.0)
    b = np.clip(1.5 - abs(4.0 * attn_resized - 1.0), 0.0, 1.0)

    heatmap = Image.fromarray(
        np.stack(
            [(r * 255).astype(np.uint8), (g * 255).astype(np.uint8), (b * 255).astype(np.uint8)],
            axis=-1,
        )
    )

    # Blend with original
    blended = Image.blend(pil_image.convert("RGB"), heatmap, alpha=0.5)

    buf = io.BytesIO()
    blended.save(buf, format="PNG")
    return buf.getvalue()
