from django.db import models
from django.conf import settings


class Exercise(models.Model):
    """An exercise or exam created by a professor."""

    class Difficulte(models.TextChoices):
        FACILE = "facile", "Facile"
        MOYEN = "moyen", "Moyen"
        DIFFICILE = "difficile", "Difficile"

    prof = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exercises"
    )
    maladie = models.CharField(max_length=255)
    dataset = models.ForeignKey(
        "datasets.Dataset", on_delete=models.CASCADE, related_name="exercises"
    )
    difficulte = models.CharField(max_length=10, choices=Difficulte.choices, default=Difficulte.MOYEN)
    actif = models.BooleanField(default=True)
    cours = models.ForeignKey(
        "courses.Course", on_delete=models.SET_NULL, null=True, blank=True, related_name="exercises"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.maladie} ({self.difficulte})"


class ExamConfig(models.Model):
    """Configuration for an exercise when used as a formal exam."""

    exercise = models.OneToOneField(Exercise, on_delete=models.CASCADE, related_name="exam_config")
    est_examen = models.BooleanField(default=False)
    max_tentatives = models.IntegerField(null=True, blank=True)  # null = unlimited
    deadline = models.DateTimeField(null=True, blank=True)
    duree_minutes = models.IntegerField(default=60)
    nb_images = models.IntegerField(default=10)

    def __str__(self):
        return f"Config — {self.exercise}"
