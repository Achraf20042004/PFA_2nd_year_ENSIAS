from django.db import models
from django.conf import settings


class Course(models.Model):
    """A course resource (PDF or video) uploaded by a professor."""

    class Type(models.TextChoices):
        PDF = "pdf", "PDF"
        VIDEO = "video", "Vidéo"

    prof = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="courses"
    )
    titre = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    maladie = models.CharField(max_length=255, blank=True)  # optional tag for filtering
    type_fichier = models.CharField(max_length=10, choices=Type.choices)
    fichier = models.FileField(upload_to="courses/")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.titre
