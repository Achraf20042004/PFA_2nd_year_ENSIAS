"""
Serializers for the courses app.
"""
from rest_framework import serializers

from apps.courses.models import Course

ALLOWED_EXTENSIONS = {
    "pdf": Course.Type.PDF,
    "mp4": Course.Type.VIDEO,
    "mov": Course.Type.VIDEO,
    "avi": Course.Type.VIDEO,
    "mkv": Course.Type.VIDEO,
    "webm": Course.Type.VIDEO,
}

MAX_FILE_SIZE_MB = 500


class CourseUploadSerializer(serializers.ModelSerializer):
    """Used for POST /api/courses/ — prof uploads a file."""

    class Meta:
        model = Course
        fields = ["titre", "description", "maladie", "fichier"]

    def validate_fichier(self, value):
        ext = value.name.rsplit(".", 1)[-1].lower() if "." in value.name else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                f"Unsupported file type '.{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}."
            )
        max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
        if value.size > max_bytes:
            raise serializers.ValidationError(
                f"File too large. Maximum size is {MAX_FILE_SIZE_MB} MB."
            )
        return value

    def create(self, validated_data):
        ext = validated_data["fichier"].name.rsplit(".", 1)[-1].lower()
        validated_data["type_fichier"] = ALLOWED_EXTENSIONS[ext]
        return super().create(validated_data)


class CourseSerializer(serializers.ModelSerializer):
    """Read serializer for list and detail views."""

    prof_email = serializers.EmailField(source="prof.email", read_only=True)

    class Meta:
        model = Course
        fields = [
            "id", "titre", "description", "maladie",
            "type_fichier", "fichier", "prof_email", "created_at",
        ]
        read_only_fields = fields
