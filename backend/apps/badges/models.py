from django.db import models
from django.conf import settings

MALADIE_TO_DOMAIN = {
    "pneumonie": "radiologie",
    "melanome": "dermatologie",
    "tumeur": "neurologie",
    "tumeur cerebrale": "neurologie",
}

BADGE_THRESHOLDS = [
    (1000, "Maître"),
    (500, "Expert"),
    (300, "Diagnosticien"),
    (100, "Praticien"),
    (10, "Débutant"),
]


def get_badge_for_score(score: int) -> str | None:
    """Return the highest badge name the student has earned, or None."""
    for threshold, name in BADGE_THRESHOLDS:
        if score >= threshold:
            return name
    return None


class Badge(models.Model):
    """An achievement badge that students can unlock."""

    class ConditionType(models.TextChoices):
        PREMIER_EXO = "premier_exo", "Premier exercice"
        STREAK = "streak", "Série de jours consécutifs"
        SCORE_PARFAIT = "score_parfait", "Score parfait"
        NB_TENTATIVES = "nb_tentatives", "Nombre de tentatives"
        NB_MALADIES = "nb_maladies", "Nombre de maladies explorées"

    nom = models.CharField(max_length=100)
    description = models.CharField(max_length=255)
    icone_svg = models.TextField()
    condition_type = models.CharField(max_length=30, choices=ConditionType.choices)
    condition_seuil = models.IntegerField(default=1)

    def __str__(self):
        return self.nom


class UserBadge(models.Model):
    """A badge earned by a student."""

    etudiant = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_badges"
    )
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name="user_badges")
    date_obtention = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("etudiant", "badge")

    def __str__(self):
        return f"{self.etudiant} — {self.badge}"


class StudentDomainScore(models.Model):
    """Tracks a student's cumulative gamification score per medical domain."""

    DOMAIN_CHOICES = [
        ("radiologie", "Radiologie"),
        ("dermatologie", "Dermatologie"),
        ("neurologie", "Neurologie"),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="domain_scores"
    )
    domain = models.CharField(max_length=20, choices=DOMAIN_CHOICES)
    score = models.IntegerField(default=0)
    last_session_date = models.DateTimeField(null=True, blank=True)
    last_penalty_applied_date = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ("student", "domain")

    def get_badge(self):
        return get_badge_for_score(self.score)

    @property
    def badge(self) -> str | None:
        return self.get_badge()

    def __str__(self):
        return f"{self.student} — {self.domain} — {self.score}pts"
