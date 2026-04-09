"""
Tests for ml/registry.py — HuggingFace model registry.

These tests do NOT load actual HuggingFace models (that would require network
access and large downloads). Instead they test the registry API surface, label
mapping, error handling, and cache management using mocks.
"""
import pytest
from unittest.mock import MagicMock, patch

from ml.registry import (
    HUGGINGFACE_MODELS,
    clear_cache,
    list_models,
    predict,
    get_pipeline,
    _PIPELINE_CACHE,
)


@pytest.fixture(autouse=True)
def clear_pipeline_cache():
    """Ensure a clean pipeline cache before and after every test."""
    clear_cache()
    yield
    clear_cache()


class TestHuggingFaceModelsConfig:
    def test_all_three_diseases_registered(self):
        assert "pneumonie" in HUGGINGFACE_MODELS
        assert "melanome" in HUGGINGFACE_MODELS
        assert "retinopathie" in HUGGINGFACE_MODELS

    def test_each_config_has_required_keys(self):
        for disease, cfg in HUGGINGFACE_MODELS.items():
            assert "model_id" in cfg, f"{disease} missing model_id"
            assert "task" in cfg, f"{disease} missing task"
            assert "label_map" in cfg, f"{disease} missing label_map"

    def test_model_ids_are_non_empty(self):
        for disease, cfg in HUGGINGFACE_MODELS.items():
            assert cfg["model_id"], f"{disease} has empty model_id"


class TestGetPipeline:
    def test_unknown_disease_raises(self):
        with pytest.raises(ValueError, match="No HuggingFace model registered"):
            get_pipeline("unknown")

    def test_caches_pipeline_after_first_load(self):
        mock_pipe = MagicMock()
        with patch("ml.registry.pipeline", return_value=mock_pipe) as mock_pipeline_fn:
            pipe1 = get_pipeline("pneumonie")
            pipe2 = get_pipeline("pneumonie")
            # pipeline() constructor called only once
            mock_pipeline_fn.assert_called_once()
            assert pipe1 is pipe2

    def test_loads_correct_model_id(self):
        mock_pipe = MagicMock()
        with patch("ml.registry.pipeline", return_value=mock_pipe) as mock_pipeline_fn:
            get_pipeline("melanome")
            call_kwargs = mock_pipeline_fn.call_args
            assert call_kwargs[1]["model"] == HUGGINGFACE_MODELS["melanome"]["model_id"]

    def test_missing_transformers_raises_import_error(self):
        with patch("ml.registry.pipeline", None):
            with pytest.raises(ImportError, match="transformers is required"):
                get_pipeline("pneumonie")


class TestPredict:
    def _make_mock_pipeline(self, raw_label: str, score: float):
        mock_pipe = MagicMock()
        mock_pipe.return_value = [{"label": raw_label, "score": score}]
        return mock_pipe

    def test_predict_malade_pneumonie(self):
        mock_pipe = self._make_mock_pipeline("PNEUMONIA", 0.97)
        with patch("ml.registry.pipeline", return_value=mock_pipe):
            result = predict("pneumonie", MagicMock())
        assert result["label"] == "malade"
        assert result["confidence"] == pytest.approx(0.97)
        assert result["raw_label"] == "PNEUMONIA"

    def test_predict_sain_pneumonie(self):
        mock_pipe = self._make_mock_pipeline("NORMAL", 0.88)
        with patch("ml.registry.pipeline", return_value=mock_pipe):
            result = predict("pneumonie", MagicMock())
        assert result["label"] == "sain"

    def test_predict_malade_melanome(self):
        mock_pipe = self._make_mock_pipeline("malignant", 0.82)
        with patch("ml.registry.pipeline", return_value=mock_pipe):
            result = predict("melanome", MagicMock())
        assert result["label"] == "malade"

    def test_predict_picks_highest_score(self):
        mock_pipe = MagicMock()
        mock_pipe.return_value = [
            {"label": "NORMAL", "score": 0.3},
            {"label": "PNEUMONIA", "score": 0.7},
        ]
        with patch("ml.registry.pipeline", return_value=mock_pipe):
            result = predict("pneumonie", MagicMock())
        assert result["label"] == "malade"
        assert result["confidence"] == pytest.approx(0.7)

    def test_predict_unknown_label_falls_back_to_lowercase(self):
        mock_pipe = self._make_mock_pipeline("UNKNOWN_LABEL", 0.55)
        with patch("ml.registry.pipeline", return_value=mock_pipe):
            result = predict("pneumonie", MagicMock())
        assert result["label"] == "unknown_label"


class TestListModels:
    def test_returns_all_three(self):
        models = list_models()
        diseases = {m["maladie"] for m in models}
        assert diseases == {"pneumonie", "melanome", "retinopathie"}

    def test_loaded_false_before_pipeline_creation(self):
        models = list_models()
        for m in models:
            assert m["loaded"] is False

    def test_loaded_true_after_pipeline_creation(self):
        mock_pipe = MagicMock()
        with patch("ml.registry.pipeline", return_value=mock_pipe):
            get_pipeline("pneumonie")
        models = {m["maladie"]: m for m in list_models()}
        assert models["pneumonie"]["loaded"] is True
        assert models["melanome"]["loaded"] is False


class TestClearCache:
    def test_clear_cache_empties_in_memory_store(self):
        mock_pipe = MagicMock()
        with patch("ml.registry.pipeline", return_value=mock_pipe):
            get_pipeline("pneumonie")
        assert "pneumonie" in _PIPELINE_CACHE
        clear_cache()
        assert _PIPELINE_CACHE == {}
