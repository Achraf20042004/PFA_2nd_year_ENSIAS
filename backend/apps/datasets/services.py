"""
Dataset extraction and validation services.

Accepted zip structures (both work):

    Flat:
        malade/image1.jpg
        sain/image1.jpg

    Wrapped (root folder ignored):
        dataset_radiologie/malade/image1.jpg
        dataset_radiologie/sain/image1.jpg

Rules:
- Only .jpg / .jpeg / .png files are accepted.
- The first path component named 'malade' or 'sain' (case-insensitive) sets
  the label; any wrapper folders above it are ignored.
- macOS __MACOSX metadata entries are silently skipped.

validate_and_extract_zip() is pure validation — no storage side effects.
Actual MinIO uploads are handled by the LOAD step in tasks/training_tasks.py.
"""
import io
import zipfile
from dataclasses import dataclass
from pathlib import Path

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
LABELS = {"malade", "sain"}


class DatasetValidationError(Exception):
    """Raised when the uploaded zip does not meet validation requirements."""


@dataclass
class RawImage:
    """Validated image extracted from a zip — not yet persisted to storage."""
    label: str
    filename: str
    data: bytes

    @property
    def chemin(self) -> str:
        """Logical path used in validation assertions (label/filename)."""
        return f"{self.label}/{self.filename}"


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

    Scans every path component (not just the top-level one) so that ZIPs with
    a root wrapper folder — e.g. dataset_radiologie/malade/img.jpg — are
    handled the same as flat ZIPs — e.g. malade/img.jpg.
    """
    parts = Path(name).parts
    filename = parts[-1]
    for part in parts[:-1]:
        if part.lower() in LABELS:
            return part.lower(), filename
    return None, filename


def validate_and_extract_zip(dataset, zip_bytes: bytes) -> list[RawImage]:
    """
    Parse zip_bytes, validate contents, and return a list of RawImage
    instances ready to be uploaded and persisted by the ETL LOAD step.

    No files are written to storage here — this function is pure validation.

    Raises DatasetValidationError if validation fails.
    """
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
        # Pass 2 — read raw bytes and build RawImage records (no uploads)
        # ------------------------------------------------------------------ #
        raw_images: list[RawImage] = []
        for label, members in buckets.items():
            for name in members:
                data = zf.read(name)
                filename = Path(name).name
                raw_images.append(RawImage(label=label, filename=filename, data=data))

    return raw_images
