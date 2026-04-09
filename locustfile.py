"""
MedTrain AI — Locust performance test suite.

Three user scenarios weighted to reflect realistic traffic:

  StudentUser  (weight 6)  login → list exercises → start session →
                            submit answers → view feedback → history/badges
  ProfUser     (weight 3)  login → upload dataset → poll status →
                            view professor analytics dashboard
  AdminUser    (weight 1)  login → admin dashboard → model metrics →
                            ETL logs

Target: 50 concurrent users, p95 response time < 2 000 ms.

────────────────────────────────────────────────────────────────────────────
Quick start
────────────────────────────────────────────────────────────────────────────

# Install
pip install locust

# Interactive web UI (opens http://localhost:8089)
locust -f locustfile.py --host=http://localhost:8000

# Headless CI run (50 users, 5/s ramp-up, 3-minute test)
locust -f locustfile.py --host=http://localhost:8000 \\
       --users=50 --spawn-rate=5 --run-time=3m --headless

# Custom credentials (defaults below work with the seed data script)
export LOCUST_STUDENT_EMAIL=student@medtrain.local
export LOCUST_STUDENT_PASSWORD=testpass123
export LOCUST_PROF_EMAIL=prof@medtrain.local
export LOCUST_PROF_PASSWORD=testpass123
export LOCUST_ADMIN_EMAIL=admin@medtrain.local
export LOCUST_ADMIN_PASSWORD=testpass123

────────────────────────────────────────────────────────────────────────────
Prerequisites
────────────────────────────────────────────────────────────────────────────

A running MedTrain backend with at least one active exercise that has images.
Use the management command (or Django shell) to seed test users before running:

  python manage.py shell -c "
  from django.contrib.auth import get_user_model
  User = get_user_model()
  for email, role in [
      ('student@medtrain.local', 'etudiant'),
      ('prof@medtrain.local',    'prof'),
      ('admin@medtrain.local',   'admin'),
  ]:
      if not User.objects.filter(email=email).exists():
          u = User(email=email, username=email, role=role)
          u.set_password('testpass123')
          u.save()
  print('Seed users created.')
  "
"""

import io
import os
import random
import string
import zipfile

from locust import HttpUser, LoadTestShape, between, task

# ---------------------------------------------------------------------------
# Credentials (override via environment variables)
# ---------------------------------------------------------------------------

STUDENT_EMAIL = os.getenv("LOCUST_STUDENT_EMAIL", "student@medtrain.local")
STUDENT_PASSWORD = os.getenv("LOCUST_STUDENT_PASSWORD", "testpass123")
PROF_EMAIL = os.getenv("LOCUST_PROF_EMAIL", "prof@medtrain.local")
PROF_PASSWORD = os.getenv("LOCUST_PROF_PASSWORD", "testpass123")
ADMIN_EMAIL = os.getenv("LOCUST_ADMIN_EMAIL", "admin@medtrain.local")
ADMIN_PASSWORD = os.getenv("LOCUST_ADMIN_PASSWORD", "testpass123")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _jwt_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _login(client, email: str, password: str) -> str | None:
    """POST /api/auth/login/ and return the access token, or None on failure."""
    resp = client.post(
        "/api/auth/login/",
        json={"email": email, "password": password},
        name="/api/auth/login/",
    )
    if resp.status_code == 200:
        return resp.json().get("access")
    return None


def _make_minimal_zip(n_per_label: int = 10) -> bytes:
    """
    Build an in-memory ZIP that satisfies the backend ETL validator:
      - Two top-level directories: malade/ and sain/
      - At least MIN_IMAGES_PER_LABEL (10) .jpg files in each
    Image content is synthetic (not a real image); the ETL pipeline validates
    extension and count only, not pixel content.
    """
    fake_pixel = b"\xff\xd8\xff\xd9"  # minimal JPEG marker sequence
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for label in ("malade", "sain"):
            for i in range(n_per_label):
                zf.writestr(f"{label}/img_{i:04d}.jpg", fake_pixel)
    buf.seek(0)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Scenario 1 — Student (60 % of traffic)
# ---------------------------------------------------------------------------


