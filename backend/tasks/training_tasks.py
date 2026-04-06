"""
Celery tasks for dataset processing and AI model training.
"""
import logging

from config.celery import app

logger = logging.getLogger(__name__)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_dataset_zip(self, dataset_id: int):
    """
    Process an uploaded dataset zip file:
      1. Mark dataset as PROCESSING.
      2. Read zip from storage, validate structure and file types.
      3. Extract and upload individual images to storage.
      4. Create Image records in the database.
      5. Mark dataset as READY (or ERROR on failure).

    Triggered immediately after a successful upload.
    AI fine-tuning (Phase 2) will be triggered from here once ready.
    """
    from apps.datasets.models import Dataset, Image
    from apps.datasets.services import DatasetValidationError, validate_and_extract_zip

    try:
        dataset = Dataset.objects.get(id=dataset_id)
    except Dataset.DoesNotExist:
        logger.error("process_dataset_zip: Dataset %s not found.", dataset_id)
        return

    dataset.statut = Dataset.Statut.PROCESSING
    dataset.error_message = ""
    dataset.save(update_fields=["statut", "error_message"])
    logger.info("Processing dataset %s (%s).", dataset_id, dataset.maladie)

    try:
        zip_bytes = dataset.fichier_zip.read()
        image_records = validate_and_extract_zip(dataset, zip_bytes)

        Image.objects.bulk_create(image_records)

        dataset.statut = Dataset.Statut.READY
        dataset.nb_images = len(image_records)
        dataset.save(update_fields=["statut", "nb_images"])
        logger.info(
            "Dataset %s ready — %d images extracted.", dataset_id, len(image_records)
        )

        # Phase 2: trigger AI fine-tuning here
        # train_model.delay(dataset_id)

    except DatasetValidationError as exc:
        logger.warning("Dataset %s validation failed: %s", dataset_id, exc)
        dataset.statut = Dataset.Statut.ERROR
        dataset.error_message = str(exc)
        dataset.save(update_fields=["statut", "error_message"])

    except Exception as exc:
        logger.exception("Unexpected error processing dataset %s.", dataset_id)
        dataset.statut = Dataset.Statut.ERROR
        dataset.error_message = f"Unexpected error: {exc}"
        dataset.save(update_fields=["statut", "error_message"])
        raise self.retry(exc=exc)


@app.task(bind=True)
def train_model(self, dataset_id: int):
    """Trigger AI fine-tuning for a given dataset. Implemented in Phase 2."""
    raise NotImplementedError("AI pipeline — Phase 2")
