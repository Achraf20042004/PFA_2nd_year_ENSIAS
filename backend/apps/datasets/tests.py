"""
Tests for the datasets app.

Coverage:
- DatasetUploadView: success, non-zip file, only prof can upload
- process_dataset_zip task: valid zip, invalid extension, too few images, bad zip
- DatasetStatusView: owner, admin, foreign prof, student, not found
- DatasetListView: prof sees own, admin sees all
- validate_and_extract_zip service: unit tests for each failure mode
"""
import io
import zipfile

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.services import generate_jwt_for_user
from apps.datasets.models import Dataset, Image
from apps.datasets.services import (
    DatasetValidationError,
    validate_and_extract_zip,
)

User = get_user_model()
UPLOAD_URL = "/api/datasets/upload/"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_zip(malade_count=5, sain_count=5,
             extra_files=None, bad_extension_in=None):
    buf = io.BytesIO()
    fake_jpg = b"\xff\xd8\xff\xe0" + b"\x00" * 100
    with zipfile.ZipFile(buf, "w") as zf:
        for i in range(malade_count):
            ext = ".pdf" if bad_extension_in == "malade" and i == 0 else ".jpg"
            zf.writestr(f"malade/img_{i}{ext}", fake_jpg)
        for i in range(sain_count):
            ext = ".pdf" if bad_extension_in == "sain" and i == 0 else ".jpg"
            zf.writestr(f"sain/img_{i}{ext}", fake_jpg)
        if extra_files:
            for path, data in extra_files.items():
                zf.writestr(path, data)
    return buf.getvalue()


def make_upload_file(data, name="dataset.zip"):
    return SimpleUploadedFile(name, data, content_type="application/zip")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def prof(db):
    u = User(email="prof@example.com", username="prof@example.com", role=User.Role.PROF)
    u.set_password("pass")
    u.save()
    return u


@pytest.fixture
def other_prof(db):
    u = User(email="prof2@example.com", username="prof2@example.com", role=User.Role.PROF)
    u.set_password("pass")
    u.save()
    return u


@pytest.fixture
def student(db):
    u = User(email="stu@example.com", username="stu@example.com", role=User.Role.ETUDIANT)
    u.set_password("pass")
    u.save()
    return u


@pytest.fixture
def admin(db):
    u = User(email="admin@example.com", username="admin@example.com", role=User.Role.ADMIN)
    u.set_password("pass")
    u.save()
    return u


def auth(api_client, user):
    tokens = generate_jwt_for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return api_client


@pytest.fixture
def prof_client(api_client, prof):
    return auth(api_client, prof)


@pytest.fixture
def student_client(api_client, student):
    return auth(api_client, student)


@pytest.fixture
def admin_client(api_client, admin):
    return auth(api_client, admin)


@pytest.fixture
def dataset(db, prof):
    return Dataset.objects.create(
        prof=prof,
        maladie="Pneumonie",
        fichier_zip=make_upload_file(make_zip()),
        statut=Dataset.Statut.READY,
        nb_images=10,
    )


# ---------------------------------------------------------------------------
# validate_and_extract_zip service unit tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestValidateAndExtractZip:

    def _ds(self, prof):
        return Dataset.objects.create(
            prof=prof, maladie="Test", fichier_zip=make_upload_file(b"placeholder")
        )

    def test_valid_zip_returns_image_records(self, prof):
        records = validate_and_extract_zip(self._ds(prof), make_zip())
        assert len(records) == 10  # 5 malade + 5 sain
        assert {r.label for r in records} == {"malade", "sain"}

    def test_small_zip_accepted(self, prof):
        records = validate_and_extract_zip(self._ds(prof), make_zip(malade_count=1, sain_count=1))
        assert len(records) == 2

    def test_invalid_extension_raises(self, prof):
        with pytest.raises(DatasetValidationError, match="Invalid file type"):
            validate_and_extract_zip(self._ds(prof), make_zip(bad_extension_in="malade"))

    def test_not_a_zip_raises(self, prof):
        with pytest.raises(DatasetValidationError, match="not a valid zip"):
            validate_and_extract_zip(self._ds(prof), b"not a zip file")

    def test_macos_metadata_skipped(self, prof):
        extra = {"__MACOSX/malade/._img.jpg": b"meta"}
        records = validate_and_extract_zip(self._ds(prof), make_zip(extra_files=extra))
        assert all("__MACOSX" not in r.chemin for r in records)

    def test_root_level_files_ignored(self, prof):
        extra = {"stray.jpg": b"\xff\xd8\xff"}
        records = validate_and_extract_zip(self._ds(prof), make_zip(extra_files=extra))
        assert not any(r.chemin.endswith("stray.jpg") for r in records)

    def test_png_files_accepted(self, prof):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            for i in range(5):
                zf.writestr(f"malade/img_{i}.png", b"\x89PNG\r\n")
                zf.writestr(f"sain/img_{i}.png", b"\x89PNG\r\n")
        records = validate_and_extract_zip(self._ds(prof), buf.getvalue())
        assert len(records) == 10


