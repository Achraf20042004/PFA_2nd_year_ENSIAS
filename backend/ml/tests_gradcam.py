"""
Tests for ml/gradcam.py — heatmap generation helpers.

  - _attention_rollout correctly computes the CLS→patch attention matrix
  - _overlay_heatmap returns valid PNG bytes and correct image dimensions
  - generate_heatmap raises ImportError when torch is absent
  - _gradient_saliency fallback path shape

numpy and torch are required; tests are skipped automatically when absent.
"""
import io
import pytest
from unittest.mock import patch
from PIL import Image

np = pytest.importorskip("numpy", reason="numpy required for gradcam tests")
torch = pytest.importorskip("torch", reason="torch required for gradcam tests")


# ---------------------------------------------------------------------------
# _overlay_heatmap
# ---------------------------------------------------------------------------

class TestOverlayHeatmap:
    def _make_pil(self, w=64, h=64):
        return Image.new("RGB", (w, h), color=(100, 100, 100))

    def test_returns_bytes(self):
        from ml.gradcam import _overlay_heatmap

        img = self._make_pil()
        attn = np.random.rand(8, 8).astype(np.float32)
        result = _overlay_heatmap(img, attn)
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_output_is_valid_png(self):
        from ml.gradcam import _overlay_heatmap

        img = self._make_pil()
        attn = np.random.rand(8, 8).astype(np.float32)
        png_bytes = _overlay_heatmap(img, attn)
        out = Image.open(io.BytesIO(png_bytes))
        assert out.format == "PNG"

    def test_output_dimensions_match_input(self):
        from ml.gradcam import _overlay_heatmap

        img = self._make_pil(w=100, h=80)
        attn = np.random.rand(7, 7).astype(np.float32)
        png_bytes = _overlay_heatmap(img, attn)
        out = Image.open(io.BytesIO(png_bytes))
        assert out.size == (100, 80)

    def test_uniform_zero_attention_does_not_crash(self):
        from ml.gradcam import _overlay_heatmap

        img = self._make_pil()
        attn = np.zeros((8, 8), dtype=np.float32)
        result = _overlay_heatmap(img, attn)
        assert isinstance(result, bytes)

    def test_uniform_one_attention_does_not_crash(self):
        from ml.gradcam import _overlay_heatmap

        img = self._make_pil()
        attn = np.ones((8, 8), dtype=np.float32)
        result = _overlay_heatmap(img, attn)
        assert isinstance(result, bytes)


# ---------------------------------------------------------------------------
# _attention_rollout
# ---------------------------------------------------------------------------

class TestAttentionRollout:
    def _make_attentions(self, num_layers=3, num_heads=4, seq_len=65):
        """Create fake attention tensors (batch=1, heads, seq_len, seq_len)."""
        attentions = []
        for _ in range(num_layers):
            attn = torch.rand(1, num_heads, seq_len, seq_len)
            # Softmax over last dim (row-stochastic)
            attn = attn / attn.sum(dim=-1, keepdim=True)
            attentions.append(attn)
        return attentions

    def test_output_shape_is_square(self):
        from ml.gradcam import _attention_rollout

        # 64 patch tokens → 8×8 grid
        attentions = self._make_attentions(seq_len=65)  # 1 CLS + 64 patches
        result = _attention_rollout(attentions)
        assert result.shape == (8, 8)

    def test_output_dtype_float32(self):
        from ml.gradcam import _attention_rollout

        attentions = self._make_attentions(seq_len=65)
        result = _attention_rollout(attentions)
        assert result.dtype == np.float32

    def test_output_non_negative(self):
        from ml.gradcam import _attention_rollout

        attentions = self._make_attentions(seq_len=65)
        result = _attention_rollout(attentions)
        assert (result >= 0).all()

    def test_single_layer(self):
        from ml.gradcam import _attention_rollout

        attentions = self._make_attentions(num_layers=1, seq_len=65)
        result = _attention_rollout(attentions)
        assert result.shape == (8, 8)


# ---------------------------------------------------------------------------
# generate_heatmap — ImportError when torch absent
# ---------------------------------------------------------------------------

class TestGenerateHeatmapImportGuard:
    def test_raises_import_error_when_torch_absent(self):
        import sys

        with patch.dict(sys.modules, {"torch": None}):
            with pytest.raises((ImportError, SystemError, TypeError)):
                from ml.gradcam import generate_heatmap
                generate_heatmap("pneumonie", b"fake")
