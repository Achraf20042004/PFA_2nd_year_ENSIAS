"""
Tests for the analytics app.

Coverage:
  - AnalyticsRouter (db routing)
  - ETLLog / ModelMetric models
  - ETL logs endpoint (access control + filters)
  - Model metrics endpoint (access control + domain scoping)
  - Prof dashboard endpoint (access control + data aggregation)
  - Admin dashboard endpoint (access control + global stats)
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.services import generate_jwt_for_user
from apps.analytics.models import ETLLog, ModelMetric
from apps.analytics.router import AnalyticsRouter

# All tests in this module need access to both databases.
# pytest-django ignores the Django TestCase.databases class attribute;
# the marker below is the correct way to grant multi-DB access.
pytestmark = pytest.mark.django_db(databases=["default", "analytics"])

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


def make_etl_log(run_id, dataset_id, step="load", status="success", duration_ms=100):
    return ETLLog.objects.using("analytics").create(
        pipeline_run_id=run_id,
        dataset_id=dataset_id,
        step=step,
        status=status,
        message="",
        duration_ms=duration_ms,
    )


def make_metric(maladie, metric_name, value, model_id="model/test"):
    return ModelMetric.objects.using("analytics").create(
        maladie=maladie,
        model_id=model_id,
        metric_name=metric_name,
        metric_value=value,
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(db):
    return make_user(db, "admin@test.com", "admin")


@pytest.fixture
def prof(db):
    return make_user(db, "prof@test.com", "prof")


@pytest.fixture
def student(db):
    return make_user(db, "student@test.com", "etudiant")


@pytest.fixture
def other_prof(db):
    return make_user(db, "other@test.com", "prof")


@pytest.fixture
def exercise(db, prof):
    from apps.datasets.models import Dataset
    from apps.exercises.models import Exercise

    ds = Dataset.objects.create(prof=prof, maladie="pneumonie", statut="ready")
    return Exercise.objects.create(
        prof=prof, maladie="pneumonie", dataset=ds, difficulte="moyen", actif=True
    )


@pytest.fixture
def attempt(db, student, exercise):
    from apps.datasets.models import Image
    from apps.results.services import submit_attempt

    img = Image.objects.create(dataset=exercise.dataset, chemin="img1.jpg", label="malade")
    return submit_attempt(student, exercise, [{"image_id": img.id, "reponse_etudiant": "malade"}], 60, "practice")


# ---------------------------------------------------------------------------
# AnalyticsRouter unit tests (kept from Phase 2 step 1)
# ---------------------------------------------------------------------------


class TestAnalyticsRouter:
    def setup_method(self):
        self.router = AnalyticsRouter()

    def _mock_model(self, app_label):
        class FakeMeta:
            pass
        meta = FakeMeta()
        meta.app_label = app_label

        class FakeModel:
            _meta = meta

        return FakeModel

    def test_db_for_read_analytics(self):
        assert self.router.db_for_read(self._mock_model("analytics")) == "analytics"

    def test_db_for_read_other(self):
        assert self.router.db_for_read(self._mock_model("accounts")) is None

    def test_db_for_write_analytics(self):
        assert self.router.db_for_write(self._mock_model("analytics")) == "analytics"

    def test_db_for_write_other(self):
        assert self.router.db_for_write(self._mock_model("datasets")) is None

    def test_allow_migrate_analytics_to_analytics_db(self):
        assert self.router.allow_migrate("analytics", "analytics") is True

    def test_allow_migrate_analytics_to_default_db(self):
        assert self.router.allow_migrate("default", "analytics") is False

    def test_allow_migrate_other_to_analytics_db(self):
        assert self.router.allow_migrate("analytics", "accounts") is False

    def test_allow_migrate_other_to_default_db(self):
        assert self.router.allow_migrate("default", "accounts") is None


# ---------------------------------------------------------------------------
# Model unit tests
# ---------------------------------------------------------------------------


class TestETLLogModel:
    def test_create_etllog(self, db):
        log = make_etl_log("abc-123", 1)
        assert log.pk is not None
        assert log.step == "load"
        assert log.status == "success"

    def test_etllog_str(self):
        log = ETLLog(pipeline_run_id="run-1", step="load", status="error")
        assert "run-1" in str(log)
        assert "load" in str(log)

    def test_etllog_choices(self):
        assert ETLLog.Step.EXTRACT == "extract"
        assert ETLLog.Step.VALIDATE == "validate"
        assert ETLLog.Step.TRANSFORM == "transform"
        assert ETLLog.Step.LOAD == "load"
        assert ETLLog.Status.STARTED == "started"
        assert ETLLog.Status.SUCCESS == "success"
        assert ETLLog.Status.ERROR == "error"


class TestModelMetricModel:
    def test_create_metric(self, db):
        m = make_metric("pneumonie", "confidence", 0.93)
        assert m.pk is not None
        assert m.metric_value == pytest.approx(0.93)

    def test_metric_str(self):
        m = ModelMetric(maladie="melanome", metric_name="latency_ms", metric_value=120.0)
        assert "melanome" in str(m)
        assert "latency_ms" in str(m)


# ---------------------------------------------------------------------------
# GET /api/analytics/etl-logs/
# ---------------------------------------------------------------------------


class TestETLLogsView:
    URL = "/api/analytics/etl-logs/"

    def test_admin_can_access(self, db, admin_user):
        make_etl_log("r1", 1)
        resp = auth_client(admin_user).get(self.URL)
        assert resp.status_code == 200

    def test_prof_is_forbidden(self, db, prof):
        resp = auth_client(prof).get(self.URL)
        assert resp.status_code == 403

    def test_student_is_forbidden(self, db, student):
        resp = auth_client(student).get(self.URL)
        assert resp.status_code == 403

    def test_unauthenticated_is_rejected(self, db):
        resp = APIClient().get(self.URL)
        assert resp.status_code == 401

    def test_returns_paginated_results(self, db, admin_user):
        for i in range(3):
            make_etl_log(f"run-{i}", i + 1)
        resp = auth_client(admin_user).get(self.URL)
        data = resp.json()
        assert "results" in data
        assert data["count"] == 3

    def test_filter_by_status_success(self, db, admin_user):
        make_etl_log("r1", 1, status="success")
        make_etl_log("r2", 2, status="error")
        resp = auth_client(admin_user).get(self.URL, {"status": "success"})
        data = resp.json()
        assert data["count"] == 1
        assert data["results"][0]["status"] == "success"

    def test_filter_by_status_error(self, db, admin_user):
        make_etl_log("r1", 1, status="success")
        make_etl_log("r2", 2, status="error")
        resp = auth_client(admin_user).get(self.URL, {"status": "error"})
        assert resp.json()["count"] == 1

    def test_filter_by_step(self, db, admin_user):
        make_etl_log("r1", 1, step="extract")
        make_etl_log("r2", 1, step="load")
        resp = auth_client(admin_user).get(self.URL, {"step": "extract"})
        assert resp.json()["count"] == 1
        assert resp.json()["results"][0]["step"] == "extract"

    def test_filter_by_dataset_id(self, db, admin_user):
        make_etl_log("r1", 10)
        make_etl_log("r2", 20)
        resp = auth_client(admin_user).get(self.URL, {"dataset_id": "10"})
        assert resp.json()["count"] == 1

    def test_invalid_dataset_id_returns_400(self, db, admin_user):
        resp = auth_client(admin_user).get(self.URL, {"dataset_id": "abc"})
        assert resp.status_code == 400

    def test_response_fields(self, db, admin_user):
        make_etl_log("run-x", 5, step="validate", status="error", duration_ms=42)
        resp = auth_client(admin_user).get(self.URL)
        entry = resp.json()["results"][0]
        for field in ("id", "pipeline_run_id", "dataset_id", "step", "status",
                      "message", "duration_ms", "created_at"):
            assert field in entry, f"missing field: {field}"

    def test_filter_by_domain(self, db, admin_user, prof):
        from apps.datasets.models import Dataset

        ds = Dataset.objects.create(prof=prof, maladie="pneumonie", statut="ready")
        make_etl_log("r1", ds.id)
        make_etl_log("r2", 9999)   # dataset that doesn't exist / different domain
        resp = auth_client(admin_user).get(self.URL, {"domain": "pneumonie"})
        assert resp.json()["count"] == 1


# ---------------------------------------------------------------------------
# GET /api/analytics/model-metrics/
# ---------------------------------------------------------------------------


class TestModelMetricsView:
    URL = "/api/analytics/model-metrics/"

    def test_admin_can_access(self, db, admin_user):
        resp = auth_client(admin_user).get(self.URL)
        assert resp.status_code == 200

    def test_prof_can_access(self, db, prof):
        resp = auth_client(prof).get(self.URL)
        assert resp.status_code == 200

    def test_student_is_forbidden(self, db, student):
        resp = auth_client(student).get(self.URL)
        assert resp.status_code == 403

    def test_unauthenticated_rejected(self, db):
        resp = APIClient().get(self.URL)
        assert resp.status_code == 401

    def test_returns_list(self, db, admin_user):
        make_metric("pneumonie", "confidence", 0.90)
        resp = auth_client(admin_user).get(self.URL)
        assert isinstance(resp.json(), list)

    def test_aggregates_confidence(self, db, admin_user):
        make_metric("pneumonie", "confidence", 0.80)
        make_metric("pneumonie", "confidence", 0.90)
        resp = auth_client(admin_user).get(self.URL)
        row = next(r for r in resp.json() if r["maladie"] == "pneumonie")
        assert row["avg_confidence"] == pytest.approx(0.85, abs=0.01)
        assert row["sample_count"] == 2

    def test_aggregates_latency(self, db, admin_user):
        make_metric("pneumonie", "confidence", 0.85)
        make_metric("pneumonie", "latency_ms", 200)
        make_metric("pneumonie", "latency_ms", 300)
        resp = auth_client(admin_user).get(self.URL)
        row = next(r for r in resp.json() if r["maladie"] == "pneumonie")
        assert row["avg_latency_ms"] == pytest.approx(250.0, abs=1.0)

    def test_null_latency_when_no_latency_data(self, db, admin_user):
        make_metric("melanome", "confidence", 0.75)
        resp = auth_client(admin_user).get(self.URL)
        row = next(r for r in resp.json() if r["maladie"] == "melanome")
        assert row["avg_latency_ms"] is None

    def test_prof_sees_only_own_domains(self, db, prof, exercise):
        # exercise is "pneumonie" for this prof
        make_metric("pneumonie", "confidence", 0.88)
        make_metric("melanome", "confidence", 0.77)   # different domain
        resp = auth_client(prof).get(self.URL)
        malades = {r["maladie"] for r in resp.json()}
        # prof only has "pneumonie" exercises → melanome must not appear
        assert "melanome" not in malades

    def test_admin_domain_filter(self, db, admin_user):
        make_metric("pneumonie", "confidence", 0.88)
        make_metric("melanome", "confidence", 0.77)
        resp = auth_client(admin_user).get(self.URL, {"domain": "pneumonie"})
        malades = {r["maladie"] for r in resp.json()}
        assert malades == {"pneumonie"}

    def test_empty_when_no_data(self, db, admin_user):
        resp = auth_client(admin_user).get(self.URL)
        assert resp.json() == []


# ---------------------------------------------------------------------------
# GET /api/analytics/dashboard/prof/
# ---------------------------------------------------------------------------


class TestProfDashboardView:
    URL = "/api/analytics/dashboard/prof/"

    def test_prof_can_access(self, db, prof):
        resp = auth_client(prof).get(self.URL)
        assert resp.status_code == 200

    def test_student_is_forbidden(self, db, student):
        resp = auth_client(student).get(self.URL)
        assert resp.status_code == 403

    def test_unauthenticated_rejected(self, db):
        resp = APIClient().get(self.URL)
        assert resp.status_code == 401

    def test_admin_without_prof_id_returns_400(self, db, admin_user):
        resp = auth_client(admin_user).get(self.URL)
        assert resp.status_code == 400

    def test_admin_with_invalid_prof_id_returns_404(self, db, admin_user):
        resp = auth_client(admin_user).get(self.URL, {"prof_id": "99999"})
        assert resp.status_code == 404

    def test_admin_with_student_id_returns_404(self, db, admin_user, student):
        resp = auth_client(admin_user).get(self.URL, {"prof_id": str(student.id)})
        assert resp.status_code == 404

    def test_admin_can_view_specific_prof(self, db, admin_user, prof):
        resp = auth_client(admin_user).get(self.URL, {"prof_id": str(prof.id)})
        assert resp.status_code == 200
        assert resp.json()["prof_id"] == prof.id

    def test_response_structure(self, db, prof):
        resp = auth_client(prof).get(self.URL)
        data = resp.json()
        assert "prof_id" in data
        assert "prof_email" in data
        assert "exercises" in data
        assert "confidence_trends" in data

    def test_exercises_list_contains_own_exercises(self, db, prof, exercise):
        resp = auth_client(prof).get(self.URL)
        ids = [e["id"] for e in resp.json()["exercises"]]
        assert exercise.id in ids

    def test_other_prof_exercises_not_visible(self, db, prof, other_prof, exercise):
        # exercise belongs to prof; other_prof should not see it
        resp = auth_client(other_prof).get(self.URL)
        ids = [e["id"] for e in resp.json()["exercises"]]
        assert exercise.id not in ids

    def test_exercise_fields(self, db, prof, exercise):
        resp = auth_client(prof).get(self.URL)
        ex_data = resp.json()["exercises"][0]
        for field in ("id", "titre", "maladie", "difficulte", "actif",
                      "nb_attempts", "avg_score", "nb_students", "hardest_images"):
            assert field in ex_data, f"missing field: {field}"

    def test_total_attempts_counts_correctly(self, db, prof, exercise, attempt):
        resp = auth_client(prof).get(self.URL)
        ex_data = next(e for e in resp.json()["exercises"] if e["id"] == exercise.id)
        assert ex_data["nb_attempts"] == 1

    def test_student_count_is_correct(self, db, prof, exercise, attempt):
        resp = auth_client(prof).get(self.URL)
        ex_data = next(e for e in resp.json()["exercises"] if e["id"] == exercise.id)
        assert ex_data["nb_students"] == 1

    def test_hardest_images_is_list(self, db, prof, exercise):
        resp = auth_client(prof).get(self.URL)
        ex_data = resp.json()["exercises"][0]
        assert isinstance(ex_data["hardest_images"], list)

    def test_confidence_trends_is_list(self, db, prof):
        resp = auth_client(prof).get(self.URL)
        assert isinstance(resp.json()["confidence_trends"], list)

    def test_confidence_trends_contain_metrics(self, db, prof, exercise):
        make_metric("pneumonie", "confidence", 0.88)
        resp = auth_client(prof).get(self.URL)
        trends = resp.json()["confidence_trends"]
        assert len(trends) == 1
        assert trends[0]["maladie"] == "pneumonie"
        assert trends[0]["avg_confidence"] == pytest.approx(0.88, abs=0.01)

    def test_avg_score_correct(self, db, prof, exercise, attempt):
        resp = auth_client(prof).get(self.URL)
        data = resp.json()
        ex_data = next(e for e in data["exercises"] if e["id"] == exercise.id)
        assert ex_data["avg_score"] == pytest.approx(100.0, abs=0.1)
        assert data["avg_score"] == pytest.approx(100.0, abs=0.1)

    def test_avg_score_none_when_no_attempts(self, db, prof, exercise):
        resp = auth_client(prof).get(self.URL)
        ex_data = next(e for e in resp.json()["exercises"] if e["id"] == exercise.id)
        assert ex_data["avg_score"] is None

    def test_global_aggregates(self, db, prof, exercise, attempt):
        data = auth_client(prof).get(self.URL).json()
        assert data["total_attempts"] == 1
        assert data["total_students"] == 1


# ---------------------------------------------------------------------------
# GET /api/analytics/dashboard/admin/
# ---------------------------------------------------------------------------


class TestAdminDashboardView:
    URL = "/api/analytics/dashboard/admin/"

    def test_admin_can_access(self, db, admin_user):
        resp = auth_client(admin_user).get(self.URL)
        assert resp.status_code == 200

    def test_prof_is_forbidden(self, db, prof):
        resp = auth_client(prof).get(self.URL)
        assert resp.status_code == 403

    def test_student_is_forbidden(self, db, student):
        resp = auth_client(student).get(self.URL)
        assert resp.status_code == 403

    def test_unauthenticated_rejected(self, db):
        resp = APIClient().get(self.URL)
        assert resp.status_code == 401

    def test_response_structure(self, db, admin_user):
        data = auth_client(admin_user).get(self.URL).json()
        for field in ("total_users", "total_admins", "total_profs", "total_students",
                      "total_exercises", "total_attempts", "avg_score",
                      "etl_health", "model_metrics", "recent_etl_logs"):
            assert field in data, f"missing field: {field}"

    def test_users_block_counts_roles(self, db, admin_user, prof, student):
        data = auth_client(admin_user).get(self.URL).json()
        assert data["total_admins"] >= 1
        assert data["total_profs"] >= 1
        assert data["total_students"] >= 1
        assert data["total_users"] == data["total_admins"] + data["total_profs"] + data["total_students"]

    def test_total_exercises_counts(self, db, admin_user, exercise):
        resp = auth_client(admin_user).get(self.URL)
        assert resp.json()["total_exercises"] >= 1

    def test_total_attempts_counts(self, db, admin_user, attempt):
        resp = auth_client(admin_user).get(self.URL)
        assert resp.json()["total_attempts"] >= 1

    def test_avg_score_is_correct(self, db, admin_user, attempt):
        resp = auth_client(admin_user).get(self.URL)
        assert resp.json()["avg_score"] == pytest.approx(100.0, abs=0.1)

    def test_model_metrics_is_list(self, db, admin_user):
        resp = auth_client(admin_user).get(self.URL)
        assert isinstance(resp.json()["model_metrics"], list)

    def test_model_metrics_entry_from_sqlite(self, db, admin_user):
        make_metric("pneumonie", "confidence", 0.91)
        make_metric("pneumonie", "latency_ms", 120)
        resp = auth_client(admin_user).get(self.URL)
        entry = next(m for m in resp.json()["model_metrics"] if m["maladie"] == "pneumonie")
        for field in ("maladie", "model_id", "metric_value", "avg_latency_ms", "sample_count"):
            assert field in entry, f"missing field: {field}"
        assert entry["metric_value"] == pytest.approx(0.91, abs=0.01)
        assert entry["avg_latency_ms"] == pytest.approx(120.0, abs=1.0)

    def test_etl_health_block_structure(self, db, admin_user):
        etl = auth_client(admin_user).get(self.URL).json()["etl_health"]
        assert set(etl) == {"total", "success", "error"}

    def test_etl_health_counts_logs(self, db, admin_user):
        make_etl_log("r1", 1, status="success")
        make_etl_log("r2", 2, status="error")
        data = auth_client(admin_user).get(self.URL).json()
        assert data["etl_health"] == {"total": 2, "success": 1, "error": 1}
        assert len(data["recent_etl_logs"]) == 2

    def test_empty_platform(self, db, admin_user):
        data = auth_client(admin_user).get(self.URL).json()
        assert data["model_metrics"] == []
        assert data["total_attempts"] == 0
        assert data["avg_score"] is None
