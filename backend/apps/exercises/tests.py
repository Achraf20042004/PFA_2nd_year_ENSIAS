"""
Tests for the exercises app.

Coverage:
- Exercise CRUD: create, list, detail, update, delete
- Permissions: prof owns exercise, student read-only, other prof blocked
- ExamConfig CRUD: create, update, delete
- ExerciseStartView: active/inactive, dataset not ready
- Exam enforcement: deadline passed, max attempts reached
- Randomisation service: 50/50 balance, avoids recently seen images,
  backfills when pool exhausted
"""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.services import generate_jwt_for_user
from apps.datasets.models import Dataset, Image
from apps.exercises.models import ExamConfig, Exercise
from apps.exercises.services import (
    ExerciseStartError,
    check_exam_access,
    get_exercise_images,
)
from apps.results.models import Attempt, ImageResult

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def api_client():
    return APIClient()


def make_user(db, email, role):
    u = User(email=email, username=email, role=role)
    u.set_password("pass")
    u.save()
    return u


@pytest.fixture
def prof(db):
    return make_user(db, "prof@example.com", User.Role.PROF)


@pytest.fixture
def other_prof(db):
    return make_user(db, "prof2@example.com", User.Role.PROF)


@pytest.fixture
def student(db):
    return make_user(db, "stu@example.com", User.Role.ETUDIANT)


@pytest.fixture
def admin(db):
    return make_user(db, "admin@example.com", User.Role.ADMIN)


def auth(client, user):
    tokens = generate_jwt_for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return client


@pytest.fixture
def prof_client(api_client, prof):
    return auth(api_client, prof)


@pytest.fixture
def other_prof_client(api_client, other_prof):
    return auth(api_client, other_prof)


@pytest.fixture
def student_client(api_client, student):
    return auth(api_client, student)


@pytest.fixture
def admin_client(api_client, admin):
    return auth(api_client, admin)


@pytest.fixture
def ready_dataset(db, prof):
    ds = Dataset.objects.create(
        prof=prof,
        maladie="Pneumonie",
        fichier_zip=SimpleUploadedFile("d.zip", b"x"),
        statut=Dataset.Statut.READY,
        nb_images=20,
    )
    # 10 malade + 10 sain
    for i in range(10):
        Image.objects.create(dataset=ds, chemin=f"malade/img_{i}.jpg", label="malade")
        Image.objects.create(dataset=ds, chemin=f"sain/img_{i}.jpg", label="sain")
    return ds


@pytest.fixture
def exercise(db, prof, ready_dataset):
    return Exercise.objects.create(
        prof=prof,
        maladie="Pneumonie",
        dataset=ready_dataset,
        difficulte=Exercise.Difficulte.MOYEN,
        actif=True,
    )


@pytest.fixture
def exam_exercise(db, exercise):
    ExamConfig.objects.create(
        exercise=exercise,
        est_examen=True,
        max_tentatives=2,
        deadline=timezone.now() + timedelta(days=7),
        duree_minutes=45,
        nb_images=10,
    )
    return exercise


