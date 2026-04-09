"""
Celery tasks for dataset processing and AI model inference setup.
"""
import logging
import time
import uuid

from config.celery import app

logger = logging.getLogger(__name__)


def _log_etl(run_id: str, dataset_id: int, step: str, status: str,
             message: str = "", duration_ms: int | None = None) -> None:
    """Write one ETL log entry to the analytics SQLite database."""
    try:
        from apps.analytics.models import ETLLog
        ETLLog.objects.using("analytics").create(
            pipeline_run_id=run_id,
            dataset_id=dataset_id,
            step=step,
            status=status,
            message=message,
            duration_ms=duration_ms,
        )
    except Exception:
        # Analytics logging must never interrupt the main pipeline.
        logger.exception("Failed to write ETLLog (%s / %s).", step, status)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_dataset_zip(self, dataset_id: int):
    """
    Process an uploaded dataset zip file:
      1. Mark dataset as PROCESSING.
      2. Read zip from storage, validate structure and file types.
      3. Extract and upload individual images to storage.
      4. Preprocess a sample image through the domain adapter (smoke-test).
      5. Create Image records in the database.
      6. Mark dataset as READY (or ERROR on failure).
      7. Log each ETL step to the analytics SQLite database.

    Triggered immediately after a successful upload.
    """
    from apps.datasets.models import Dataset, Image
    from apps.datasets.services import DatasetValidationError, validate_and_extract_zip

    run_id = str(uuid.uuid4())

    try:
        dataset = Dataset.objects.get(id=dataset_id)
    except Dataset.DoesNotExist:
        logger.error("process_dataset_zip: Dataset %s not found.", dataset_id)
        return

    dataset.statut = Dataset.Statut.PROCESSING
    dataset.error_message = ""
    dataset.save(update_fields=["statut", "error_message"])
    logger.info("Processing dataset %s (%s) [run=%s].", dataset_id, dataset.maladie, run_id)

    # ------------------------------------------------------------------ #
    # Step: extract
    # ------------------------------------------------------------------ #
    _log_etl(run_id, dataset_id, "extract", "started")
    t0 = time.monotonic()
    try:
        zip_bytes = dataset.fichier_zip.read()
    except Exception as exc:
        duration = int((time.monotonic() - t0) * 1000)
        _log_etl(run_id, dataset_id, "extract", "error",
                 message=f"Could not read zip file: {exc}", duration_ms=duration)
        dataset.statut = Dataset.Statut.ERROR
        dataset.error_message = f"Could not read zip file: {exc}"
        dataset.save(update_fields=["statut", "error_message"])
        return

    duration = int((time.monotonic() - t0) * 1000)
    _log_etl(run_id, dataset_id, "extract", "success",
             message=f"{len(zip_bytes)} bytes read", duration_ms=duration)

    # ------------------------------------------------------------------ #
    # Step: validate
    # ------------------------------------------------------------------ #
    _log_etl(run_id, dataset_id, "validate", "started")
    t0 = time.monotonic()
    try:
        image_records = validate_and_extract_zip(dataset, zip_bytes)
    except DatasetValidationError as exc:
        duration = int((time.monotonic() - t0) * 1000)
        _log_etl(run_id, dataset_id, "validate", "error",
                 message=str(exc), duration_ms=duration)
        logger.warning("Dataset %s validation failed: %s", dataset_id, exc)
        dataset.statut = Dataset.Statut.ERROR
        dataset.error_message = str(exc)
        dataset.save(update_fields=["statut", "error_message"])
        return
    except Exception as exc:
        duration = int((time.monotonic() - t0) * 1000)
        _log_etl(run_id, dataset_id, "validate", "error",
                 message=f"Unexpected error: {exc}", duration_ms=duration)
        logger.exception("Unexpected error validating dataset %s.", dataset_id)
        dataset.statut = Dataset.Statut.ERROR
        dataset.error_message = f"Unexpected error: {exc}"
        dataset.save(update_fields=["statut", "error_message"])
        raise self.retry(exc=exc)

    duration = int((time.monotonic() - t0) * 1000)
    _log_etl(run_id, dataset_id, "validate", "success",
             message=f"{len(image_records)} images validated", duration_ms=duration)

    # ------------------------------------------------------------------ #
    # Step: transform  (adapter smoke-test — verify domain adapter exists)
    # ------------------------------------------------------------------ #
    _log_etl(run_id, dataset_id, "transform", "started")
    t0 = time.monotonic()
    try:
        from ml.adapters import get_adapter
        adapter = get_adapter(dataset.maladie)
        duration = int((time.monotonic() - t0) * 1000)
        _log_etl(run_id, dataset_id, "transform", "success",
                 message=f"Adapter {adapter.__class__.__name__} ready",
                 duration_ms=duration)
        logger.info("Domain adapter for '%s': %s", dataset.maladie, adapter.__class__.__name__)
    except ValueError as exc:
        duration = int((time.monotonic() - t0) * 1000)
        # Unknown disease — not fatal; log a warning and continue
        _log_etl(run_id, dataset_id, "transform", "error",
                 message=str(exc), duration_ms=duration)
        logger.warning("No adapter for disease '%s': %s", dataset.maladie, exc)

    # ------------------------------------------------------------------ #
    # Step: load
    # ------------------------------------------------------------------ #
    _log_etl(run_id, dataset_id, "load", "started")
    t0 = time.monotonic()
    try:
        Image.objects.bulk_create(image_records)
        dataset.statut = Dataset.Statut.READY
        dataset.nb_images = len(image_records)
        dataset.save(update_fields=["statut", "nb_images"])
    except Exception as exc:
        duration = int((time.monotonic() - t0) * 1000)
        _log_etl(run_id, dataset_id, "load", "error",
                 message=f"DB write failed: {exc}", duration_ms=duration)
        logger.exception("Unexpected error loading dataset %s.", dataset_id)
        dataset.statut = Dataset.Statut.ERROR
        dataset.error_message = f"Unexpected error: {exc}"
        dataset.save(update_fields=["statut", "error_message"])
        raise self.retry(exc=exc)

    duration = int((time.monotonic() - t0) * 1000)
    _log_etl(run_id, dataset_id, "load", "success",
             message=f"{len(image_records)} images saved", duration_ms=duration)
    logger.info(
        "Dataset %s ready — %d images extracted [run=%s].",
        dataset_id, len(image_records), run_id,
    )

    # Phase 2: HuggingFace inference is triggered at attempt time (on-demand),
    # not during ETL. See ml/registry.py predict() and ml/adapters.py.