class StudentUser(HttpUser):
    """
    Simulates a medical student:
      1. Login
      2. Browse available exercises
      3. Start an exercise session (get randomised images)
      4. Submit answers (random malade / sain)
      5. View detailed feedback
      6. Check personal history and badges
    """

    weight = 6
    wait_time = between(1, 4)

    _token: str | None = None
    _exercise_ids: list[int]

    def on_start(self) -> None:
        self._exercise_ids = []
        self._token = _login(self.client, STUDENT_EMAIL, STUDENT_PASSWORD)
        if self._token:
            self._refresh_exercise_list()

    def _refresh_exercise_list(self) -> None:
        resp = self.client.get(
            "/api/exercises/",
            headers=_jwt_headers(self._token),
            name="/api/exercises/",
        )
        if resp.status_code == 200:
            body = resp.json()
            items = body.get("results", body) if isinstance(body, dict) else body
            self._exercise_ids = [e["id"] for e in items if isinstance(e, dict)]

    # ---- Tasks -------------------------------------------------------

    @task(1)
    def browse_exercises(self) -> None:
        """GET /api/exercises/ — catalogue browsing."""
        if not self._token:
            return
        self.client.get(
            "/api/exercises/",
            headers=_jwt_headers(self._token),
            name="/api/exercises/",
        )

    @task(5)
    def full_exercise_session(self) -> None:
        """Start → submit → feedback — the core student flow."""
        if not self._token:
            return
        if not self._exercise_ids:
            self._refresh_exercise_list()
            return

        exercise_id = random.choice(self._exercise_ids)

        # 1. Start session
        resp = self.client.get(
            f"/api/exercises/{exercise_id}/start/",
            headers=_jwt_headers(self._token),
            name="/api/exercises/[id]/start/",
        )
        if resp.status_code != 200:
            return

        images = resp.json().get("images", [])
        if not images:
            return

        # 2. Submit answers (random)
        answers = [
            {
                "image_id": img["id"],
                "reponse_etudiant": random.choice(["malade", "sain"]),
            }
            for img in images
        ]
        resp = self.client.post(
            "/api/attempts/",
            json={
                "exercise": exercise_id,
                "duree_reelle": random.randint(30, 240),
                "mode": "practice",
                "answers": answers,
            },
            headers=_jwt_headers(self._token),
            name="/api/attempts/",
        )
        if resp.status_code != 201:
            return

        attempt_id = resp.json().get("id")

        # 3. View feedback
        self.client.get(
            f"/api/attempts/{attempt_id}/feedback/",
            headers=_jwt_headers(self._token),
            name="/api/attempts/[id]/feedback/",
        )

    @task(2)
    def view_personal_history(self) -> None:
        """GET /api/results/me/ — progression dashboard."""
        if not self._token:
            return
        self.client.get(
            "/api/results/me/",
            headers=_jwt_headers(self._token),
            name="/api/results/me/",
        )

    @task(1)
    def view_badges(self) -> None:
        """GET /api/badges/me/ — gamification."""
        if not self._token:
            return
        self.client.get(
            "/api/badges/me/",
            headers=_jwt_headers(self._token),
            name="/api/badges/me/",
        )


# ---------------------------------------------------------------------------
# Scenario 2 — Professor (30 % of traffic)
# ---------------------------------------------------------------------------


class ProfUser(HttpUser):
    """
    Simulates a professor:
      1. Login
      2. Upload a dataset ZIP (synthetic, passes ETL validation)
      3. Poll the dataset processing status
      4. View their analytics dashboard
      5. Browse their exercises and results
    """

    weight = 3
    wait_time = between(2, 6)

    _token: str | None = None
    _zip_bytes: bytes
    _last_dataset_id: int | None = None

    def on_start(self) -> None:
        self._last_dataset_id = None
        self._zip_bytes = _make_minimal_zip()
        self._token = _login(self.client, PROF_EMAIL, PROF_PASSWORD)

    # ---- Tasks -------------------------------------------------------

    @task(1)
    def list_own_exercises(self) -> None:
        if not self._token:
            return
        self.client.get(
            "/api/exercises/",
            headers=_jwt_headers(self._token),
            name="/api/exercises/",
        )

    @task(3)
    def upload_dataset(self) -> None:
        """POST /api/datasets/upload/ — simulate a dataset submission."""
        if not self._token:
            return
        suffix = "".join(random.choices(string.ascii_lowercase, k=6))
        resp = self.client.post(
            "/api/datasets/upload/",
            files={
                "fichier_zip": (
                    f"dataset_{suffix}.zip",
                    io.BytesIO(self._zip_bytes),
                    "application/zip",
                )
            },
            data={"maladie": random.choice(["pneumonie", "melanome", "retinopathie"])},
            headers=_jwt_headers(self._token),
            name="/api/datasets/upload/",
        )
        if resp.status_code == 201:
            self._last_dataset_id = resp.json().get("id")

    @task(2)
    def poll_dataset_status(self) -> None:
        """GET /api/datasets/{id}/status/ — check ETL progress."""
        if not self._token or self._last_dataset_id is None:
            return
        self.client.get(
            f"/api/datasets/{self._last_dataset_id}/status/",
            headers=_jwt_headers(self._token),
            name="/api/datasets/[id]/status/",
        )

    @task(2)
    def view_prof_analytics_dashboard(self) -> None:
        """GET /api/analytics/dashboard/prof/ — per-exercise KPIs."""
        if not self._token:
            return
        self.client.get(
            "/api/analytics/dashboard/prof/",
            headers=_jwt_headers(self._token),
            name="/api/analytics/dashboard/prof/",
        )

    @task(1)
    def view_model_metrics(self) -> None:
        """GET /api/analytics/model-metrics/ — ML confidence & latency."""
        if not self._token:
            return
        self.client.get(
            "/api/analytics/model-metrics/",
            headers=_jwt_headers(self._token),
            name="/api/analytics/model-metrics/",
        )