# ---------------------------------------------------------------------------
# process_dataset_zip Celery task
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestProcessDatasetZipTask:

    def _ds(self, prof, zip_data=None, name="dataset.zip"):
        return Dataset.objects.create(
            prof=prof, maladie="Pneumonie",
            fichier_zip=make_upload_file(zip_data or make_zip(), name=name),
        )

    def test_valid_zip_sets_ready(self, prof):
        from tasks.training_tasks import process_dataset_zip
        dataset = self._ds(prof)
        process_dataset_zip.delay(dataset.id)
        dataset.refresh_from_db()
        assert dataset.statut == Dataset.Statut.READY
        assert dataset.nb_images == 10  # 5 malade + 5 sain
        assert dataset.error_message == ""

    def test_valid_zip_creates_image_records(self, prof):
        from tasks.training_tasks import process_dataset_zip
        dataset = self._ds(prof)
        process_dataset_zip.delay(dataset.id)
        assert Image.objects.filter(dataset=dataset, label="malade").count() == 5
        assert Image.objects.filter(dataset=dataset, label="sain").count() == 5

    def test_small_zip_sets_ready(self, prof):
        from tasks.training_tasks import process_dataset_zip
        dataset = self._ds(prof, make_zip(malade_count=1, sain_count=1))
        process_dataset_zip.delay(dataset.id)
        dataset.refresh_from_db()
        assert dataset.statut == Dataset.Statut.READY
        assert dataset.nb_images == 2

    def test_invalid_extension_sets_error(self, prof):
        from tasks.training_tasks import process_dataset_zip
        dataset = self._ds(prof, make_zip(bad_extension_in="sain"))
        process_dataset_zip.delay(dataset.id)
        dataset.refresh_from_db()
        assert dataset.statut == Dataset.Statut.ERROR
        assert "Invalid file type" in dataset.error_message

    def test_corrupt_zip_sets_error(self, prof):
        from tasks.training_tasks import process_dataset_zip
        dataset = self._ds(prof, b"not a zip", name="bad.zip")
        process_dataset_zip.delay(dataset.id)
        dataset.refresh_from_db()
        assert dataset.statut == Dataset.Statut.ERROR
        assert "not a valid zip" in dataset.error_message

    def test_missing_dataset_id_does_not_raise(self):
        from tasks.training_tasks import process_dataset_zip
        process_dataset_zip.delay(99999)  # must not raise