@app.task(bind=True)
def generate_gradcam_task(self, image_result_id: int) -> None:
    """
    Generate a Grad-CAM attention heatmap for a single incorrect ImageResult.

    Steps:
      1. Load the ImageResult from the database.
      2. Read the original image bytes from storage.
      3. Generate a heatmap overlay via ml.gradcam.generate_heatmap().
      4. Save the PNG to storage (gradcam/<attempt_id>/<image_id>_gradcam.png).
      5. Update ImageResult.gradcam_path.

    This task never raises — Grad-CAM is cosmetic and must not break anything.
    """
    try:
        from django.core.files.base import ContentFile
        from django.core.files.storage import default_storage

        from apps.results.models import ImageResult
        from ml.gradcam import generate_heatmap

        try:
            ir = ImageResult.objects.select_related(
                "image", "attempt__exercise"
            ).get(id=image_result_id)
        except ImageResult.DoesNotExist:
            logger.warning("generate_gradcam_task: ImageResult %s not found.", image_result_id)
            return

        maladie = ir.attempt.exercise.maladie

        try:
            with default_storage.open(ir.image.chemin) as fh:
                image_bytes = fh.read()
        except Exception as exc:
            logger.warning(
                "generate_gradcam_task: Cannot read image %s: %s", ir.image.chemin, exc
            )
            return

        png_bytes = generate_heatmap(maladie, image_bytes)

        dest = f"gradcam/{ir.attempt_id}/{ir.image_id}_gradcam.png"
        saved_path = default_storage.save(dest, ContentFile(png_bytes))

        ir.gradcam_path = saved_path
        ir.save(update_fields=["gradcam_path"])

        logger.info(
            "Grad-CAM saved to %s for ImageResult %s.", saved_path, image_result_id
        )

    except Exception:
        # Grad-CAM is cosmetic — swallow all errors
        logger.exception(
            "generate_gradcam_task: Unexpected error for ImageResult %s.", image_result_id
        )


@app.task(bind=True)
def run_inference(self, image_id: int, maladie: str) -> dict:
    """
    Run HuggingFace inference on a single image and persist the metric.

    Returns:
        {"label": "malade"|"sain", "confidence": float, "raw_label": str}
    """
    import io
    import time

    from django.core.files.storage import default_storage

    from apps.analytics.models import ModelMetric
    from ml.adapters import get_adapter
    from ml.registry import HUGGINGFACE_MODELS, predict

    try:
        from apps.datasets.models import Image as MedImage
        image_obj = MedImage.objects.get(id=image_id)
    except Exception as exc:
        logger.error("run_inference: Image %s not found: %s", image_id, exc)
        raise

    # Preprocess
    adapter = get_adapter(maladie)
    raw_bytes = default_storage.open(image_obj.chemin).read()
    pil_image = adapter.preprocess(raw_bytes)

    # Infer
    t0 = time.monotonic()
    result = predict(maladie, pil_image)
    latency_ms = int((time.monotonic() - t0) * 1000)

    model_id = HUGGINGFACE_MODELS[maladie.lower()]["model_id"]

    # Log metrics to analytics DB
    try:
        ModelMetric.objects.using("analytics").bulk_create([
            ModelMetric(
                maladie=maladie,
                model_id=model_id,
                metric_name="confidence",
                metric_value=result["confidence"],
                image_id=image_id,
            ),
            ModelMetric(
                maladie=maladie,
                model_id=model_id,
                metric_name="latency_ms",
                metric_value=latency_ms,
                image_id=image_id,
            ),
        ])
    except Exception:
        logger.exception("Failed to write ModelMetric for image %s.", image_id)

    return result
