"""
Tests for the results app.

Coverage:
- Score calculation (submit_attempt service)
- Feedback endpoint content and permissions
- Student history (GET /api/results/me/)
- Exercise stats (GET /api/results/exercise/{pk}/)
- Badge triggering after attempt submission
- Permission checks throughout
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.services import generate_jwt_for_user
from apps.badges.models import Badge, UserBadge
from apps.datasets.models import Dataset, Image
from apps.exercises.models import Exercise
from apps.results.services import SubmissionError, get_exercise_stats, submit_attempt

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(db, email, role):
    u = User(email=email, username=email, role=role)
    u.set_password("pass")
    u.save()
    return u


def auth_client(user):
    tokens = generate_jwt_for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return client


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def prof(db):
    return make_user(db, "prof@test.com", "prof")


@pytest.fixture
def student(db):
    return make_user(db, "student@test.com", "etudiant")


@pytest.fixture
def other_student(db):
    return make_user(db, "other@test.com", "etudiant")


@pytest.fixture
def admin_user(db):
    return make_user(db, "admin@test.com", "admin")


@pytest.fixture
def dataset(db, prof):
    return Dataset.objects.create(prof=prof, maladie="Pneumonia", statut="ready")


@pytest.fixture
def images(db, dataset):
    """Create 4 images: 2 malade, 2 sain."""
    imgs = []
    for i in range(2):
        imgs.append(Image.objects.create(dataset=dataset, chemin=f"malade_{i}.jpg", label="malade"))
    for i in range(2):
        imgs.append(Image.objects.create(dataset=dataset, chemin=f"sain_{i}.jpg", label="sain"))
    return imgs


@pytest.fixture
def exercise(db, prof, dataset):
    return Exercise.objects.create(
        prof=prof, maladie="Pneumonia", dataset=dataset, difficulte="moyen", actif=True
    )


@pytest.fixture
def answers_all_correct(images):
    return [{"image_id": img.id, "reponse_etudiant": img.label} for img in images]


@pytest.fixture
def answers_all_wrong(images):
    flip = {"malade": "sain", "sain": "malade"}
    return [{"image_id": img.id, "reponse_etudiant": flip[img.label]} for img in images]


@pytest.fixture
def answers_half_correct(images):
    flip = {"malade": "sain", "sain": "malade"}
    result = []
    for i, img in enumerate(images):
        label = img.label if i < 2 else flip[img.label]
        result.append({"image_id": img.id, "reponse_etudiant": label})
    return result


# ---------------------------------------------------------------------------
# submit_attempt service — score calculation
# ---------------------------------------------------------------------------

class TestSubmitAttemptScore:
    def test_perfect_score(self, db, student, exercise, answers_all_correct):
        attempt = submit_attempt(student, exercise, answers_all_correct, 60, "practice")
        assert attempt.score == 1.0
        assert attempt.etudiant == student
        assert attempt.exercise == exercise

    def test_zero_score(self, db, student, exercise, answers_all_wrong):
        attempt = submit_attempt(student, exercise, answers_all_wrong, 60, "practice")
        assert attempt.score == 0.0

    def test_half_score(self, db, student, exercise, answers_half_correct):
        attempt = submit_attempt(student, exercise, answers_half_correct, 60, "practice")
        assert attempt.score == pytest.approx(0.5)

    def test_image_results_created(self, db, student, exercise, answers_all_correct, images):
        attempt = submit_attempt(student, exercise, answers_all_correct, 60, "practice")
        assert attempt.image_results.count() == len(images)

    def test_correct_flag_set(self, db, student, exercise, images):
        flip = {"malade": "sain", "sain": "malade"}
        answers = [
            {"image_id": images[0].id, "reponse_etudiant": images[0].label},
            {"image_id": images[1].id, "reponse_etudiant": flip[images[1].label]},
        ]
        attempt = submit_attempt(student, exercise, answers, 60, "practice")
        results = {ir.image_id: ir for ir in attempt.image_results.all()}
        assert results[images[0].id].correct is True
        assert results[images[1].id].correct is False

    def test_reponse_modele_equals_ground_truth(self, db, student, exercise, images):
        answers = [{"image_id": images[0].id, "reponse_etudiant": "malade"}]
        attempt = submit_attempt(student, exercise, answers, 30, "practice")
        ir = attempt.image_results.get(image=images[0])
        assert ir.reponse_modele == images[0].label

    def test_gradcam_path_null(self, db, student, exercise, images):
        answers = [{"image_id": images[0].id, "reponse_etudiant": "malade"}]
        attempt = submit_attempt(student, exercise, answers, 30, "practice")
        assert attempt.image_results.first().gradcam_path is None

    def test_empty_answers_raises(self, db, student, exercise):
        with pytest.raises(SubmissionError):
            submit_attempt(student, exercise, [], 60, "practice")

    def test_foreign_image_raises(self, db, student, exercise, prof):
        other_dataset = Dataset.objects.create(prof=prof, maladie="Other", statut="ready")
        foreign_img = Image.objects.create(dataset=other_dataset, chemin="x.jpg", label="malade")
        answers = [{"image_id": foreign_img.id, "reponse_etudiant": "malade"}]
        with pytest.raises(SubmissionError, match="does not belong"):
            submit_attempt(student, exercise, answers, 60, "practice")

    def test_mode_persisted(self, db, student, exercise, images):
        answers = [{"image_id": images[0].id, "reponse_etudiant": "malade"}]
        attempt = submit_attempt(student, exercise, answers, 60, "exam")
        assert attempt.mode == "exam"

    def test_duree_reelle_persisted(self, db, student, exercise, images):
        answers = [{"image_id": images[0].id, "reponse_etudiant": "malade"}]
        attempt = submit_attempt(student, exercise, answers, 123, "practice")
        assert attempt.duree_reelle == 123


# ---------------------------------------------------------------------------
# POST /api/attempts/ — submit endpoint
# ---------------------------------------------------------------------------

class TestSubmitAttemptView:
    URL = "/api/attempts/"

    def _payload(self, exercise, images):
        return {
            "exercise": exercise.id,
            "duree_reelle": 60,
            "mode": "practice",
            "answers": [{"image_id": img.id, "reponse_etudiant": img.label} for img in images],
        }

    def test_student_can_submit(self, db, student, exercise, images):
        client = auth_client(student)
        resp = client.post(self.URL, self._payload(exercise, images), format="json")
        assert resp.status_code == 201
        assert resp.json()["score"] == 1.0
        assert resp.json()["exercise_id"] == exercise.id

    def test_unauthenticated_rejected(self, db, exercise, images):
        client = APIClient()
        resp = client.post(self.URL, self._payload(exercise, images), format="json")
        assert resp.status_code == 401

    def test_inactive_exercise_blocked_for_student(self, db, student, exercise, images):
        exercise.actif = False
        exercise.save()
        client = auth_client(student)
        resp = client.post(self.URL, self._payload(exercise, images), format="json")
        assert resp.status_code == 404

    def test_prof_can_submit_to_own_exercise(self, db, prof, exercise, images):
        client = auth_client(prof)
        resp = client.post(self.URL, self._payload(exercise, images), format="json")
        assert resp.status_code == 201

    def test_missing_exercise_returns_404(self, db, student, images):
        client = auth_client(student)
        payload = {
            "exercise": 99999,
            "duree_reelle": 60,
            "mode": "practice",
            "answers": [{"image_id": images[0].id, "reponse_etudiant": "malade"}],
        }
        resp = client.post(self.URL, payload, format="json")
        assert resp.status_code == 404

    def test_duplicate_image_ids_rejected(self, db, student, exercise, images):
        client = auth_client(student)
        payload = {
            "exercise": exercise.id,
            "duree_reelle": 60,
            "mode": "practice",
            "answers": [
                {"image_id": images[0].id, "reponse_etudiant": "malade"},
                {"image_id": images[0].id, "reponse_etudiant": "sain"},
            ],
        }
        resp = client.post(self.URL, payload, format="json")
        assert resp.status_code == 400

    def test_empty_answers_rejected(self, db, student, exercise):
        client = auth_client(student)
        payload = {"exercise": exercise.id, "duree_reelle": 60, "mode": "practice", "answers": []}
        resp = client.post(self.URL, payload, format="json")
        assert resp.status_code == 400

    def test_returns_attempt_id(self, db, student, exercise, images):
        client = auth_client(student)
        resp = client.post(self.URL, self._payload(exercise, images), format="json")
        assert "id" in resp.json()


# ---------------------------------------------------------------------------
# GET /api/attempts/{pk}/feedback/
# ---------------------------------------------------------------------------

class TestFeedbackView:
    def _attempt(self, student, exercise, images, correct=True):
        flip = {"malade": "sain", "sain": "malade"}
        answers = [
            {"image_id": img.id, "reponse_etudiant": img.label if correct else flip[img.label]}
            for img in images
        ]
        return submit_attempt(student, exercise, answers, 60, "practice")

    def _url(self, pk):
        return f"/api/attempts/{pk}/feedback/"

    def test_owner_can_view_feedback(self, db, student, exercise, images):
        attempt = self._attempt(student, exercise, images)
        resp = auth_client(student).get(self._url(attempt.pk))
        assert resp.status_code == 200

    def test_feedback_contains_image_results(self, db, student, exercise, images):
        attempt = self._attempt(student, exercise, images)
        resp = auth_client(student).get(self._url(attempt.pk))
        assert len(resp.json()["image_results"]) == len(images)

    def test_feedback_reveals_labels(self, db, student, exercise, images):
        attempt = self._attempt(student, exercise, images)
        resp = auth_client(student).get(self._url(attempt.pk))
        for ir_data in resp.json()["image_results"]:
            assert ir_data["label"] in ("malade", "sain")

    def test_feedback_correct_count(self, db, student, exercise, images):
        attempt = self._attempt(student, exercise, images, correct=True)
        resp = auth_client(student).get(self._url(attempt.pk))
        data = resp.json()
        assert data["correct_count"] == len(images)
        assert data["total"] == len(images)

    def test_prof_can_view_student_feedback(self, db, prof, student, exercise, images):
        attempt = self._attempt(student, exercise, images)
        resp = auth_client(prof).get(self._url(attempt.pk))
        assert resp.status_code == 200

    def test_admin_can_view_any_feedback(self, db, admin_user, student, exercise, images):
        attempt = self._attempt(student, exercise, images)
        resp = auth_client(admin_user).get(self._url(attempt.pk))
        assert resp.status_code == 200

    def test_other_student_blocked(self, db, other_student, student, exercise, images):
        attempt = self._attempt(student, exercise, images)
        resp = auth_client(other_student).get(self._url(attempt.pk))
        assert resp.status_code == 403

    def test_unauthenticated_blocked(self, db, student, exercise, images):
        attempt = self._attempt(student, exercise, images)
        resp = APIClient().get(self._url(attempt.pk))
        assert resp.status_code == 401

    def test_nonexistent_attempt_returns_404(self, db, student):
        resp = auth_client(student).get(self._url(99999))
        assert resp.status_code == 404

    def test_cours_recommande_none_when_no_errors(self, db, student, exercise, images):
        attempt = self._attempt(student, exercise, images, correct=True)
        resp = auth_client(student).get(self._url(attempt.pk))
        assert resp.json()["cours_recommande"] is None

    def test_cours_recommande_none_when_no_course(self, db, student, exercise, images):
        attempt = self._attempt(student, exercise, images, correct=False)
        resp = auth_client(student).get(self._url(attempt.pk))
        assert resp.json()["cours_recommande"] is None

    def test_cours_recommande_returned_when_errors_and_course(self, db, student, exercise, images, prof):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from apps.courses.models import Course
        course = Course.objects.create(
            prof=prof, titre="Radiology 101", type_fichier="pdf",
            fichier=SimpleUploadedFile("r101.pdf", b"content", content_type="application/pdf"),
        )
        exercise.cours = course
        exercise.save()
        attempt = self._attempt(student, exercise, images, correct=False)
        resp = auth_client(student).get(self._url(attempt.pk))
        cr = resp.json()["cours_recommande"]
        assert cr is not None
        assert cr["id"] == course.id
        assert cr["titre"] == "Radiology 101"


# ---------------------------------------------------------------------------
# GET /api/results/me/ — student history
# ---------------------------------------------------------------------------

class TestStudentHistoryView:
    URL = "/api/results/me/"

    def test_empty_history(self, db, student):
        resp = auth_client(student).get(self.URL)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_attempts"] == 0
        assert data["avg_score"] is None
        assert data["progression"] == []

    def test_history_with_attempts(self, db, student, exercise, images):
        answers = [{"image_id": img.id, "reponse_etudiant": img.label} for img in images]
        submit_attempt(student, exercise, answers, 60, "practice")
        resp = auth_client(student).get(self.URL)
        data = resp.json()
        assert data["total_attempts"] == 1
        assert data["avg_score"] == pytest.approx(1.0, abs=0.001)
        assert len(data["progression"]) == 1

    def test_history_only_own_attempts(self, db, student, other_student, exercise, images):
        answers = [{"image_id": img.id, "reponse_etudiant": img.label} for img in images]
        submit_attempt(other_student, exercise, answers, 60, "practice")
        resp = auth_client(student).get(self.URL)
        assert resp.json()["total_attempts"] == 0

    def test_avg_score_across_multiple(self, db, student, exercise, images):
        flip = {"malade": "sain", "sain": "malade"}
        all_correct = [{"image_id": img.id, "reponse_etudiant": img.label} for img in images]
        all_wrong = [{"image_id": img.id, "reponse_etudiant": flip[img.label]} for img in images]
        submit_attempt(student, exercise, all_correct, 60, "practice")
        submit_attempt(student, exercise, all_wrong, 60, "practice")
        resp = auth_client(student).get(self.URL)
        data = resp.json()
        assert data["total_attempts"] == 2
        assert data["avg_score"] == pytest.approx(0.5, abs=0.001)

    def test_progression_fields(self, db, student, exercise, images):
        answers = [{"image_id": img.id, "reponse_etudiant": img.label} for img in images]
        submit_attempt(student, exercise, answers, 60, "practice")
        resp = auth_client(student).get(self.URL)
        entry = resp.json()["progression"][0]
        for field in ("id", "exercise_id", "maladie", "difficulte", "score", "mode", "date", "duree_reelle"):
            assert field in entry

    def test_unauthenticated_blocked(self, db):
        resp = APIClient().get(self.URL)
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/results/exercise/{pk}/ — professor exercise stats
# ---------------------------------------------------------------------------

class TestExerciseStatsView:
    def _url(self, pk):
        return f"/api/results/exercise/{pk}/"

    def test_prof_can_view_own_exercise_stats(self, db, prof, exercise, student, images):
        answers = [{"image_id": img.id, "reponse_etudiant": img.label} for img in images]
        submit_attempt(student, exercise, answers, 60, "practice")
        resp = auth_client(prof).get(self._url(exercise.pk))
        assert resp.status_code == 200

    def test_stats_structure(self, db, prof, exercise, student, images):
        answers = [{"image_id": img.id, "reponse_etudiant": img.label} for img in images]
        submit_attempt(student, exercise, answers, 60, "practice")
        resp = auth_client(prof).get(self._url(exercise.pk))
        data = resp.json()
        assert data["exercise_id"] == exercise.id
        assert data["maladie"] == exercise.maladie
        assert data["total_attempts"] == 1
        assert "avg_score" in data
        assert "score_distribution" in data
        assert "common_errors" in data

    def test_student_blocked(self, db, student, exercise):
        resp = auth_client(student).get(self._url(exercise.pk))
        assert resp.status_code == 403

    def test_other_prof_blocked(self, db, exercise):
        other_prof = make_user(db, "other_prof@test.com", "prof")
        resp = auth_client(other_prof).get(self._url(exercise.pk))
        assert resp.status_code == 403

    def test_admin_can_view_any_stats(self, db, admin_user, exercise, student, images):
        answers = [{"image_id": img.id, "reponse_etudiant": img.label} for img in images]
        submit_attempt(student, exercise, answers, 60, "practice")
        resp = auth_client(admin_user).get(self._url(exercise.pk))
        assert resp.status_code == 200

    def test_nonexistent_exercise_returns_404(self, db, prof):
        resp = auth_client(prof).get(self._url(99999))
        assert resp.status_code == 404

    def test_unauthenticated_blocked(self, db, exercise):
        resp = APIClient().get(self._url(exercise.pk))
        assert resp.status_code == 401

    def test_score_distribution_buckets(self, db, prof, exercise, student, images):
        answers = [{"image_id": img.id, "reponse_etudiant": img.label} for img in images]
        submit_attempt(student, exercise, answers, 60, "practice")  # score=1.0 → 80-100
        resp = auth_client(prof).get(self._url(exercise.pk))
        dist = resp.json()["score_distribution"]
        assert dist["80-100"] == 1
        assert dist["0-20"] == 0

    def test_empty_stats_when_no_attempts(self, db, prof, exercise):
        resp = auth_client(prof).get(self._url(exercise.pk))
        data = resp.json()
        assert data["total_attempts"] == 0
        assert data["avg_score"] is None
        assert data["common_errors"] == []


# ---------------------------------------------------------------------------
# get_exercise_stats service unit tests
# ---------------------------------------------------------------------------

class TestGetExerciseStats:
    def test_no_attempts(self, db, exercise):
        stats = get_exercise_stats(exercise)
        assert stats["total_attempts"] == 0
        assert stats["avg_score"] is None
        assert stats["common_errors"] == []

    def test_avg_score(self, db, student, exercise, images):
        answers = [{"image_id": img.id, "reponse_etudiant": img.label} for img in images]
        submit_attempt(student, exercise, answers, 60, "practice")
        stats = get_exercise_stats(exercise)
        assert stats["avg_score"] == pytest.approx(1.0, abs=0.001)

    def test_common_errors_populated(self, db, student, exercise, images):
        flip = {"malade": "sain", "sain": "malade"}
        answers = [{"image_id": img.id, "reponse_etudiant": flip[img.label]} for img in images]
        submit_attempt(student, exercise, answers, 60, "practice")
        stats = get_exercise_stats(exercise)
        assert len(stats["common_errors"]) == len(images)
        assert stats["common_errors"][0]["error_count"] >= 1


# ---------------------------------------------------------------------------
# Badge triggering
# ---------------------------------------------------------------------------

class TestBadgeTrigger:
    def _submit(self, student, exercise, images, correct=True):
        flip = {"malade": "sain", "sain": "malade"}
        answers = [
            {"image_id": img.id, "reponse_etudiant": img.label if correct else flip[img.label]}
            for img in images
        ]
        return submit_attempt(student, exercise, answers, 60, "practice")

    def test_premier_exo_badge_awarded(self, db, student, exercise, images):
        badge = Badge.objects.create(
            nom="First Step", description="d", icone_svg="<svg/>",
            condition_type="premier_exo", condition_seuil=1,
        )
        assert not UserBadge.objects.filter(etudiant=student, badge=badge).exists()
        self._submit(student, exercise, images)
        assert UserBadge.objects.filter(etudiant=student, badge=badge).exists()

    def test_score_parfait_badge_awarded(self, db, student, exercise, images):
        badge = Badge.objects.create(
            nom="Perfect", description="d", icone_svg="<svg/>",
            condition_type="score_parfait", condition_seuil=1,
        )
        self._submit(student, exercise, images, correct=True)
        assert UserBadge.objects.filter(etudiant=student, badge=badge).exists()

    def test_score_parfait_not_awarded_when_wrong(self, db, student, exercise, images):
        badge = Badge.objects.create(
            nom="Perfect", description="d", icone_svg="<svg/>",
            condition_type="score_parfait", condition_seuil=1,
        )
        self._submit(student, exercise, images, correct=False)
        assert not UserBadge.objects.filter(etudiant=student, badge=badge).exists()

    def test_nb_tentatives_badge(self, db, student, exercise, images):
        badge = Badge.objects.create(
            nom="Diligent", description="d", icone_svg="<svg/>",
            condition_type="nb_tentatives", condition_seuil=2,
        )
        self._submit(student, exercise, images)
        assert not UserBadge.objects.filter(etudiant=student, badge=badge).exists()
        self._submit(student, exercise, images)
        assert UserBadge.objects.filter(etudiant=student, badge=badge).exists()

    def test_badge_not_awarded_twice(self, db, student, exercise, images):
        badge = Badge.objects.create(
            nom="First Step", description="d", icone_svg="<svg/>",
            condition_type="premier_exo", condition_seuil=1,
        )
        self._submit(student, exercise, images)
        self._submit(student, exercise, images)
        assert UserBadge.objects.filter(etudiant=student, badge=badge).count() == 1

    def test_badge_failure_does_not_break_submission(self, db, student, exercise, images, monkeypatch):
        def bad_award(s, a): raise RuntimeError("badge boom")
        monkeypatch.setattr("apps.badges.services.award_badges", bad_award)
        attempt = self._submit(student, exercise, images)
        assert attempt.pk is not None


# ---------------------------------------------------------------------------
# GET /api/badges/me/
# ---------------------------------------------------------------------------

class TestBadgeListView:
    URL = "/api/badges/me/"

    def test_empty_badges(self, db, student):
        resp = auth_client(student).get(self.URL)
        assert resp.status_code == 200
        data = resp.json()
        assert data["earned"] == []
        assert data["available"] == []

    def test_earned_badge_appears(self, db, student, exercise, images):
        Badge.objects.create(
            nom="First Step", description="d", icone_svg="<svg/>",
            condition_type="premier_exo", condition_seuil=1,
        )
        answers = [{"image_id": img.id, "reponse_etudiant": img.label} for img in images]
        submit_attempt(student, exercise, answers, 60, "practice")
        resp = auth_client(student).get(self.URL)
        data = resp.json()
        assert len(data["earned"]) == 1
        assert data["earned"][0]["badge"]["nom"] == "First Step"
        assert len(data["available"]) == 0

    def test_available_badge_appears(self, db, student):
        Badge.objects.create(
            nom="Diligent", description="d", icone_svg="<svg/>",
            condition_type="nb_tentatives", condition_seuil=10,
        )
        resp = auth_client(student).get(self.URL)
        data = resp.json()
        assert len(data["available"]) == 1
        assert len(data["earned"]) == 0

    def test_unauthenticated_blocked(self, db):
        resp = APIClient().get(self.URL)
        assert resp.status_code == 401
