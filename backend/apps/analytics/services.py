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

    exercises = list(Exercise.objects.filter(prof=prof).order_by("-created_at"))

    exercises_data = []
    for ex in exercises:
        attempts_qs = Attempt.objects.filter(exercise=ex)
        total = attempts_qs.count()
        agg = attempts_qs.aggregate(avg=Avg("score"))
        avg_score = agg["avg"]
        student_count = attempts_qs.values("etudiant").distinct().count()

        hardest = list(
            ImageResult.objects.filter(attempt__exercise=ex, correct=False)
            .values("image_id", "image__chemin")
            .annotate(error_count=Count("id"))
            .order_by("-error_count")[:5]
        )

        exercises_data.append(
            {
                "exercise_id": ex.id,
                "maladie": ex.maladie,
                "difficulte": ex.difficulte,
                "actif": ex.actif,
                "total_attempts": total,
                "avg_score": round(avg_score, 3) if avg_score is not None else None,
                "student_count": student_count,
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

    # Confidence trends from SQLite — scoped to this prof's disease domains
    malades = list(
        {ex.maladie.lower() for ex in exercises}
    )
    confidence_trends = get_model_metrics_summary(malades=malades) if malades else []

    return {
        "prof_id": prof.id,
        "prof_email": prof.email,
        "exercises": exercises_data,
        "confidence_trends": confidence_trends,
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
    from apps.exercises.models import Exercise
    from apps.results.models import Attempt

    User = get_user_model()

    # ---- User counts (PostgreSQL) ----------------------------------------
    role_counts = dict(User.objects.values_list("role").annotate(n=Count("id")))

    # ---- Per-domain stats (PostgreSQL) ------------------------------------
    domain_rows = list(
        Attempt.objects.values("exercise__maladie")
        .annotate(total_attempts=Count("id"), avg_score=Avg("score"))
        .order_by("exercise__maladie")
    )

    # ---- Per-domain ML metrics (SQLite) -----------------------------------
    metrics_by_maladie = {
        row["maladie"].lower(): row for row in get_model_metrics_summary()
    }

    domains = []
    for row in domain_rows:
        maladie = row["exercise__maladie"]
        ml = metrics_by_maladie.get(maladie.lower(), {})
        domains.append(
            {
                "maladie": maladie,
                "total_attempts": row["total_attempts"],
                "avg_score": round(row["avg_score"], 3)
                if row["avg_score"] is not None
                else None,
                "avg_confidence": ml.get("avg_confidence"),
                "avg_latency_ms": ml.get("avg_latency_ms"),
            }
        )

    # ---- ETL health (SQLite) ----------------------------------------------
    cutoff_24h = timezone.now() - timedelta(hours=24)
    etl_total = ETLLog.objects.using("analytics").count()
    etl_activity_24h = ETLLog.objects.using("analytics").filter(
        created_at__gte=cutoff_24h
    ).count()
    etl_errors_24h = ETLLog.objects.using("analytics").filter(
        status="error", created_at__gte=cutoff_24h
    ).count()

    return {
        "users": {
            "admin": role_counts.get("admin", 0),
            "prof": role_counts.get("prof", 0),
            "etudiant": role_counts.get("etudiant", 0),
            "total": sum(role_counts.values()),
        },
        "total_exercises": Exercise.objects.count(),
        "total_attempts": Attempt.objects.count(),
        "domains": domains,
        "etl_health": {
            "total_runs": etl_total,
            "recent_errors_24h": etl_errors_24h,
            "activity_24h": etl_activity_24h,
        },
    }
