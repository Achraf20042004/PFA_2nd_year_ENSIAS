"""
Management command: preload and smoke-test the Ophtalmologie pipeline end-to-end.

Usage:
    python manage.py preload_ophtalmologie
    python manage.py preload_ophtalmologie --skip-inference

Steps executed:
    1. Create a synthetic 512x512 RGB image (simulates a fundus photograph).
    2. Run it through FundusAdapter.preprocess() -> validates resize (256x256 RGB).
    3. Reuse nickmuchi/vit-finetuned-chest-xray-pneumonia from ml_cache/ (placeholder).
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
        out("\n[preload_ophtalmologie] Ophtalmologie pipeline smoke-test\n")
        out("-" * 55 + "\n")

        # ------------------------------------------------------------------ #
        # Step 1 — synthetic fundus image (RGB, 512x512)
        # ------------------------------------------------------------------ #
        out("[1/4] Creating synthetic fundus image...")
        from PIL import Image as PILImage

        synthetic = PILImage.new("RGB", (512, 512), color=(80, 30, 30))
        buf = io.BytesIO()
        synthetic.save(buf, format="JPEG", quality=85)
        image_bytes = buf.getvalue()
        out(self.style.SUCCESS(f"      OK: {len(image_bytes)} bytes (512x512 RGB JPEG)"))

        # ------------------------------------------------------------------ #
        # Step 2 — FundusAdapter: resize to 256x256, keep RGB
        # ------------------------------------------------------------------ #
        out("[2/4] FundusAdapter.preprocess()...")
        t0 = time.monotonic()

        from ml.adapters import get_adapter
        adapter = get_adapter("retinopathie")
        pil_image = adapter.preprocess(image_bytes)
        elapsed_ms = int((time.monotonic() - t0) * 1000)

        if pil_image.size != (256, 256):
            out(self.style.ERROR(f"      FAIL: expected size (256, 256), got {pil_image.size}"))
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

        model_id = HUGGINGFACE_MODELS["retinopathie"]["model_id"]
        out(f"      model : {model_id}")
        out(f"      cache : {CACHE_DIR}")

        t0 = time.monotonic()
        try:
            get_pipeline("retinopathie")
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
        result = predict_image(image_bytes, "retinopathie")
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
                    maladie="retinopathie",
                    model_id=result["model_id"],
                    metric_name="confidence",
                    metric_value=result["confidence"],
                    image_id=None,
                ),
                ModelMetric(
                    maladie="retinopathie",
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
