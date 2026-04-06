"""
Image randomisation service for exercises.

Rules:
- Avoid images seen in the last 3 attempts for this student+exercise.
- Maintain 50/50 balance between "malade" and "sain" (extra image goes to malade on odd n).
- When not enough unseen images, backfill with least-recently-seen ones.
"""
import random

from django.utils import timezone


# ---------------------------------------------------------------------------
# Validation helpers (called by start view before generating the session)
# ---------------------------------------------------------------------------

class ExerciseStartError(Exception):
    """Raised when a student is not permitted to start the exercise."""


def check_exam_access(user, exercise):
    """
    Raise ExerciseStartError when the user cannot start this exercise.

    The view is responsible for blocking inactive exercises per role;
    this function only enforces dataset readiness and exam config rules
    (deadline, max_tentatives) so it can be called for any role.
    """
    if exercise.dataset.statut != "ready":
        raise ExerciseStartError("The dataset for this exercise is not ready yet.")

    try:
        cfg = exercise.exam_config
    except exercise.__class__.exam_config.RelatedObjectDoesNotExist:
        return  # no config == free practice, no restrictions

    if not cfg.est_examen:
        return  # practice mode, no restrictions

    if cfg.deadline and timezone.now() > cfg.deadline:
        raise ExerciseStartError("The exam deadline has passed.")

    if cfg.max_tentatives is not None:
        from apps.results.models import Attempt
        used = Attempt.objects.filter(
            etudiant=user, exercise=exercise, mode="exam"
        ).count()
        if used >= cfg.max_tentatives:
            raise ExerciseStartError(
                f"Maximum attempts ({cfg.max_tentatives}) already reached."
            )


# ---------------------------------------------------------------------------
# Randomisation
# ---------------------------------------------------------------------------

def get_exercise_images(student, exercise, n=10):
    """
    Return a randomised list of n Image instances for the given student+exercise.

    Algorithm (per label):
    1. Look up image IDs seen in the last 3*n ImageResults for this pair.
    2. Prefer unseen images; backfill with seen ones when necessary.
    3. Shuffle the final list so label order is not predictable.
    """
    from apps.datasets.models import Image
    from apps.results.models import ImageResult

    recent_ids = set(
        ImageResult.objects.filter(
            attempt__etudiant=student,
            attempt__exercise=exercise,
        )
        .order_by("-attempt__date")
        .values_list("image_id", flat=True)[: 3 * n]
    )

    n_malade = (n + 1) // 2   # ceil — gets the extra image when n is odd
    n_sain = n // 2

    selected = []
    for label, count in [("malade", n_malade), ("sain", n_sain)]:
        all_for_label = list(
            Image.objects.filter(dataset=exercise.dataset, label=label)
        )
        if not all_for_label:
            continue

        unseen = [img for img in all_for_label if img.id not in recent_ids]
        seen = [img for img in all_for_label if img.id in recent_ids]

        if len(unseen) >= count:
            selected.extend(random.sample(unseen, count))
        else:
            # Take all unseen + fill from seen
            need = count - len(unseen)
            backfill = random.sample(seen, min(len(seen), need))
            pool = unseen + backfill
            selected.extend(random.sample(pool, min(count, len(pool))))

    random.shuffle(selected)
    return selected
