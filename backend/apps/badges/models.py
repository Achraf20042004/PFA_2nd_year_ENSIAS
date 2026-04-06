from django.db import models
from django.conf import settings


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
