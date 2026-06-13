"""
Business logic for the analytics dashboard.

All queries that touch the 'analytics' SQLite database explicitly use
.using("analytics"). PostgreSQL queries use the default database.
Cross-database joins are avoided — data is merged in Python.
"""
import logging
from datetime import timedelta

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# ETL Logs
# ---------------------------------------------------------------------------


def get_etl_logs(
    dataset_id: int | None = None,
    domain: str | None = None,
    status: str | None = None,
    step: str | None = None,
    date_from=None,
    date_to=None,
):
    """
    Return a filtered ETLLog queryset from the analytics database.

    `domain` triggers a cross-DB lookup: dataset IDs whose maladie matches
    the given domain are fetched from PostgreSQL, then used to filter ETLLog.
    """
    from apps.analytics.models import ETLLog

    qs = ETLLog.objects.using("analytics").all()

    if domain:
        # Cross-DB: look up matching dataset_ids from PostgreSQL
        from apps.datasets.models import Dataset

        matching_ids = list(
            Dataset.objects.filter(maladie__icontains=domain).values_list("id", flat=True)
        )
        qs = qs.filter(dataset_id__in=matching_ids)

    if dataset_id is not None:
        qs = qs.filter(dataset_id=dataset_id)
    if status:
        qs = qs.filter(status=status)
    if step:
        qs = qs.filter(step=step)
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)

    return qs.order_by("-created_at")


# ---------------------------------------------------------------------------
# Model Metrics
# ---------------------------------------------------------------------------


def get_model_metrics_summary(malades: list[str] | None = None) -> list[dict]:
    """
    Return per-domain averages for confidence and latency_ms from the analytics DB.

    Args:
        malades: Optional whitelist of disease keys to include.

    Returns:
        List of dicts:
            { maladie, model_id, avg_confidence, avg_latency_ms, sample_count }
    """
    from django.db.models import Avg, Count

    from apps.analytics.models import ModelMetric

    base_qs = ModelMetric.objects.using("analytics")
    if malades:
        # case-insensitive: normalise stored maladie values too
        base_qs = base_qs.filter(maladie__in=malades)

    conf_rows = (
        base_qs.filter(metric_name="confidence")
        .values("maladie", "model_id")
        .annotate(avg_confidence=Avg("metric_value"), sample_count=Count("id"))
    )

    latency_rows = (
        base_qs.filter(metric_name="latency_ms")
        .values("maladie")
        .annotate(avg_latency_ms=Avg("metric_value"))
    )
    latency_map = {r["maladie"]: r["avg_latency_ms"] for r in latency_rows}

    result = []
    for row in conf_rows:
        avg_lat = latency_map.get(row["maladie"])
        result.append(
            {
                "maladie": row["maladie"],
                "model_id": row["model_id"],
                "avg_confidence": round(row["avg_confidence"], 4)
                if row["avg_confidence"] is not None
                else None,
                "avg_latency_ms": round(avg_lat, 1) if avg_lat is not None else None,
                "sample_count": row["sample_count"],
            }
        )

    return result


# ---------------------------------------------------------------------------
# Prof dashboard
# ---------------------------------------------------------------------------


