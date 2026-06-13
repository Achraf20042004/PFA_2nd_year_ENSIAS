"""
Management command: preload and smoke-test the Neurologie pipeline end-to-end.

Usage:
    python manage.py preload_ophtalmologie
    python manage.py preload_ophtalmologie --skip-inference

Steps executed:
    1. Create a synthetic 224x224 RGB image (simulates a brain MRI).
    2. Run it through BrainAdapter.preprocess() -> validates resize (224x224 RGB).
    3. Load Devarshi/Brain-Tumor-Classification from ml_cache/.
    4. Run registry.predict() -> validates HuggingFace inference.
    5. Log ModelMetric entries to the analytics SQLite database.
"""
import io
import sys
import time
import traceback

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Preload the Ophtalmologie HuggingFace model and run one image through the full pipeline."

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-inference",
            action="store_true",
            help="Test adapter preprocessing only, skip HuggingFace download and inference.",
        )

    def handle(self, *args, **options):
        def out(msg):
            self.stdout.write(msg)
            sys.stdout.flush()

        skip_inference = options["skip_inference"]
        out("\n[preload_ophtalmologie] Neurologie pipeline smoke-test\n")
        out("-" * 55 + "\n")

        # ------------------------------------------------------------------ #
        # Step 1 — synthetic brain MRI image (RGB, 224x224)
        # ------------------------------------------------------------------ #
        out("[1/4] Creating synthetic brain MRI image...")
        from PIL import Image as PILImage

        synthetic = PILImage.new("RGB", (224, 224), color=(30, 30, 60))
        buf = io.BytesIO()
        synthetic.save(buf, format="JPEG", quality=85)
        image_bytes = buf.getvalue()
        out(self.style.SUCCESS(f"      OK: {len(image_bytes)} bytes (224x224 RGB JPEG)"))

        # ------------------------------------------------------------------ #
        # Step 2 — BrainAdapter: resize to 224x224, keep RGB
        # ------------------------------------------------------------------ #
        out("[2/4] BrainAdapter.preprocess()...")
        t0 = time.monotonic()

        from ml.adapters import get_adapter
        adapter = get_adapter("tumeur")
        pil_image = adapter.preprocess(image_bytes)
        elapsed_ms = int((time.monotonic() - t0) * 1000)

        if pil_image.size != (224, 224):
            out(self.style.ERROR(f"      FAIL: expected size (224, 224), got {pil_image.size}"))
            return
        if pil_image.mode != "RGB":
            out(self.style.ERROR(f"      FAIL: expected mode RGB, got {pil_image.mode}"))
            return

        out(self.style.SUCCESS(
            f"      OK: {adapter.__class__.__name__} -> {pil_image.size} {pil_image.mode} ({elapsed_ms} ms)"
        ))

        if skip_inference:
            out("\n[preload_ophtalmologie] --skip-inference: stopping after adapter test.\n")
            return

        # ------------------------------------------------------------------ #
        # Step 3 — load HuggingFace model (downloads on first run)
        # ------------------------------------------------------------------ #
        out("[3/4] Loading HuggingFace model...")
        from ml.registry import CACHE_DIR, HUGGINGFACE_MODELS, get_pipeline

        model_id = HUGGINGFACE_MODELS["tumeur"]["model_id"]
        out(f"      model : {model_id}")
        out(f"      cache : {CACHE_DIR}")

        t0 = time.monotonic()
        try:
            get_pipeline("tumeur")
        except BaseException as exc:
            out(f"\nCRASH in get_pipeline: {type(exc).__name__}: {exc}")
            traceback.print_exc(file=sys.stdout)
            sys.stdout.flush()
            raise
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        out(self.style.SUCCESS(f"      OK: model ready ({elapsed_ms} ms)"))

        # ------------------------------------------------------------------ #
        # Step 4 — inference + log ModelMetric to analytics SQLite
        # ------------------------------------------------------------------ #
        out("[4/4] Running inference + logging ModelMetric...")
        from ml.predictor import predict_image

        t0 = time.monotonic()
        result = predict_image(image_bytes, "tumeur")
        elapsed_ms = int((time.monotonic() - t0) * 1000)

        out(self.style.SUCCESS(
            f"      OK: label={result['label']}  "
            f"confidence={result['confidence']:.4f}  "
            f"latency={result['latency_ms']} ms"
        ))
        out(f"      raw_label : {result['raw_label']}")

        try:
            from apps.analytics.models import ModelMetric
            ModelMetric.objects.using("analytics").bulk_create([
                ModelMetric(
                    maladie="tumeur",
                    model_id=result["model_id"],
                    metric_name="confidence",
                    metric_value=result["confidence"],
                    image_id=None,
                ),
                ModelMetric(
                    maladie="tumeur",
                    model_id=result["model_id"],
                    metric_name="latency_ms",
                    metric_value=result["latency_ms"],
                    image_id=None,
                ),
            ])
            out(self.style.SUCCESS("      OK: ModelMetric logged to analytics SQLite"))
        except Exception as exc:
            out(self.style.WARNING(f"      WARN: could not log ModelMetric: {exc}"))

        out(self.style.SUCCESS(
            "\n[preload_ophtalmologie] All steps passed. "
            f"Model cached in {CACHE_DIR}\n"
        ))
