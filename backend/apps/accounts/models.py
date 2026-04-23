from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user model with role-based access."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        PROF = "prof", "Professeur"
        ETUDIANT = "etudiant", "Étudiant"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.ETUDIANT)
    etablissement = models.CharField(max_length=255, blank=True)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return f"{self.email} ({self.role})"

    @property
    def is_prof(self):
        return self.role == self.Role.PROF

    @property
    def is_etudiant(self):
        return self.role == self.Role.ETUDIANT