# ---------------------------------------------------------------------------
# Upload endpoint — POST /api/datasets/upload/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDatasetUploadView:

    def test_prof_can_upload_valid_zip(self, prof_client):
        response = prof_client.post(
            UPLOAD_URL,
            {"maladie": "Pneumonie", "fichier_zip": make_upload_file(make_zip())},
            format="multipart",
        )
        assert response.status_code == status.HTTP_202_ACCEPTED
        data = response.json()
        assert data["maladie"] == "Pneumonie"
        assert "id" in data

    def test_upload_creates_dataset_in_db(self, prof_client, prof):
        prof_client.post(
            UPLOAD_URL,
            {"maladie": "Tuberculose", "fichier_zip": make_upload_file(make_zip())},
            format="multipart",
        )
        assert Dataset.objects.filter(prof=prof, maladie="Tuberculose").exists()

    @pytest.mark.django_db(transaction=True)
    def test_task_runs_eagerly_and_dataset_is_ready(self, prof_client, prof):
        # transaction=True required: on_commit() only fires on a real commit,
        # not inside pytest-django's default rollback-wrapped test transaction.
        prof_client.post(
            UPLOAD_URL,
            {"maladie": "Pneumonie", "fichier_zip": make_upload_file(make_zip())},
            format="multipart",
        )
        dataset = Dataset.objects.get(prof=prof, maladie="Pneumonie")
        assert dataset.statut == Dataset.Statut.READY

    def test_student_cannot_upload(self, student_client):
        response = student_client.post(
            UPLOAD_URL,
            {"maladie": "X", "fichier_zip": make_upload_file(make_zip())},
            format="multipart",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_upload(self, api_client):
        response = api_client.post(
            UPLOAD_URL,
            {"maladie": "X", "fichier_zip": make_upload_file(make_zip())},
            format="multipart",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_non_zip_file_rejected(self, prof_client):
        f = SimpleUploadedFile("report.pdf", b"pdf content", content_type="application/pdf")
        response = prof_client.post(
            UPLOAD_URL, {"maladie": "X", "fichier_zip": f}, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "zip" in str(response.json()).lower()

    def test_missing_maladie_rejected(self, prof_client):
        response = prof_client.post(
            UPLOAD_URL, {"fichier_zip": make_upload_file(make_zip())}, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_file_rejected(self, prof_client):
        response = prof_client.post(UPLOAD_URL, {"maladie": "X"}, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_admin_can_upload(self, admin_client):
        response = admin_client.post(
            UPLOAD_URL,
            {"maladie": "Pneumonie", "fichier_zip": make_upload_file(make_zip())},
            format="multipart",
        )
        assert response.status_code == status.HTTP_202_ACCEPTED


# ---------------------------------------------------------------------------
# Status endpoint — GET /api/datasets/{id}/status/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDatasetStatusView:

    def test_owner_can_check_status(self, prof_client, dataset):
        response = prof_client.get(f"/api/datasets/{dataset.id}/status/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["statut"] == Dataset.Statut.READY
        assert data["nb_images"] == 10

    def test_error_message_exposed(self, prof_client, prof):
        ds = Dataset.objects.create(
            prof=prof, maladie="X",
            fichier_zip=make_upload_file(b"placeholder"),
            statut=Dataset.Statut.ERROR,
            error_message="Not enough images.",
        )
        response = prof_client.get(f"/api/datasets/{ds.id}/status/")
        assert response.status_code == status.HTTP_200_OK
        assert "Not enough images" in response.json()["error_message"]

    def test_admin_can_check_any_dataset(self, admin_client, dataset):
        response = admin_client.get(f"/api/datasets/{dataset.id}/status/")
        assert response.status_code == status.HTTP_200_OK

    def test_other_prof_gets_404(self, api_client, other_prof, dataset):
        auth(api_client, other_prof)
        response = api_client.get(f"/api/datasets/{dataset.id}/status/")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_student_gets_404(self, student_client, dataset):
        response = student_client.get(f"/api/datasets/{dataset.id}/status/")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_nonexistent_dataset_returns_404(self, prof_client):
        response = prof_client.get("/api/datasets/99999/status/")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated_returns_401(self, api_client, dataset):
        response = api_client.get(f"/api/datasets/{dataset.id}/status/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# List endpoint — GET /api/datasets/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestDatasetListView:

    def test_prof_sees_only_own_datasets(self, prof_client, prof, other_prof):
        Dataset.objects.create(prof=prof, maladie="Mine", fichier_zip=make_upload_file(b"x"))
        Dataset.objects.create(prof=other_prof, maladie="Theirs", fichier_zip=make_upload_file(b"x"))
        response = prof_client.get("/api/datasets/")
        assert response.status_code == status.HTTP_200_OK
        names = [d["maladie"] for d in response.json()["results"]]
        assert "Mine" in names
        assert "Theirs" not in names

    def test_admin_sees_all_datasets(self, admin_client, prof, other_prof):
        Dataset.objects.create(prof=prof, maladie="A", fichier_zip=make_upload_file(b"x"))
        Dataset.objects.create(prof=other_prof, maladie="B", fichier_zip=make_upload_file(b"x"))
        response = admin_client.get("/api/datasets/")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["count"] >= 2

    def test_student_gets_403(self, student_client):
        response = student_client.get("/api/datasets/")
        assert response.status_code == status.HTTP_403_FORBIDDEN
