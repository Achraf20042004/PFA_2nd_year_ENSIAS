"""
Tests for the courses app.

Coverage:
- POST /api/courses/upload/ — prof upload, permission checks, file validation
- GET /api/courses/ — list, maladie filter, auth
- GET /api/courses/{pk}/ — detail, 404
- DELETE /api/courses/{pk}/ — ownership, permissions
- Course-Exercise FK link
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.accounts.services import generate_jwt_for_user
from apps.courses.models import Course
from apps.datasets.models import Dataset
from apps.exercises.models import Exercise


# ---------------------------------------------------------------------------
# Helpers & fixtures
# ---------------------------------------------------------------------------

def make_user(db, email, role):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    u = User(email=email, username=email, role=role)
    u.set_password("pass")
    u.save()
    return u


def auth_client(user):
    tokens = generate_jwt_for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return client


def pdf_file(name="lecture.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 content", content_type="application/pdf")


def video_file(name="lesson.mp4"):
    return SimpleUploadedFile(name, b"\x00\x00\x00 ftyp", content_type="video/mp4")


@pytest.fixture
def prof(db):
    return make_user(db, "prof@test.com", "prof")


@pytest.fixture
def other_prof(db):
    return make_user(db, "prof2@test.com", "prof")


@pytest.fixture
def student(db):
    return make_user(db, "student@test.com", "etudiant")


@pytest.fixture
def admin_user(db):
    return make_user(db, "admin@test.com", "admin")


@pytest.fixture
def course(db, prof):
    return Course.objects.create(
        prof=prof,
        titre="Radiology Basics",
        description="Intro course",
        maladie="Pneumonia",
        type_fichier="pdf",
        fichier=pdf_file("basics.pdf"),
    )


# ---------------------------------------------------------------------------
# POST /api/courses/upload/
# ---------------------------------------------------------------------------

UPLOAD_URL = "/api/courses/upload/"


class TestCourseUpload:
    def test_prof_can_upload_pdf(self, db, prof):
        resp = auth_client(prof).post(
            UPLOAD_URL,
            {"titre": "Lec 1", "fichier": pdf_file()},
            format="multipart",
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["titre"] == "Lec 1"
        assert data["type_fichier"] == "pdf"

    def test_prof_can_upload_video(self, db, prof):
        resp = auth_client(prof).post(
            UPLOAD_URL,
            {"titre": "Video 1", "fichier": video_file()},
            format="multipart",
        )
        assert resp.status_code == 201
        assert resp.json()["type_fichier"] == "video"

    def test_student_cannot_upload(self, db, student):
        resp = auth_client(student).post(
            UPLOAD_URL,
            {"titre": "Lec 1", "fichier": pdf_file()},
            format="multipart",
        )
        assert resp.status_code == 403

    def test_unauthenticated_rejected(self, db):
        resp = APIClient().post(
            UPLOAD_URL,
            {"titre": "Lec 1", "fichier": pdf_file()},
            format="multipart",
        )
        assert resp.status_code == 401

    def test_invalid_extension_rejected(self, db, prof):
        bad_file = SimpleUploadedFile("notes.docx", b"content", content_type="application/octet-stream")
        resp = auth_client(prof).post(
            UPLOAD_URL,
            {"titre": "Lec 1", "fichier": bad_file},
            format="multipart",
        )
        assert resp.status_code == 400

    def test_missing_titre_rejected(self, db, prof):
        resp = auth_client(prof).post(
            UPLOAD_URL,
            {"fichier": pdf_file()},
            format="multipart",
        )
        assert resp.status_code == 400

    def test_missing_file_rejected(self, db, prof):
        resp = auth_client(prof).post(
            UPLOAD_URL,
            {"titre": "Lec 1"},
            format="multipart",
        )
        assert resp.status_code == 400

    def test_maladie_saved(self, db, prof):
        resp = auth_client(prof).post(
            UPLOAD_URL,
            {"titre": "Lec 1", "maladie": "Pneumonia", "fichier": pdf_file()},
            format="multipart",
        )
        assert resp.status_code == 201
        assert resp.json()["maladie"] == "Pneumonia"

    def test_response_includes_prof_email(self, db, prof):
        resp = auth_client(prof).post(
            UPLOAD_URL,
            {"titre": "Lec 1", "fichier": pdf_file()},
            format="multipart",
        )
        assert resp.json()["prof_email"] == prof.email

    def test_admin_can_upload(self, db, admin_user):
        resp = auth_client(admin_user).post(
            UPLOAD_URL,
            {"titre": "Admin Lec", "fichier": pdf_file()},
            format="multipart",
        )
        assert resp.status_code == 201

    def test_type_fichier_auto_set_from_extension(self, db, prof):
        """type_fichier must be derived from file ext, never sent by client."""
        resp = auth_client(prof).post(
            UPLOAD_URL,
            {"titre": "Lec", "fichier": SimpleUploadedFile("x.mov", b"data", content_type="video/quicktime")},
            format="multipart",
        )
        assert resp.status_code == 201
        assert resp.json()["type_fichier"] == "video"


# ---------------------------------------------------------------------------
# GET /api/courses/
# ---------------------------------------------------------------------------

LIST_URL = "/api/courses/"


class TestCourseList:
    def test_authenticated_student_can_list(self, db, student, course):
        resp = auth_client(student).get(LIST_URL)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_prof_can_list(self, db, prof, course):
        resp = auth_client(prof).get(LIST_URL)
        assert resp.status_code == 200

    def test_unauthenticated_rejected(self, db, course):
        resp = APIClient().get(LIST_URL)
        assert resp.status_code == 401

    def test_filter_by_maladie(self, db, prof):
        Course.objects.create(
            prof=prof, titre="A", maladie="Pneumonia", type_fichier="pdf", fichier=pdf_file("a.pdf")
        )
        Course.objects.create(
            prof=prof, titre="B", maladie="Tuberculosis", type_fichier="pdf", fichier=pdf_file("b.pdf")
        )
        resp = auth_client(prof).get(LIST_URL + "?maladie=Pneumonia")
        assert resp.status_code == 200
        results = resp.json()
        assert len(results) == 1
        assert results[0]["titre"] == "A"

    def test_filter_by_maladie_case_insensitive(self, db, prof):
        Course.objects.create(
            prof=prof, titre="A", maladie="Pneumonia", type_fichier="pdf", fichier=pdf_file("a.pdf")
        )
        resp = auth_client(prof).get(LIST_URL + "?maladie=pneumonia")
        assert len(resp.json()) == 1

    def test_empty_maladie_param_returns_all(self, db, prof):
        Course.objects.create(
            prof=prof, titre="A", maladie="Pneumonia", type_fichier="pdf", fichier=pdf_file("a.pdf")
        )
        Course.objects.create(
            prof=prof, titre="B", maladie="TB", type_fichier="pdf", fichier=pdf_file("b.pdf")
        )
        resp = auth_client(prof).get(LIST_URL + "?maladie=")
        assert len(resp.json()) == 2

    def test_list_includes_expected_fields(self, db, student, course):
        resp = auth_client(student).get(LIST_URL)
        entry = resp.json()[0]
        for field in ("id", "titre", "description", "maladie", "type_fichier", "fichier", "prof_email", "created_at"):
            assert field in entry


# ---------------------------------------------------------------------------
# GET /api/courses/{pk}/
# ---------------------------------------------------------------------------

class TestCourseDetail:
    def test_student_can_view(self, db, student, course):
        resp = auth_client(student).get(f"/api/courses/{course.pk}/")
        assert resp.status_code == 200
        assert resp.json()["titre"] == course.titre

    def test_prof_can_view(self, db, prof, course):
        resp = auth_client(prof).get(f"/api/courses/{course.pk}/")
        assert resp.status_code == 200

    def test_unauthenticated_rejected(self, db, course):
        resp = APIClient().get(f"/api/courses/{course.pk}/")
        assert resp.status_code == 401

    def test_nonexistent_returns_404(self, db, student):
        resp = auth_client(student).get("/api/courses/99999/")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/courses/{pk}/
# ---------------------------------------------------------------------------

class TestCourseDelete:
    def test_prof_can_delete_own(self, db, prof, course):
        resp = auth_client(prof).delete(f"/api/courses/{course.pk}/")
        assert resp.status_code == 204
        assert not Course.objects.filter(pk=course.pk).exists()

    def test_other_prof_cannot_delete(self, db, other_prof, course):
        resp = auth_client(other_prof).delete(f"/api/courses/{course.pk}/")
        assert resp.status_code == 403

    def test_student_cannot_delete(self, db, student, course):
        resp = auth_client(student).delete(f"/api/courses/{course.pk}/")
        assert resp.status_code == 403

    def test_admin_can_delete_any(self, db, admin_user, course):
        resp = auth_client(admin_user).delete(f"/api/courses/{course.pk}/")
        assert resp.status_code == 204

    def test_delete_nonexistent_returns_404(self, db, prof):
        resp = auth_client(prof).delete("/api/courses/99999/")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Course-Exercise FK link
# ---------------------------------------------------------------------------

class TestCourseExerciseLink:
    def test_course_can_be_linked_to_exercise(self, db, prof, course):
        dataset = Dataset.objects.create(prof=prof, maladie="Pneumonia", statut="ready")
        exercise = Exercise.objects.create(
            prof=prof, maladie="Pneumonia", dataset=dataset,
            difficulte="moyen", actif=True, cours=course,
        )
        assert exercise.cours == course
        assert course.exercises.filter(pk=exercise.pk).exists()

    def test_course_deletion_nullifies_exercise_link(self, db, prof, course):
        dataset = Dataset.objects.create(prof=prof, maladie="Pneumonia", statut="ready")
        exercise = Exercise.objects.create(
            prof=prof, maladie="Pneumonia", dataset=dataset,
            difficulte="moyen", actif=True, cours=course,
        )
        course.delete()
        exercise.refresh_from_db()
        assert exercise.cours is None

    def test_exercise_can_have_no_course(self, db, prof):
        dataset = Dataset.objects.create(prof=prof, maladie="Pneumonia", statut="ready")
        exercise = Exercise.objects.create(
            prof=prof, maladie="Pneumonia", dataset=dataset,
            difficulte="moyen", actif=True, cours=None,
        )
        assert exercise.cours is None
