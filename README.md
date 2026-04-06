# MedTrain AI

[![CI](https://github.com/Aymane7236/medtrain/actions/workflows/ci.yml/badge.svg)](https://github.com/Aymane7236/medtrain/actions/workflows/ci.yml)

A medical education platform where professors create image-based diagnostic exercises
and students practice diagnosing medical images with AI feedback.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Django 6 + Django REST Framework |
| Database | PostgreSQL 16 |
| Task queue | Celery + Redis |
| File storage | MinIO (dev) / AWS S3 (prod) |
| AI pipeline | PyTorch + EfficientNet-B0 (Phase 2) |
| Auth | JWT + OAuth2 (Google / Microsoft) |
| Frontend | React (Phase 2) |
| Mobile | Kotlin / Android (Phase 2) |

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
medtrain/
├── backend/          Django app (apps/, config/, ml/, tasks/)
├── frontend/         React app (Phase 2)
├── mobile/           Kotlin Android app (Phase 2)
├── docs/             Architecture & API docs
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