# ---------------------------------------------------------------------------
# Exercise CRUD
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestExerciseCreate:
    url = "/api/exercises/"

    def test_prof_creates_exercise(self, prof_client, ready_dataset):
        response = prof_client.post(self.url, {
            "maladie": "Tuberculose",
            "dataset": ready_dataset.id,
            "difficulte": "facile",
        })
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["maladie"] == "Tuberculose"

    def test_student_cannot_create(self, student_client, ready_dataset):
        response = student_client.post(self.url, {
            "maladie": "X", "dataset": ready_dataset.id, "difficulte": "moyen",
        })
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_create(self, api_client, ready_dataset):
        response = api_client.post(self.url, {
            "maladie": "X", "dataset": ready_dataset.id, "difficulte": "moyen",
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_dataset_not_ready_rejected(self, prof_client, prof):
        processing_ds = Dataset.objects.create(
            prof=prof, maladie="X",
            fichier_zip=SimpleUploadedFile("d.zip", b"x"),
            statut=Dataset.Statut.PROCESSING,
        )
        response = prof_client.post(self.url, {
            "maladie": "X", "dataset": processing_ds.id, "difficulte": "moyen",
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_prof_cannot_use_other_profs_dataset(self, other_prof_client, ready_dataset):
        response = other_prof_client.post(self.url, {
            "maladie": "X", "dataset": ready_dataset.id, "difficulte": "moyen",
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestExerciseList:
    url = "/api/exercises/"

    def test_student_sees_only_active(self, student_client, prof, ready_dataset):
        active = Exercise.objects.create(
            prof=prof, maladie="A", dataset=ready_dataset, actif=True
        )
        inactive = Exercise.objects.create(
            prof=prof, maladie="B", dataset=ready_dataset, actif=False
        )
        response = student_client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        ids = [e["id"] for e in response.json()["results"]]
        assert active.id in ids
        assert inactive.id not in ids

    def test_prof_sees_only_own_exercises(self, prof_client, prof, other_prof, ready_dataset):
        mine = Exercise.objects.create(prof=prof, maladie="Mine", dataset=ready_dataset)
        # other_prof needs their own dataset
        other_ds = Dataset.objects.create(
            prof=other_prof, maladie="X",
            fichier_zip=SimpleUploadedFile("d.zip", b"x"),
            statut=Dataset.Statut.READY,
        )
        theirs = Exercise.objects.create(prof=other_prof, maladie="Theirs", dataset=other_ds)
        response = prof_client.get(self.url)
        ids = [e["id"] for e in response.json()["results"]]
        assert mine.id in ids
        assert theirs.id not in ids

    def test_admin_sees_all(self, admin_client, prof, other_prof, ready_dataset):
        Exercise.objects.create(prof=prof, maladie="A", dataset=ready_dataset)
        other_ds = Dataset.objects.create(
            prof=other_prof, maladie="X",
            fichier_zip=SimpleUploadedFile("d.zip", b"x"),
            statut=Dataset.Statut.READY,
        )
        Exercise.objects.create(prof=other_prof, maladie="B", dataset=other_ds)
        response = admin_client.get(self.url)
        assert response.json()["count"] >= 2


@pytest.mark.django_db
class TestExerciseDetail:

    def test_student_reads_active_exercise(self, student_client, exercise):
        response = student_client.get(f"/api/exercises/{exercise.id}/")
        assert response.status_code == status.HTTP_200_OK

    def test_student_cannot_read_inactive(self, student_client, prof, ready_dataset):
        inactive = Exercise.objects.create(
            prof=prof, maladie="X", dataset=ready_dataset, actif=False
        )
        response = student_client.get(f"/api/exercises/{inactive.id}/")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_prof_reads_own_inactive(self, prof_client, prof, ready_dataset):
        inactive = Exercise.objects.create(
            prof=prof, maladie="X", dataset=ready_dataset, actif=False
        )
        response = prof_client.get(f"/api/exercises/{inactive.id}/")
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestExerciseUpdate:

    def test_owner_can_patch(self, prof_client, exercise):
        response = prof_client.patch(
            f"/api/exercises/{exercise.id}/", {"difficulte": "difficile"}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["difficulte"] == "difficile"

    def test_other_prof_cannot_patch(self, other_prof_client, exercise):
        response = other_prof_client.patch(
            f"/api/exercises/{exercise.id}/", {"difficulte": "difficile"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_patch(self, student_client, exercise):
        response = student_client.patch(
            f"/api/exercises/{exercise.id}/", {"difficulte": "difficile"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_owner_can_deactivate(self, prof_client, exercise):
        response = prof_client.patch(f"/api/exercises/{exercise.id}/", {"actif": False})
        assert response.status_code == status.HTTP_200_OK
        exercise.refresh_from_db()
        assert exercise.actif is False


@pytest.mark.django_db
class TestExerciseDelete:

    def test_owner_can_delete(self, prof_client, exercise):
        eid = exercise.id
        response = prof_client.delete(f"/api/exercises/{eid}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Exercise.objects.filter(id=eid).exists()

    def test_other_prof_cannot_delete(self, other_prof_client, exercise):
        response = other_prof_client.delete(f"/api/exercises/{exercise.id}/")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_student_cannot_delete(self, student_client, exercise):
        response = student_client.delete(f"/api/exercises/{exercise.id}/")
        assert response.status_code == status.HTTP_403_FORBIDDEN


# ---------------------------------------------------------------------------
# ExamConfig CRUD
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestExamConfig:

    def test_prof_creates_exam_config(self, prof_client, exercise):
        deadline = (timezone.now() + timedelta(days=3)).isoformat()
        response = prof_client.post(f"/api/exercises/{exercise.id}/exam-config/", {
            "est_examen": True,
            "max_tentatives": 3,
            "deadline": deadline,
            "duree_minutes": 30,
            "nb_images": 10,
        })
        assert response.status_code == status.HTTP_201_CREATED
        assert ExamConfig.objects.filter(exercise=exercise).exists()

    def test_duplicate_config_rejected(self, prof_client, exam_exercise):
        deadline = (timezone.now() + timedelta(days=3)).isoformat()
        response = prof_client.post(f"/api/exercises/{exam_exercise.id}/exam-config/", {
            "est_examen": True, "nb_images": 10,
            "duree_minutes": 30, "deadline": deadline,
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_student_cannot_create_config(self, student_client, exercise):
        response = student_client.post(f"/api/exercises/{exercise.id}/exam-config/", {
            "est_examen": True, "nb_images": 10, "duree_minutes": 30,
        })
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_other_prof_cannot_create_config(self, other_prof_client, exercise):
        response = other_prof_client.post(f"/api/exercises/{exercise.id}/exam-config/", {
            "est_examen": True, "nb_images": 10, "duree_minutes": 30,
        })
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_owner_can_patch_config(self, prof_client, exam_exercise):
        response = prof_client.patch(
            f"/api/exercises/{exam_exercise.id}/exam-config/",
            {"duree_minutes": 90},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["duree_minutes"] == 90

    def test_owner_can_delete_config(self, prof_client, exam_exercise):
        response = prof_client.delete(f"/api/exercises/{exam_exercise.id}/exam-config/")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ExamConfig.objects.filter(exercise=exam_exercise).exists()

    def test_past_deadline_rejected(self, prof_client, exercise):
        past = (timezone.now() - timedelta(hours=1)).isoformat()
        response = prof_client.post(f"/api/exercises/{exercise.id}/exam-config/", {
            "est_examen": True, "deadline": past, "nb_images": 10, "duree_minutes": 30,
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_odd_nb_images_rejected(self, prof_client, exercise):
        deadline = (timezone.now() + timedelta(days=1)).isoformat()
        response = prof_client.post(f"/api/exercises/{exercise.id}/exam-config/", {
            "est_examen": True, "nb_images": 9, "duree_minutes": 30, "deadline": deadline,
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_config(self, prof_client, exam_exercise):
        response = prof_client.get(f"/api/exercises/{exam_exercise.id}/exam-config/")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["est_examen"] is True

    def test_get_missing_config_returns_404(self, prof_client, exercise):
        response = prof_client.get(f"/api/exercises/{exercise.id}/exam-config/")
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# Start endpoint
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestExerciseStartView:

    def test_student_starts_active_practice(self, student_client, exercise):
        response = student_client.get(f"/api/exercises/{exercise.id}/start/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["exercise_id"] == exercise.id
        assert data["mode"] == "practice"
        assert len(data["images"]) == 10

    def test_labels_not_exposed_in_session(self, student_client, exercise):
        response = student_client.get(f"/api/exercises/{exercise.id}/start/")
        for img in response.json()["images"]:
            assert "label" not in img

    def test_student_cannot_start_inactive(self, student_client, prof, ready_dataset):
        inactive = Exercise.objects.create(
            prof=prof, maladie="X", dataset=ready_dataset, actif=False
        )
        response = student_client.get(f"/api/exercises/{inactive.id}/start/")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_prof_can_start_inactive(self, prof_client, prof, ready_dataset):
        inactive = Exercise.objects.create(
            prof=prof, maladie="X", dataset=ready_dataset, actif=False
        )
        response = prof_client.get(f"/api/exercises/{inactive.id}/start/")
        assert response.status_code == status.HTTP_200_OK

    def test_dataset_not_ready_blocked(self, prof_client, prof):
        ds = Dataset.objects.create(
            prof=prof, maladie="X",
            fichier_zip=SimpleUploadedFile("d.zip", b"x"),
            statut=Dataset.Statut.PROCESSING,
        )
        ex = Exercise.objects.create(prof=prof, maladie="X", dataset=ds, actif=True)
        response = prof_client.get(f"/api/exercises/{ex.id}/start/")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_blocked(self, api_client, exercise):
        response = api_client.get(f"/api/exercises/{exercise.id}/start/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_exam_mode_returned_when_est_examen(self, student_client, exam_exercise):
        response = student_client.get(f"/api/exercises/{exam_exercise.id}/start/")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["mode"] == "exam"
        assert response.json()["duree_minutes"] == 45

    def test_nonexistent_exercise_404(self, student_client):
        response = student_client.get("/api/exercises/99999/start/")
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ---------------------------------------------------------------------------
# Exam enforcement: deadline and max attempts
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestExamEnforcement:

    def test_deadline_passed_blocks_start(self, student_client, exercise):
        ExamConfig.objects.create(
            exercise=exercise,
            est_examen=True,
            deadline=timezone.now() - timedelta(hours=1),
            nb_images=10,
            duree_minutes=30,
        )
        response = student_client.get(f"/api/exercises/{exercise.id}/start/")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "deadline" in response.json()["detail"].lower()

    def test_max_attempts_reached_blocks_start(self, student_client, student, exercise):
        ExamConfig.objects.create(
            exercise=exercise,
            est_examen=True,
            max_tentatives=2,
            deadline=timezone.now() + timedelta(days=1),
            nb_images=10,
            duree_minutes=30,
        )
        # Simulate 2 completed exam attempts
        for _ in range(2):
            Attempt.objects.create(
                etudiant=student,
                exercise=exercise,
                score=0.8,
                mode="exam",
                duree_reelle=300,
            )
        response = student_client.get(f"/api/exercises/{exercise.id}/start/")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "maximum" in response.json()["detail"].lower()

    def test_within_attempt_limit_allowed(self, student_client, student, exercise):
        ExamConfig.objects.create(
            exercise=exercise,
            est_examen=True,
            max_tentatives=3,
            deadline=timezone.now() + timedelta(days=1),
            nb_images=10,
            duree_minutes=30,
        )
        Attempt.objects.create(
            etudiant=student, exercise=exercise,
            score=0.5, mode="exam", duree_reelle=200,
        )
        response = student_client.get(f"/api/exercises/{exercise.id}/start/")
        assert response.status_code == status.HTTP_200_OK

    def test_null_max_tentatives_means_unlimited(self, student_client, student, exercise):
        ExamConfig.objects.create(
            exercise=exercise,
            est_examen=True,
            max_tentatives=None,
            deadline=timezone.now() + timedelta(days=1),
            nb_images=10,
            duree_minutes=30,
        )
        for _ in range(10):
            Attempt.objects.create(
                etudiant=student, exercise=exercise,
                score=0.5, mode="exam", duree_reelle=100,
            )
        response = student_client.get(f"/api/exercises/{exercise.id}/start/")
        assert response.status_code == status.HTTP_200_OK

    def test_practice_attempts_dont_count_toward_exam_limit(
        self, student_client, student, exercise
    ):
        ExamConfig.objects.create(
            exercise=exercise,
            est_examen=True,
            max_tentatives=1,
            deadline=timezone.now() + timedelta(days=1),
            nb_images=10,
            duree_minutes=30,
        )
        # Practice attempts must not consume exam quota
        for _ in range(5):
            Attempt.objects.create(
                etudiant=student, exercise=exercise,
                score=0.5, mode="practice", duree_reelle=100,
            )
        response = student_client.get(f"/api/exercises/{exercise.id}/start/")
        assert response.status_code == status.HTTP_200_OK


# ---------------------------------------------------------------------------
# Randomisation service unit tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestGetExerciseImages:

    def test_returns_requested_count(self, student, exercise):
        images = get_exercise_images(student, exercise, n=10)
        assert len(images) == 10

    def test_50_50_balance(self, student, exercise):
        images = get_exercise_images(student, exercise, n=10)
        malade = sum(1 for img in images if img.label == "malade")
        sain = sum(1 for img in images if img.label == "sain")
        assert malade == 5
        assert sain == 5

    def test_odd_n_gives_extra_to_malade(self, student, exercise):
        images = get_exercise_images(student, exercise, n=5)
        malade = sum(1 for img in images if img.label == "malade")
        sain = sum(1 for img in images if img.label == "sain")
        assert malade == 3
        assert sain == 2

    def test_avoids_recently_seen_images(self, student, exercise):
        all_malade = list(
            Image.objects.filter(dataset=exercise.dataset, label="malade")
        )
        all_sain = list(
            Image.objects.filter(dataset=exercise.dataset, label="sain")
        )
        # Mark first 5 malade and 5 sain as seen in a past attempt
        attempt = Attempt.objects.create(
            etudiant=student, exercise=exercise,
            score=0.8, mode="practice", duree_reelle=100,
        )
        seen_ids = set()
        for img in all_malade[:5]:
            ImageResult.objects.create(
                attempt=attempt, image=img,
                reponse_etudiant="malade", reponse_modele="malade", correct=True,
            )
            seen_ids.add(img.id)
        for img in all_sain[:5]:
            ImageResult.objects.create(
                attempt=attempt, image=img,
                reponse_etudiant="sain", reponse_modele="sain", correct=True,
            )
            seen_ids.add(img.id)

        # Run many times to check seen images are avoided when possible
        for _ in range(20):
            images = get_exercise_images(student, exercise, n=10)
            returned_ids = {img.id for img in images}
            # Since there are 5 unseen of each label, we should never get seen ones
            assert returned_ids.isdisjoint(seen_ids), (
                f"Expected no seen images but got overlap: {returned_ids & seen_ids}"
            )

    def test_backfills_from_seen_when_pool_exhausted(self, student, exercise):
        """When all images were recently seen, fall back to seen ones."""
        attempt = Attempt.objects.create(
            etudiant=student, exercise=exercise,
            score=0.5, mode="practice", duree_reelle=100,
        )
        # Mark ALL images as seen
        for img in Image.objects.filter(dataset=exercise.dataset):
            ImageResult.objects.create(
                attempt=attempt, image=img,
                reponse_etudiant=img.label, reponse_modele=img.label, correct=True,
            )
        # Must still return images without raising
        images = get_exercise_images(student, exercise, n=10)
        assert len(images) == 10

    def test_no_duplicate_images_in_session(self, student, exercise):
        for _ in range(10):
            images = get_exercise_images(student, exercise, n=10)
            ids = [img.id for img in images]
            assert len(ids) == len(set(ids)), "Duplicate images returned in session"

    def test_result_is_shuffled_across_calls(self, student, exercise):
        """Randomness: not always the same order (probabilistic check)."""
        orders = []
        for _ in range(10):
            images = get_exercise_images(student, exercise, n=10)
            orders.append(tuple(img.id for img in images))
        # With 10 images and random shuffle, getting the same order 10 times is vanishingly unlikely
        assert len(set(orders)) > 1, "Session always returns the same image order"

    def test_check_exam_access_inactive_no_longer_raises_in_service(self, student, exercise):
        # The actif check is the view's responsibility; the service ignores it
        # so profs can also start their own inactive exercises.
        exercise.actif = False
        exercise.save()
        check_exam_access(student, exercise)  # must not raise

    def test_check_exam_access_dataset_not_ready(self, student, exercise):
        exercise.dataset.statut = "processing"
        exercise.dataset.save()
        with pytest.raises(ExerciseStartError, match="not ready"):
            check_exam_access(student, exercise)

    def test_check_exam_access_free_practice_always_passes(self, student, exercise):
        check_exam_access(student, exercise)  # no ExamConfig -> no error

    def test_check_exam_access_deadline_passed(self, student, exercise):
        ExamConfig.objects.create(
            exercise=exercise,
            est_examen=True,
            deadline=timezone.now() - timedelta(minutes=1),
            nb_images=10,
            duree_minutes=30,
        )
        with pytest.raises(ExerciseStartError, match="deadline"):
            check_exam_access(student, exercise)

    def test_check_exam_access_max_attempts(self, student, exercise):
        ExamConfig.objects.create(
            exercise=exercise,
            est_examen=True,
            max_tentatives=1,
            deadline=timezone.now() + timedelta(days=1),
            nb_images=10,
            duree_minutes=30,
        )
        Attempt.objects.create(
            etudiant=student, exercise=exercise,
            score=1.0, mode="exam", duree_reelle=50,
        )
        with pytest.raises(ExerciseStartError, match="Maximum"):
            check_exam_access(student, exercise)
