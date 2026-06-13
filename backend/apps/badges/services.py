"""
Badge evaluation and award logic.

Called after every attempt. Checks each badge condition in turn and awards
any that have become newly satisfied. Already-earned badges are never re-awarded
(enforced by the unique_together on UserBadge).
"""
from datetime import date, timedelta

from apps.badges.models import MALADIE_TO_DOMAIN, Badge, StudentDomainScore, UserBadge


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


# ---------------------------------------------------------------------------
# Gamification — domain points
# ---------------------------------------------------------------------------

def award_domain_points(student, attempt) -> None:
    """
    Award gamification points to a student after completing a session.
    Maps the exercise's maladie to a domain and adds points based on score.
    """
    from django.utils import timezone

    domain = MALADIE_TO_DOMAIN.get(attempt.exercise.maladie.lower().strip())
    if domain is None:
        return

    score_pct = attempt.score  # 0.0–1.0
    if score_pct >= 0.90:
        points = 50
    elif score_pct >= 0.70:
        points = 30
    elif score_pct >= 0.50:
        points = 10
    else:
        points = 0

    sds, _ = StudentDomainScore.objects.get_or_create(student=student, domain=domain)
    sds.score += points
    sds.last_session_date = timezone.now()
    sds.save(update_fields=["score", "last_session_date"])


def apply_inactivity_penalty(student) -> None:
    """
    Apply inactivity penalty on student login: -5 pts per day beyond the 7-day
    grace period since the last session, per domain. Never goes below 0.
    Tracks last_penalty_applied_date to avoid double-penalising the same days.
    """
    today = date.today()

    for sds in StudentDomainScore.objects.filter(student=student):
        if sds.last_session_date is None:
            continue

        last_session = sds.last_session_date.date()
        penalty_start = last_session + timedelta(days=7)

        if today <= penalty_start:
            continue  # still within grace period

        # Start penalising from the later of (penalty_start, last_penalty_applied_date)
        penalty_from = (
            max(penalty_start, sds.last_penalty_applied_date)
            if sds.last_penalty_applied_date
            else penalty_start
        )

        new_days = (today - penalty_from).days
        if new_days <= 0:
            continue

        penalty = new_days * 5
        sds.score = max(0, sds.score - penalty)
        sds.last_penalty_applied_date = today
        sds.save(update_fields=["score", "last_penalty_applied_date"])
