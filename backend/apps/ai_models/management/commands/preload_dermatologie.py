"""
Management command: preload and smoke-test the Dermatologie pipeline end-to-end.

Usage:
    python manage.py preload_dermatologie
    python manage.py preload_dermatologie --skip-inference

Steps executed:
    1. Create a synthetic 512x512 RGB image (simulates a skin lesion photo).
    2. Run it through SkinAdapter.preprocess() -> validates resize (224x224 RGB).
    3. Download SeyedAli/Melanoma-Classification to ml_cache/ (first run only).
    4. Run registry.predict() -> validates HuggingFace inference.
    5. Log ModelMetric entries to the analytics SQLite database.
"""
import io
import time

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Preload the Dermatologie HuggingFace model and run one image through the full pipeline."

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-inference",
            action="store_true",
            help="Test adapter preprocessing only, skip HuggingFace download and inference.",
        )

    def handle(self, *args, **options):
        skip_inference = options["skip_inference"]
        self.stdout.write("\n[preload_dermatologie] Dermatologie pipeline smoke-test\n")
        self.stdout.write("-" * 55 + "\n")

        # ------------------------------------------------------------------ #
        # Step 1 — synthetic skin lesion image (RGB, 512x512)
        # ------------------------------------------------------------------ #
        self.stdout.write("[1/4] Creating synthetic skin lesion image...")
        from PIL import Image as PILImage

        synthetic = PILImage.new("RGB", (512, 512), color=(180, 120, 100))
        buf = io.BytesIO()
        synthetic.save(buf, format="JPEG", quality=85)
        image_bytes = buf.getvalue()
        self.stdout.write(self.style.SUCCESS(
            f"      OK: {len(image_bytes)} bytes (512x512 RGB JPEG)"
        ))

        # ------------------------------------------------------------------ #
        # Step 2 — SkinAdapter: resize to 224x224, keep RGB
        # ------------------------------------------------------------------ #
        self.stdout.write("[2/4] SkinAdapter.preprocess()...")
        t0 = time.monotonic()

        from ml.adapters import get_adapter
        adapter = get_adapter("melanome")
        pil_image = adapter.preprocess(image_bytes)
        elapsed_ms = int((time.monotonic() - t0) * 1000)

        if pil_image.size != (224, 224):
            self.stdout.write(self.style.ERROR(
                f"      FAIL: expected size (224, 224), got {pil_image.size}"
            ))
            return
        if pil_image.mode != "RGB":
            self.stdout.write(self.style.ERROR(
                f"      FAIL: expected mode RGB, got {pil_image.mode}"
            ))
            return

        self.stdout.write(self.style.SUCCESS(
            f"      OK: {adapter.__class__.__name__} -> {pil_image.size} {pil_image.mode} ({elapsed_ms} ms)"
        ))

        if skip_inference:
            self.stdout.write(
                "\n[preload_dermatologie] --skip-inference: stopping after adapter test.\n"
            )
            return

        # ------------------------------------------------------------------ #
        # Step 3 — load HuggingFace model (downloads on first run)
        # ------------------------------------------------------------------ #
        self.stdout.write("[3/4] Loading HuggingFace model...")
        from ml.registry import CACHE_DIR, HUGGINGFACE_MODELS, get_pipeline

        model_id = HUGGINGFACE_MODELS["melanome"]["model_id"]
        self.stdout.write(f"      model : {model_id}")
        self.stdout.write(f"      cache : {CACHE_DIR}")

        t0 = time.monotonic()
        get_pipeline("melanome")
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        self.stdout.write(self.style.SUCCESS(f"      OK: model ready ({elapsed_ms} ms)"))

        # ------------------------------------------------------------------ #
        # Step 4 — inference + log ModelMetric to analytics SQLite
        # ------------------------------------------------------------------ #
        self.stdout.write("[4/4] Running inference + logging ModelMetric...")
        from ml.predictor import predict_image

        t0 = time.monotonic()
        result = predict_image(image_bytes, "melanome")
        elapsed_ms = int((time.monotonic() - t0) * 1000)

        self.stdout.write(self.style.SUCCESS(
            f"      OK: label={result['label']}  "
            f"confidence={result['confidence']:.4f}  "
            f"latency={result['latency_ms']} ms"
        ))
        self.stdout.write(f"      raw_label : {result['raw_label']}")

        try:
            from apps.analytics.models import ModelMetric
            ModelMetric.objects.using("analytics").bulk_create([
                ModelMetric(
                    maladie="melanome",
                    model_id=result["model_id"],
                    metric_name="confidence",
                    metric_value=result["confidence"],
                    image_id=None,
                ),
                ModelMetric(
                    maladie="melanome",
                    model_id=result["model_id"],
                    metric_name="latency_ms",
                    metric_value=result["latency_ms"],
                    image_id=None,
                ),
            ])
            self.stdout.write(self.style.SUCCESS("      OK: ModelMetric logged to analytics SQLite"))
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f"      WARN: could not log ModelMetric: {exc}"))

        self.stdout.write(self.style.SUCCESS(
            "\n[preload_dermatologie] All steps passed. "
            f"Model cached in {CACHE_DIR}\n"
        ))
