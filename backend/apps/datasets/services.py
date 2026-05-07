"""
Dataset extraction and validation services.

Accepted zip structure:
    Images at any depth inside the ZIP — subfolders are ignored.
    Only .jpg / .jpeg / .png files are accepted.
    macOS __MACOSX metadata entries are silently skipped.

Labels are NOT read from folder names. During the ETL LOAD step, ML inference
is run on every image to determine its label (malade / sain) automatically.

validate_and_extract_zip() is pure validation — no storage side effects.
Actual MinIO uploads and ML labelling are handled by the LOAD step in
tasks/training_tasks.py.
"""
import io
import zipfile
from dataclasses import dataclass
from pathlib import Path

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


class DatasetValidationError(Exception):
    """Raised when the uploaded zip does not meet validation requirements."""


@dataclass
class RawImage:
    """Validated image extracted from a zip — not yet persisted to storage."""
    filename: str
    data: bytes


def _is_skippable(name: str) -> bool:
    """Return True for directories, macOS metadata, and hidden files."""
    return (
        name.endswith("/")
        or "__MACOSX" in name
        or Path(name).name.startswith(".")
        or Path(name).name == ""
    )


def validate_and_extract_zip(dataset, zip_bytes: bytes) -> list[RawImage]:
    """
    Parse zip_bytes, validate contents, and return a list of RawImage
    instances ready to be labelled and uploaded by the ETL LOAD step.

    Accepts images at any depth — the folder structure is irrelevant.
    Labels are determined later by ML inference, not by folder names.

    No files are written to storage here — this function is pure validation.

    Raises DatasetValidationError if validation fails.
    """
    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        raise DatasetValidationError("The uploaded file is not a valid zip archive.")

    raw_images: list[RawImage] = []

    with zf:
        for name in zf.namelist():
            if _is_skippable(name):
                continue

            filename = Path(name).name
            ext = Path(filename).suffix.lower()

            if ext not in ALLOWED_EXTENSIONS:
                raise DatasetValidationError(
                    f"Invalid file type '{ext}' in '{name}'. "
                    f"Only {', '.join(sorted(ALLOWED_EXTENSIONS))} are accepted."
                )

            data = zf.read(name)
            raw_images.append(RawImage(filename=filename, data=data))

    if not raw_images:
        raise DatasetValidationError(
            "No valid images found in the ZIP archive. "
            "Include at least one .jpg or .png file."
        )

    return raw_images