def get_prof_dashboard(prof) -> dict:
    """
    Aggregate data for the professor dashboard.

    PostgreSQL sources: Exercise, Attempt, ImageResult.
    SQLite source:     ModelMetric (confidence trends).
    """
    from django.db.models import Avg, Count

    from apps.exercises.models import Exercise
    from apps.results.models import Attempt, ImageResult

    DOMAIN_LABELS = {
        "pneumonie": "Radiologie",
        "melanome": "Dermatologie",
        "tumeur": "Neurologie",
    }

    exercises = list(Exercise.objects.filter(prof=prof).order_by("-created_at"))

    exercises_data = []
    for ex in exercises:
        attempts_qs = Attempt.objects.filter(exercise=ex)
        total = attempts_qs.count()
        agg = attempts_qs.aggregate(avg=Avg("score"))
        avg_score = agg["avg"]
        nb_students = attempts_qs.values("etudiant").distinct().count()

        hardest = list(
            ImageResult.objects.filter(attempt__exercise=ex, correct=False)
            .values("image_id", "image__chemin")
            .annotate(error_count=Count("id"))
            .order_by("-error_count")[:5]
        )

        domain_label = DOMAIN_LABELS.get(ex.maladie.lower(), ex.maladie.capitalize())
        exercises_data.append(
            {
                "id": ex.id,
                "titre": f"{domain_label} — {ex.difficulte.capitalize()}",
                "maladie": ex.maladie,
                "difficulte": ex.difficulte,
                "actif": ex.actif,
                "nb_attempts": total,
                "avg_score": round(avg_score * 100, 1) if avg_score is not None else None,
                "nb_students": nb_students,
                "hardest_images": [
                    {
                        "image_id": r["image_id"],
                        "chemin": r["image__chemin"],
                        "error_count": r["error_count"],
                        "error_rate": round(r["error_count"] / total, 3)
                        if total > 0
                        else 0.0,
                    }
                    for r in hardest
                ],
            }
        )

    # Sort by activity: most-attempted exercise first so the default selection is meaningful
    exercises_data.sort(key=lambda e: e["nb_attempts"], reverse=True)

    # Top-level aggregates expected by the prof dashboard
    all_attempts = Attempt.objects.filter(exercise__in=exercises)
    total_attempts = all_attempts.count()
    total_students = all_attempts.values("etudiant").distinct().count()
    global_avg = all_attempts.aggregate(avg=Avg("score"))["avg"]

    # Confidence trends from SQLite — scoped to this prof's disease domains
    malades = list({ex.maladie.lower() for ex in exercises})
    confidence_trends = get_model_metrics_summary(malades=malades) if malades else []

    return {
        "prof_id": prof.id,
        "prof_email": prof.email,
        "exercises": exercises_data,
        "total_students": total_students,
        "total_attempts": total_attempts,
        "avg_score": round(global_avg * 100, 1) if global_avg is not None else None,
        "confidence_trends": confidence_trends,
    }


# ---------------------------------------------------------------------------
# Prof profile stats
# ---------------------------------------------------------------------------


def get_prof_profile_stats(prof) -> dict:
    """
    Teaching statistics for the professor profile page.

    Returns dataset counts, student/attempt aggregates, most active domain,
    weekly attempt sparkline data, and the 3 most recent datasets.
    """
    from datetime import timedelta

    from django.db.models import Avg, Count
    from django.utils import timezone

    from apps.datasets.models import Dataset
    from apps.exercises.models import Exercise
    from apps.results.models import Attempt

    exercises = Exercise.objects.filter(prof=prof)
    datasets = Dataset.objects.filter(prof=prof)
    all_attempts = Attempt.objects.filter(exercise__in=exercises)

    total_datasets = datasets.count()
    total_students = all_attempts.values("etudiant").distinct().count()
    total_attempts_count = all_attempts.count()
    avg_raw = all_attempts.aggregate(avg=Avg("score"))["avg"]
    avg_score = round(avg_raw * 100, 1) if avg_raw is not None else None

    # Most active domain (by attempt count)
    domain_rows = list(
        all_attempts.values("exercise__maladie")
        .annotate(cnt=Count("id"))
        .order_by("-cnt")
    )
    top_domain = domain_rows[0]["exercise__maladie"] if domain_rows else None

    # Weekly sparkline — last 8 complete weeks
    now = timezone.now()
    weekly_attempts = []
    for i in range(7, -1, -1):
        week_start = now - timedelta(weeks=i + 1)
        week_end = now - timedelta(weeks=i)
        count = all_attempts.filter(date__gte=week_start, date__lt=week_end).count()
        label = f"S{(now - timedelta(weeks=i)).isocalendar()[1]}"
        weekly_attempts.append({"week": label, "count": count})

    # 3 most recent datasets
    recent_datasets = [
        {
            "id": d.id,
            "maladie": d.maladie,
            "statut": d.statut,
            "nb_images": d.nb_images,
            "created_at": d.created_at.isoformat(),
        }
        for d in datasets.order_by("-created_at")[:3]
    ]

    return {
        "total_datasets": total_datasets,
        "total_students": total_students,
        "total_attempts": total_attempts_count,
        "avg_score": avg_score,
        "top_domain": top_domain,
        "weekly_attempts": weekly_attempts,
        "recent_datasets": recent_datasets,
    }


