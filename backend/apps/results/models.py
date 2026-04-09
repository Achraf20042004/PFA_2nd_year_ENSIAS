from django.db import models
from django.conf import settings


class Attempt(models.Model):
    """A student's attempt at an exercise."""

    class Mode(models.TextChoices):
        PRACTICE = "practice", "Pratique libre"
        EXAM = "exam", "Examen"

    etudiant = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attempts"
    )
    exercise = models.ForeignKey(
        "exercises.Exercise", on_delete=models.CASCADE, related_name="attempts"
    )
    score = models.FloatField()
    mode = models.CharField(max_length=10, choices=Mode.choices)
    date = models.DateTimeField(auto_now_add=True)
    duree_reelle = models.IntegerField()  # seconds

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.etudiant} — {self.exercise} — {self.score:.0%}"


class ImageResult(models.Model):
    """Result for a single image within an attempt."""

    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name="image_results")
    image = models.ForeignKey("datasets.Image", on_delete=models.CASCADE)
    reponse_etudiant = models.CharField(max_length=10)
    reponse_modele = models.CharField(max_length=10)   # ML model's prediction (Phase 2)
    ml_prediction = models.CharField(max_length=10, null=True, blank=True)   # same as reponse_modele, explicit
    ml_confidence = models.FloatField(null=True, blank=True)                 # model confidence 0–1
    correct = models.BooleanField()
    gradcam_path = models.CharField(max_length=500, null=True, blank=True)   # S3 path of heatmap overlay

    def __str__(self):
        status = "✓" if self.correct else "✗"
        return f"{status} {self.image}"