# ---------------------------------------------------------------------------
# Scenario 3 — Admin (10 % of traffic)
# ---------------------------------------------------------------------------


class AdminUser(HttpUser):
    """
    Simulates a platform administrator:
      1. Login
      2. Poll the global admin dashboard
      3. Check model performance metrics
      4. Review ETL pipeline logs
      5. Browse the full exercise catalogue
    """

    weight = 1
    wait_time = between(3, 10)

    _token: str | None = None

    def on_start(self) -> None:
        self._token = _login(self.client, ADMIN_EMAIL, ADMIN_PASSWORD)

    # ---- Tasks -------------------------------------------------------

    @task(3)
    def admin_dashboard(self) -> None:
        """GET /api/analytics/dashboard/admin/ — global platform KPIs."""
        if not self._token:
            return
        self.client.get(
            "/api/analytics/dashboard/admin/",
            headers=_jwt_headers(self._token),
            name="/api/analytics/dashboard/admin/",
        )

    @task(2)
    def model_metrics(self) -> None:
        """GET /api/analytics/model-metrics/ — per-domain ML stats."""
        if not self._token:
            return
        self.client.get(
            "/api/analytics/model-metrics/",
            headers=_jwt_headers(self._token),
            name="/api/analytics/model-metrics/",
        )

    @task(2)
    def etl_logs(self) -> None:
        """GET /api/analytics/etl-logs/ — ETL pipeline audit log."""
        if not self._token:
            return
        self.client.get(
            "/api/analytics/etl-logs/",
            headers=_jwt_headers(self._token),
            name="/api/analytics/etl-logs/",
        )

    @task(1)
    def etl_logs_filter_errors(self) -> None:
        """GET /api/analytics/etl-logs/?status=error — error monitoring."""
        if not self._token:
            return
        self.client.get(
            "/api/analytics/etl-logs/?status=error",
            headers=_jwt_headers(self._token),
            name="/api/analytics/etl-logs/?status=error",
        )

    @task(1)
    def list_all_exercises(self) -> None:
        if not self._token:
            return
        self.client.get(
            "/api/exercises/",
            headers=_jwt_headers(self._token),
            name="/api/exercises/",
        )


# ---------------------------------------------------------------------------
# Load shape — ramp up to 50 users, hold, then ramp down
# ---------------------------------------------------------------------------


class MedTrainLoadShape(LoadTestShape):
    """
    Staged load profile targeting 50 concurrent users:

      0 – 30 s   ramp 0 → 10 users   (2 users/s)
      30 – 90 s  ramp 10 → 30 users  (4 users/s)
      90 – 150 s ramp 30 → 50 users  (5 users/s)
      150 – 270 s hold at 50 users   (steady state — measure here)
      270 – 300 s ramp 50 → 0 users  (cool down)

    Override with --users / --spawn-rate flags for a simpler constant load.
    """

    stages = [
        {"duration": 30,  "users": 10, "spawn_rate": 2},
        {"duration": 90,  "users": 30, "spawn_rate": 4},
        {"duration": 150, "users": 50, "spawn_rate": 5},
        {"duration": 270, "users": 50, "spawn_rate": 5},
        {"duration": 300, "users": 0,  "spawn_rate": 10},
    ]

    def tick(self) -> tuple[int, float] | None:
        run_time = self.get_run_time()
        for stage in self.stages:
            if run_time <= stage["duration"]:
                return stage["users"], stage["spawn_rate"]
        return None  # test complete