# ---------------------------------------------------------------------------
# Admin dashboard
# ---------------------------------------------------------------------------


def get_admin_dashboard() -> dict:
    """
    Global statistics for the admin dashboard.

    PostgreSQL sources: User, Exercise, Attempt.
    SQLite source:     ModelMetric, ETLLog.
    """
    from django.contrib.auth import get_user_model
    from django.db.models import Avg, Count
    from django.utils import timezone

    from apps.analytics.models import ETLLog
    from apps.datasets.models import Dataset
    from apps.exercises.models import Exercise
    from apps.results.models import Attempt

    User = get_user_model()

    # ---- User counts (PostgreSQL) ----------------------------------------
    role_counts = dict(User.objects.values_list("role").annotate(n=Count("id")))
    total_admins   = role_counts.get("admin", 0)
    total_profs    = role_counts.get("prof", 0)
    total_students = role_counts.get("etudiant", 0)
    total_users    = total_admins + total_profs + total_students

    # ---- Global attempt stats (PostgreSQL) --------------------------------
    total_attempts = Attempt.objects.count()
    global_avg_raw = Attempt.objects.aggregate(avg=Avg("score"))["avg"]
    avg_score = round(global_avg_raw * 100, 1) if global_avg_raw is not None else None

    # ---- ETL health (SQLite) — total, success, error counts ---------------
    etl_qs      = ETLLog.objects.using("analytics")
    etl_total   = etl_qs.count()
    etl_success = etl_qs.filter(status="success").count()
    etl_error   = etl_qs.filter(status="error").count()

    # ---- Recent ETL logs (last 10, with maladie resolved via dataset_id) --
    recent_raw = list(
        etl_qs.order_by("-created_at").values(
            "id", "pipeline_run_id", "dataset_id", "step",
            "status", "message", "duration_ms", "created_at",
        )[:10]
    )
    # Build dataset_id → maladie map from PostgreSQL to avoid cross-DB join
    ds_ids = list({r["dataset_id"] for r in recent_raw if r["dataset_id"]})
    maladie_map = dict(
        Dataset.objects.filter(id__in=ds_ids).values_list("id", "maladie")
    ) if ds_ids else {}
    recent_etl_logs = [
        {
            "id": r["id"],
            "dataset_id": r["dataset_id"],
            "step": r["step"],
            "status": r["status"],
            "message": r["message"],
            "duration_ms": r["duration_ms"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "maladie": maladie_map.get(r["dataset_id"]),
        }
        for r in recent_raw
    ]

    # ---- AI model metrics (SQLite) — avg confidence per domain ------------
    metrics_summary = get_model_metrics_summary()
    model_metrics = [
        {
            "maladie": row["maladie"],
            "model_id": row["model_id"],
            "metric_value": row["avg_confidence"],   # 0-1 range, frontend multiplies by 100
            "avg_latency_ms": row["avg_latency_ms"],
            "sample_count": row["sample_count"],
        }
        for row in metrics_summary
    ]

    return {
        "total_users":    total_users,
        "total_admins":   total_admins,
        "total_profs":    total_profs,
        "total_students": total_students,
        "total_exercises": Exercise.objects.count(),
        "total_attempts": total_attempts,
        "avg_score": avg_score,
        "etl_health": {
            "total":   etl_total,
            "success": etl_success,
            "error":   etl_error,
        },
        "model_metrics":   model_metrics,
        "recent_etl_logs": recent_etl_logs,
    }
