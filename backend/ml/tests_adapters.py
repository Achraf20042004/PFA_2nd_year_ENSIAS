"""
Tests for ml/adapters.py — preprocessing adapters for the 3 medical domains.
"""
import io

import pytest
from PIL import Image

from ml.adapters import (
    ChestAdapter,
    FundusAdapter,
    SkinAdapter,
    get_adapter,
)


def _make_image_bytes(width=100, height=100, mode="RGB") -> bytes:
    """Create a minimal in-memory JPEG image."""
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
        # Input is greyscale; adapter must convert to RGB
        adapter = ChestAdapter()
        grey_bytes = _make_image_bytes(mode="L")
        result = adapter.preprocess(grey_bytes)
        assert result.mode == "RGB"

    def test_returns_pil_image(self):
        adapter = ChestAdapter()
        result = adapter.preprocess(_make_image_bytes())
        assert isinstance(result, Image.Image)


class TestSkinAdapter:
    def test_output_size(self):
        adapter = SkinAdapter()
        result = adapter.preprocess(_make_image_bytes())
        assert result.size == (224, 224)

    def test_output_mode_rgb(self):
        adapter = SkinAdapter()
        result = adapter.preprocess(_make_image_bytes())
        assert result.mode == "RGB"


class TestFundusAdapter:
    def test_output_size(self):
        adapter = FundusAdapter()
        result = adapter.preprocess(_make_image_bytes())
        assert result.size == (299, 299)

    def test_output_mode_rgb(self):
        adapter = FundusAdapter()
        result = adapter.preprocess(_make_image_bytes())
        assert result.mode == "RGB"


class TestGetAdapter:
    def test_pneumonie(self):
        adapter = get_adapter("pneumonie")
        assert isinstance(adapter, ChestAdapter)

    def test_melanome(self):
        adapter = get_adapter("melanome")
        assert isinstance(adapter, SkinAdapter)

    def test_retinopathie(self):
        adapter = get_adapter("retinopathie")
        assert isinstance(adapter, FundusAdapter)

    def test_case_insensitive(self):
        assert isinstance(get_adapter("Pneumonie"), ChestAdapter)
        assert isinstance(get_adapter("MELANOME"), SkinAdapter)
        assert isinstance(get_adapter("  retinopathie  "), FundusAdapter)

    def test_unknown_disease_raises(self):
        with pytest.raises(ValueError, match="No preprocessing adapter"):
            get_adapter("unknown_disease")
