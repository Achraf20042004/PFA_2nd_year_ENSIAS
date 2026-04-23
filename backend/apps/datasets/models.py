from django.db import models
from django.conf import settings


class Dataset(models.Model):
    """A labeled image dataset uploaded by a professor."""

    class Statut(models.TextChoices):
        UPLOADED = "uploaded", "Uploadé"
        PROCESSING = "processing", "En traitement"
        READY = "ready", "Prêt"
        ERROR = "error", "Erreur"

    prof = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="datasets"
    )
    maladie = models.CharField(max_length=255)
    fichier_zip = models.FileField(upload_to="datasets/")
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.UPLOADED)
    error_message = models.TextField(blank=True)  # populated when statut=error
    nb_images = models.IntegerField(default=0)    # total images extracted
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.maladie} — {self.statut}"


class Image(models.Model):
    """A single medical image within a dataset."""

    class Label(models.TextChoices):
        MALADE = "malade", "Malade"
        SAIN = "sain", "Sain"

    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name="images")
    chemin = models.CharField(max_length=500)  # S3/MinIO path
    label = models.CharField(max_length=10, choices=Label.choices)

    def __str__(self):
        return f"{self.chemin} ({self.label})"
