from django.db import models


class DiseaseModel(models.Model):
    """A trained AI model for a specific disease."""

    maladie = models.CharField(max_length=255)
    version = models.IntegerField(default=1)
    chemin_fichier = models.CharField(max_length=500)  # S3 path to .pth file
    accuracy = models.FloatField()
    mlflow_run_id = models.CharField(max_length=255, blank=True)
    actif = models.BooleanField(default=False)
    date_entrainement = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version"]

    def __str__(self):
        return f"{self.maladie} v{self.version} ({'actif' if self.actif else 'inactif'})"
