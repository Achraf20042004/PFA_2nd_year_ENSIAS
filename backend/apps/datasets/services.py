"""
Dataset extraction and validation services.

Expected zip structure:
    malade/
        image1.jpg
        image2.png
        ...
    sain/
        image1.jpg
        ...

Rules:
- Only .jpg / .jpeg / .png files are accepted.
- Each label directory must contain at least MIN_IMAGES_PER_LABEL images.
- Files outside malade/ or sain/ top-level directories are ignored.
- macOS __MACOSX metadata entries are silently skipped.
"""
import io
import zipfile
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MIN_IMAGES_PER_LABEL = 10
LABELS = {"malade", "sain"}


class DatasetValidationError(Exception):
    """Raised when the uploaded zip does not meet validation requirements."""


def _is_skippable(name: str) -> bool:
    """Return True for directories, macOS metadata, and hidden files."""
    return (
        name.endswith("/")
        or "__MACOSX" in name
        or Path(name).name.startswith(".")
        or Path(name).name == ""
    )


def _classify_member(name: str) -> tuple[str | None, str]:
    """
    Return (label, filename) if the zip member belongs to a label directory,
    or (None, filename) if it should be ignored.
    """
    parts = Path(name).parts
    if len(parts) < 2:
        return None, Path(name).name
    top_dir = parts[0].lower()
    filename = parts[-1]
    if top_dir in LABELS:
        return top_dir, filename
    return None, filename


def validate_and_extract_zip(dataset, zip_bytes: bytes) -> list:
    """
    Parse zip_bytes, validate contents, upload individual images to storage,
    and return a list of unsaved Image model instances.

    Raises DatasetValidationError if validation fails.
    """
    from apps.datasets.models import Image

    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        raise DatasetValidationError("The uploaded file is not a valid zip archive.")

    with zf:
        # ------------------------------------------------------------------ #
        # Pass 1 — categorise and validate every member
        # ------------------------------------------------------------------ #
        buckets: dict[str, list[str]] = {"malade": [], "sain": []}

        for name in zf.namelist():
            if _is_skippable(name):
                continue

            label, filename = _classify_member(name)
            if label is None:
                continue  # file at root or unknown top-level dir — ignore

            ext = Path(filename).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise DatasetValidationError(
                    f"Invalid file type '{ext}' in '{name}'. "
                    f"Only {', '.join(sorted(ALLOWED_EXTENSIONS))} are accepted."
                )

            buckets[label].append(name)

        # ------------------------------------------------------------------ #
        # Pass 2 — enforce minimum image counts
        # ------------------------------------------------------------------ #
        for label in LABELS:
            count = len(buckets[label])
            if count < MIN_IMAGES_PER_LABEL:
                raise DatasetValidationError(
                    f"Not enough '{label}' images: found {count}, "
                    f"minimum required is {MIN_IMAGES_PER_LABEL}."
                )

        # ------------------------------------------------------------------ #
        # Pass 3 — upload images and build Image records
        # ------------------------------------------------------------------ #
        image_records = []
        for label, members in buckets.items():
            for name in members:
                data = zf.read(name)
                filename = Path(name).name
                dest = f"datasets/{dataset.id}/images/{label}/{filename}"
                saved_path = default_storage.save(dest, ContentFile(data))
                image_records.append(
                    Image(dataset=dataset, chemin=saved_path, label=label)
                )

    return image_records
