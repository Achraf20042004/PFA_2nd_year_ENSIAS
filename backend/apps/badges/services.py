"""
Badge evaluation and award logic.

Called after every attempt. Checks each badge condition in turn and awards
any that have become newly satisfied. Already-earned badges are never re-awarded
(enforced by the unique_together on UserBadge).
"""
from datetime import date, timedelta

from apps.badges.models import Badge, UserBadge


def _check_condition(student, badge, attempt) -> bool:
    """Return True if the student now satisfies badge.condition_type."""
    from apps.results.models import Attempt

    ctype = badge.condition_type
    seuil = badge.condition_seuil

    if ctype == Badge.ConditionType.PREMIER_EXO:
        return Attempt.objects.filter(etudiant=student).count() >= 1

    if ctype == Badge.ConditionType.NB_TENTATIVES:
        return Attempt.objects.filter(etudiant=student).count() >= seuil

    if ctype == Badge.ConditionType.SCORE_PARFAIT:
        return attempt.score >= 1.0

    if ctype == Badge.ConditionType.NB_MALADIES:
        distinct = (
            Attempt.objects.filter(etudiant=student)
            .values_list("exercise__maladie", flat=True)
            .distinct()
            .count()
        )
        return distinct >= seuil

    if ctype == Badge.ConditionType.STREAK:
        # Count consecutive days (ending today) where student made at least one attempt
        attempt_dates = set(
            Attempt.objects.filter(etudiant=student)
            .values_list("date__date", flat=True)
        )
        streak = 0
        current = date.today()
        while current in attempt_dates:
            streak += 1
            if streak >= seuil:
                return True
            current -= timedelta(days=1)
        return False

    return False


def award_badges(student, attempt) -> list:
    """
    Evaluate all badges for the student after completing an attempt.
    Create UserBadge records for any newly earned badges.
    Returns a list of newly awarded Badge instances.
    """
    already_earned = set(
        UserBadge.objects.filter(etudiant=student).values_list("badge_id", flat=True)
    )
    newly_awarded = []

    for badge in Badge.objects.all():
        if badge.id in already_earned:
            continue
        if _check_condition(student, badge, attempt):
            UserBadge.objects.get_or_create(etudiant=student, badge=badge)
            newly_awarded.append(badge)

    return newly_awarded
