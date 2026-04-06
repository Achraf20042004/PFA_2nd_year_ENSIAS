"""
Serializers for the datasets app.
"""
from rest_framework import serializers

from apps.datasets.models import Dataset, Image


class ImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Image
        fields = ["id", "chemin", "label"]


class DatasetSerializer(serializers.ModelSerializer):
    """Full dataset representation (read)."""
    prof_email = serializers.EmailField(source="prof.email", read_only=True)

    class Meta:
        model = Dataset
        fields = [
            "id", "maladie", "statut", "error_message",
            "nb_images", "prof_email", "created_at",
        ]
        read_only_fields = fields


class DatasetUploadSerializer(serializers.Serializer):
    """Write serializer for the upload endpoint."""
    maladie = serializers.CharField(max_length=255)
    fichier_zip = serializers.FileField()

    def validate_fichier_zip(self, value):
        # Reject non-zip MIME types early (before the task runs)
        content_type = getattr(value, "content_type", "")
        is_zip_mime = content_type in (
            "application/zip",
            "application/x-zip-compressed",
            "application/octet-stream",
            "multipart/x-zip",
        )
        # Also check the file magic bytes — more reliable than MIME type
        header = value.read(4)
        value.seek(0)
        is_zip_magic = header[:2] == b"PK"

        if not (is_zip_mime or is_zip_magic):
            raise serializers.ValidationError(
                "Only .zip files are accepted."
            )
        return value
