# MedTrain AI

[![CI](https://github.com/Achraf20042004/PFA_2nd_year_ENSIAS/actions/workflows/ci.yml/badge.svg)](https://github.com/Achraf20042004/PFA_2nd_year_ENSIAS/actions/workflows/ci.yml)

A medical education platform where professors create image-based diagnostic exercises
and students practice diagnosing medical images (chest X-rays, skin lesions, brain MRIs)
with AI feedback: model prediction, confidence score and Grad-CAM heatmaps.

> Second-year end-of-year project (PFA) at ENSIAS, built as a team.

## Team

| Member | GitHub |
|---|---|
| Achraf Zbakh | [@Achraf20042004](https://github.com/Achraf20042004) |
| Mohamed Aymane Eddaoudi | [@Aymane7236](https://github.com/Aymane7236) |

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Django 6 + Django REST Framework, Django Channels (WebSocket) |
| Databases | PostgreSQL 16 (transactional) + SQLite (analytics) |
| Task queue | Celery + Redis |
| File storage | MinIO (dev) / AWS S3 (prod) |
| AI pipeline | PyTorch + HuggingFace ViT models, Grad-CAM |
| Auth | JWT + OAuth2 (Google / Microsoft) |
| Frontend | React 19 + Vite + Tailwind CSS |
| CI/CD | GitHub Actions (flake8, pytest on Postgres, Docker image to GHCR) |

## Quick start (Docker)

```bash
# 1. Copy env template and fill in required values
cp .env.example .env

# 2. Start the full dev stack (Postgres, Redis, MinIO, Django, Celery)
docker compose up --build

# 3. Create a superuser
docker compose exec django python manage.py createsuperuser

# API is available at http://localhost:8000
# MinIO console at http://localhost:9001  (user/pass from .env)
```

## Running tests locally

```bash
cd backend
python -m pytest apps/ -q
```

## Project structure

```
.
├── backend/          Django project (apps/, config/, ml/, tasks/)
├── frontend/         React app (student, professor and admin interfaces)
├── locustfile.py     Load tests
├── docker-compose.yml
└── docker-compose.override.yml  (dev overrides)
```

## API overview

| Endpoint | Description |
|---|---|
| `POST /api/auth/login/` | Email + password → JWT |
| `POST /api/auth/register/` | Create account |
| `GET  /api/exercises/` | List active exercises |
| `GET  /api/exercises/{id}/start/` | Get randomised image session |
| `POST /api/attempts/` | Submit answers → score |
| `GET  /api/attempts/{id}/feedback/` | Per-image breakdown + course recommendation |
| `GET  /api/results/me/` | Student progression history |
| `GET  /api/results/exercise/{id}/` | Professor exercise statistics |
| `GET  /api/badges/me/` | Earned + available badges |
| `POST /api/courses/upload/` | Upload course PDF / video |
| `GET  /api/courses/` | List courses (filterable by `?maladie=`) |
| `POST /api/datasets/upload/` | Upload image dataset (.zip) |
| `GET  /api/analytics/etl-logs/` | ETL pipeline audit log (admin) |
| `GET  /api/analytics/model-metrics/` | HuggingFace model performance (prof/admin) |
| `GET  /api/analytics/dashboard/prof/` | Per-exercise KPIs + confidence trends |
| `GET  /api/analytics/dashboard/admin/` | Global platform statistics |

---

## Performance tests (Locust)

The `locustfile.py` at the project root runs three weighted scenarios against a
live backend: student exercise sessions (60 %), professor dataset uploads (30 %),
and admin analytics polling (10 %).

**Target:** 50 concurrent users, p95 response time < 2 000 ms.

### Prerequisites

1. A running MedTrain backend (`docker compose up --build`)
2. Locust installed (`pip install locust>=2.24.0`)
3. Seed test users (run once):

```bash
cd backend
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
print('Seed users ready.')
"
```

4. At least one active exercise with images (create via the admin panel or API).

### Running Locust

```bash
# Interactive web UI — open http://localhost:8089 and set users/spawn-rate
locust -f locustfile.py --host=http://localhost:8000

# Headless (CI/CD) — staged ramp-up via MedTrainLoadShape, 5-minute run
locust -f locustfile.py --host=http://localhost:8000 --headless

# Simple constant load (overrides the built-in shape)
locust -f locustfile.py --host=http://localhost:8000 \
       --users=50 --spawn-rate=5 --run-time=3m --headless

# Custom credentials
export LOCUST_STUDENT_EMAIL=myuser@example.com
export LOCUST_STUDENT_PASSWORD=mypassword
locust -f locustfile.py --host=http://localhost:8000 --headless
```

### Load shape (default)

| Phase | Duration | Users | Spawn rate |
|---|---|---|---|
| Ramp up (low) | 0 – 30 s | 0 → 10 | 2/s |
| Ramp up (mid) | 30 – 90 s | 10 → 30 | 4/s |
| Ramp up (full) | 90 – 150 s | 30 → 50 | 5/s |
| Steady state | 150 – 270 s | 50 | — |
| Cool down | 270 – 300 s | 50 → 0 | 10/s |

### Interpreting results

Key metrics to watch in the Locust report:

| Metric | Target |
|---|---|
| p95 response time | < 2 000 ms |
| Failure rate | < 1 % |
| `/api/attempts/` p95 | < 3 000 ms (includes ML inference) |
| `/api/datasets/upload/` p95 | < 5 000 ms (Celery async, returns immediately) |

A high p95 on `/api/attempts/` indicates that the HuggingFace model is not
cached and needs warm-up. Send a few requests before measuring steady-state
performance.
