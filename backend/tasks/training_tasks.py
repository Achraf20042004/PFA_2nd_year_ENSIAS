"""
Celery tasks for dataset processing and AI model inference setup.
"""
import io
import logging
import time
import uuid
from pathlib import Path

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
      3. Smoke-test the domain adapter on a sample image (in-memory).
      4. Upload original images to MinIO: datasets/{id}/images/{random}{ext}
         Upload preprocessed images to MinIO: datasets/{id}/preprocessed/{random}{ext}
         Random names: the public URL must not reveal the label (path or filename).
         Create Image records with the saved MinIO paths.
      5. Mark dataset as READY (or ERROR on failure).
      6. Log each ETL step to the analytics SQLite database.
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
    # Step: validate — pure in-memory; no storage writes
    # ------------------------------------------------------------------ #
    _log_etl(run_id, dataset_id, "validate", "started")
    t0 = time.monotonic()
    try:
        raw_items = validate_and_extract_zip(dataset, zip_bytes)
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
             message=f"{len(raw_items)} images validated — labels determined by ML in load step",
             duration_ms=duration)
    logger.info("Dataset %s validated: %d images ready for ML labelling.", dataset_id, len(raw_items))

    # ------------------------------------------------------------------ #
    # Step: transform — smoke-test the adapter on a sample image in-memory.
    # Uses raw bytes directly (no storage reads) since files aren't uploaded yet.
    # ------------------------------------------------------------------ #
    _log_etl(run_id, dataset_id, "transform", "started")
    t0 = time.monotonic()
    if not raw_items:
        _log_etl(run_id, dataset_id, "transform", "skipped",
                 message="No images extracted — skipping adapter smoke-test.",
                 duration_ms=int((time.monotonic() - t0) * 1000))
        logger.warning("Dataset %s: 0 images extracted; skipping transform smoke-test.", dataset_id)
    else:
        try:
            from ml.adapters import get_adapter

            adapter = get_adapter(dataset.maladie)
            sample_bytes = raw_items[0].data
            preprocessed = adapter.preprocess(sample_bytes)

            duration = int((time.monotonic() - t0) * 1000)
            _log_etl(
                run_id, dataset_id, "transform", "success",
                message=(
                    f"{adapter.__class__.__name__}: "
                    f"{preprocessed.size[0]}x{preprocessed.size[1]} {preprocessed.mode}; "
                    f"{len(raw_items)} images ready for inference"
                ),
                duration_ms=duration,
            )
            logger.info(
                "Transform smoke-test passed for '%s': %s -> %s %s.",
                dataset.maladie, adapter.__class__.__name__, preprocessed.size, preprocessed.mode,
            )
        except ValueError as exc:
            duration = int((time.monotonic() - t0) * 1000)
            _log_etl(run_id, dataset_id, "transform", "error",
                     message=str(exc), duration_ms=duration)
            logger.warning("No adapter for disease '%s': %s", dataset.maladie, exc)
        except Exception as exc:
            duration = int((time.monotonic() - t0) * 1000)
            _log_etl(run_id, dataset_id, "transform", "error",
                     message=f"Adapter smoke-test failed: {exc}", duration_ms=duration)
            logger.warning("Transform smoke-test failed for dataset %s: %s", dataset_id, exc)
            # Non-fatal — dataset proceeds to load step

    # ------------------------------------------------------------------ #
    # Step: load — upload to MinIO via boto3 then persist Image records
    # ------------------------------------------------------------------ #
    _log_etl(run_id, dataset_id, "load", "started")
    t0 = time.monotonic()
    try:
        import boto3
        from botocore.client import Config as BotocoreConfig
        from django.conf import settings

        from ml.adapters import get_adapter
        from ml.registry import predict

        # When MINIO_ENDPOINT is empty (test environment) fall back to
        # default_storage so tests don't need a live MinIO.
        use_minio = bool(settings.MINIO_ENDPOINT)

        if use_minio:
            s3 = boto3.client(
                "s3",
                endpoint_url=f"http://{settings.MINIO_ENDPOINT}",
                aws_access_key_id=settings.MINIO_ACCESS_KEY,
                aws_secret_access_key=settings.MINIO_SECRET_KEY,
                config=BotocoreConfig(signature_version="s3v4"),
                verify=False,
            )
            bucket = settings.MINIO_BUCKET
        else:
            from django.core.files.base import ContentFile
            from django.core.files.storage import default_storage

        # Resolve adapter once; None means we cannot label images via ML.
        try:
            adapter = get_adapter(dataset.maladie)
        except ValueError:
            adapter = None
            logger.warning(
                "No adapter for disease '%s' — all images will be skipped.",
                dataset.maladie,
            )

        image_records: list[Image] = []
        upload_errors = 0

        for item in raw_items:
            filename = item.filename
            raw_bytes = item.data
            ext = Path(filename).suffix.lower()

            # 1. Preprocess + ML inference to determine label ("malade" / "sain")
            if adapter is None:
                upload_errors += 1
                logger.warning("No adapter for '%s' — skipping %s.", dataset.maladie, filename)
                continue

            try:
                pil_img = adapter.preprocess(raw_bytes)
                result = predict(dataset.maladie, pil_img)
                label = result["label"]
                logger.info("ML label for %s: %s (confidence=%.3f)", filename, label, result["confidence"])
            except Exception as exc:
                upload_errors += 1
                logger.warning("ML inference failed for %s — skipping: %s", filename, exc)
                continue

            # 2. Upload original image under a random name so the public URL
            #    does not reveal the answer to students
            stored_name = f"{uuid.uuid4().hex}{ext}"
            orig_key = f"datasets/{dataset_id}/images/{stored_name}"
            try:
                if use_minio:
                    s3.upload_fileobj(
                        io.BytesIO(raw_bytes),
                        bucket,
                        orig_key,
                        ExtraArgs={"ACL": "public-read"},
                    )
                else:
                    default_storage.save(orig_key, ContentFile(raw_bytes))
            except Exception as exc:
                upload_errors += 1
                logger.error("Failed to upload %s: %s", orig_key, exc)
                continue  # skip this image, do not add a DB record

            # 3. Upload preprocessed image (non-fatal) — pil_img already computed
            try:
                buf = io.BytesIO()
                fmt = "JPEG" if ext in (".jpg", ".jpeg") else "PNG"
                pil_img.save(buf, format=fmt)
                buf.seek(0)
                pre_key = f"datasets/{dataset_id}/preprocessed/{stored_name}"
                if use_minio:
                    s3.upload_fileobj(
                        buf,
                        bucket,
                        pre_key,
                        ExtraArgs={"ACL": "public-read"},
                    )
                else:
                    default_storage.save(pre_key, ContentFile(buf.getvalue()))
            except Exception as exc:
                logger.warning("Preprocessed upload skipped for %s: %s", filename, exc)

            # 4. Record the MinIO key as the canonical path
            image_records.append(
                Image(dataset=dataset, chemin=orig_key, label=label)
            )

        if not image_records:
            raise RuntimeError(
                f"No images were uploaded — {upload_errors} upload error(s). "
                "Check Celery logs for details."
            )

        Image.objects.bulk_create(image_records)
        dataset.statut = Dataset.Statut.READY
        dataset.nb_images = len(image_records)
        dataset.save(update_fields=["statut", "nb_images"])

    except Exception as exc:
        duration = int((time.monotonic() - t0) * 1000)
        _log_etl(run_id, dataset_id, "load", "error",
                 message=f"Load failed: {exc}", duration_ms=duration)
        logger.exception("Unexpected error loading dataset %s.", dataset_id)
        dataset.statut = Dataset.Statut.ERROR
        dataset.error_message = f"Unexpected error: {exc}"
        dataset.save(update_fields=["statut", "error_message"])
        raise self.retry(exc=exc)

    malade_saved = sum(1 for img in image_records if img.label == "malade")
    sain_saved = sum(1 for img in image_records if img.label == "sain")
    duration = int((time.monotonic() - t0) * 1000)
    skipped_msg = f" ({upload_errors} skipped)" if upload_errors else ""
    _log_etl(run_id, dataset_id, "load", "success",
             message=(
                 f"{len(image_records)} images saved to MinIO "
                 f"(malade={malade_saved}, sain={sain_saved}){skipped_msg}"
             ),
             duration_ms=duration)
    logger.info(
        "Dataset %s ready — %d images (malade=%d, sain=%d) uploaded to MinIO [run=%s].",
        dataset_id, len(image_records), malade_saved, sain_saved, run_id,
    )


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
