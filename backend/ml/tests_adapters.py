"""
Tests for ml/adapters.py — preprocessing adapters for the 3 medical domains.
"""
import io

import pytest
from PIL import Image

from ml.adapters import (
    BrainAdapter,
    ChestAdapter,
    SkinAdapter,
    get_adapter,
)


def _make_image_bytes(width=200, height=150, mode="RGB") -> bytes:
    """Create a minimal in-memory JPEG image (non-square to test center crop)."""
    color = 128 if mode == "L" else (128, 64, 32)
    img = Image.new(mode, (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestChestAdapter:
    def test_output_size(self):
        adapter = ChestAdapter()
        result = adapter.preprocess(_make_image_bytes())
        assert result.size == (256, 256)

    def test_output_mode_rgb(self):
        adapter = ChestAdapter()
        grey_bytes = _make_image_bytes(mode="L")
        result = adapter.preprocess(grey_bytes)
        assert result.mode == "RGB"

    def test_returns_pil_image(self):
        adapter = ChestAdapter()
        result = adapter.preprocess(_make_image_bytes())
        assert isinstance(result, Image.Image)

    def test_non_square_input_produces_square_output(self):
        adapter = ChestAdapter()
        result = adapter.preprocess(_make_image_bytes(width=300, height=150))
        assert result.size == (256, 256)


class TestSkinAdapter:
    def test_output_size(self):
        adapter = SkinAdapter()
        result = adapter.preprocess(_make_image_bytes())
        assert result.size == (224, 224)

    def test_output_mode_rgb(self):
        adapter = SkinAdapter()
        result = adapter.preprocess(_make_image_bytes())
        assert result.mode == "RGB"

    def test_non_square_input_produces_square_output(self):
        adapter = SkinAdapter()
        result = adapter.preprocess(_make_image_bytes(width=400, height=300))
        assert result.size == (224, 224)


class TestBrainAdapter:
    def test_output_size(self):
        adapter = BrainAdapter()
        result = adapter.preprocess(_make_image_bytes())
        assert result.size == (224, 224)

    def test_output_mode_rgb(self):
        adapter = BrainAdapter()
        result = adapter.preprocess(_make_image_bytes())
        assert result.mode == "RGB"

    def test_non_square_input_produces_square_output(self):
        adapter = BrainAdapter()
        result = adapter.preprocess(_make_image_bytes(width=256, height=192))
        assert result.size == (224, 224)


class TestGetAdapter:
    def test_pneumonie(self):
        adapter = get_adapter("pneumonie")
        assert isinstance(adapter, ChestAdapter)

    def test_melanome(self):
        adapter = get_adapter("melanome")
        assert isinstance(adapter, SkinAdapter)

    def test_tumeur(self):
        adapter = get_adapter("tumeur")
        assert isinstance(adapter, BrainAdapter)

    def test_case_insensitive(self):
        assert isinstance(get_adapter("Pneumonie"), ChestAdapter)
        assert isinstance(get_adapter("MELANOME"), SkinAdapter)
        assert isinstance(get_adapter("  tumeur  "), BrainAdapter)

    def test_unknown_disease_raises(self):
        with pytest.raises(ValueError, match="No preprocessing adapter"):
            get_adapter("unknown_disease")
