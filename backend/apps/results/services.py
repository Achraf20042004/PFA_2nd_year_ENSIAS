"""
Business logic for the results app.
"""
from apps.results.models import Attempt, ImageResult


VALID_LABELS = {"malade", "sain"}


class SubmissionError(Exception):
    """Raised when a submitted answer payload is invalid."""


def submit_attempt(student, exercise, answers: list[dict], duree_reelle: int, mode: str) -> Attempt:
    """
    Validate and persist a student's attempt.

    `answers` is a list of dicts:
        [{"image_id": <int>, "reponse_etudiant": "malade"|"sain"}, ...]

    Steps:
      1. Validate all images belong to exercise.dataset.
      2. Compare student answer to ground-truth label → compute correct + score.
      3. In Phase 1, reponse_modele = ground-truth label (placeholder for AI).
      4. Create Attempt + ImageResult records atomically.
      5. Trigger badge evaluation.

    Returns the saved Attempt instance.
    """
    from apps.datasets.models import Image
    from apps.badges.services import award_badges

    if not answers:
        raise SubmissionError("At least one answer is required.")

    # Fetch images in one query and index by id
    image_ids = [a["image_id"] for a in answers]
    images_qs = Image.objects.filter(
        id__in=image_ids, dataset=exercise.dataset
    )
    images_by_id = {img.id: img for img in images_qs}

    image_results_to_create = []
    correct_count = 0

    for answer in answers:
        image_id = answer["image_id"]
        reponse_etudiant = answer["reponse_etudiant"].lower()

        if reponse_etudiant not in VALID_LABELS:
            raise SubmissionError(
                f"Invalid label '{reponse_etudiant}'. Must be 'malade' or 'sain'."
            )

        image = images_by_id.get(image_id)
        if image is None:
            raise SubmissionError(
                f"Image {image_id} does not belong to this exercise's dataset."
            )

        is_correct = reponse_etudiant == image.label
        if is_correct:
            correct_count += 1

        image_results_to_create.append(
            ImageResult(
                image=image,
                reponse_etudiant=reponse_etudiant,
                reponse_modele=image.label,   # Phase 1 placeholder; replaced by AI in Phase 2
                correct=is_correct,
                gradcam_path=None,
            )
        )

    score = correct_count / len(answers)

    attempt = Attempt.objects.create(
        etudiant=student,
        exercise=exercise,
        score=score,
        mode=mode,
        duree_reelle=duree_reelle,
    )

    for ir in image_results_to_create:
        ir.attempt = attempt
    ImageResult.objects.bulk_create(image_results_to_create)

    # Trigger badge evaluation (fire-and-forget — does not affect the response)
    try:
        award_badges(student, attempt)
    except Exception:
        pass  # badge failure must never break the submission

    return attempt


def get_exercise_stats(exercise) -> dict:
    """
    Aggregate statistics for a professor's exercise.
    Returns avg score, score distribution (5 buckets), and top error images.
    """
    from django.db.models import Avg, Count

    attempts = Attempt.objects.filter(exercise=exercise)
    total = attempts.count()

    if total == 0:
        return {
            "total_attempts": 0,
            "avg_score": None,
            "score_distribution": {
                "0-20": 0, "20-40": 0, "40-60": 0, "60-80": 0, "80-100": 0
            },
            "common_errors": [],
        }

    avg_score = attempts.aggregate(avg=Avg("score"))["avg"]

    buckets = {"0-20": 0, "20-40": 0, "40-60": 0, "60-80": 0, "80-100": 0}
    for attempt in attempts.values_list("score", flat=True):
        pct = attempt * 100
        if pct < 20:
            buckets["0-20"] += 1
        elif pct < 40:
            buckets["20-40"] += 1
        elif pct < 60:
            buckets["40-60"] += 1
        elif pct < 80:
            buckets["60-80"] += 1
        else:
            buckets["80-100"] += 1

    error_rows = (
        ImageResult.objects.filter(attempt__exercise=exercise, correct=False)
        .values("image_id", "image__chemin")
        .annotate(error_count=Count("id"))
        .order_by("-error_count")[:10]
    )
    common_errors = [
        {
            "image_id": row["image_id"],
            "chemin": row["image__chemin"],
            "error_count": row["error_count"],
            "error_rate": round(row["error_count"] / total, 3),
        }
        for row in error_rows
    ]

    return {
        "total_attempts": total,
        "avg_score": round(avg_score, 3),
        "score_distribution": buckets,
        "common_errors": common_errors,
    }
