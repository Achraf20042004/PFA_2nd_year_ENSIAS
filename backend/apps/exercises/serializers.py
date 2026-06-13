"""
Serializers for the exercises app.
"""
from django.utils import timezone
from rest_framework import serializers

from apps.exercises.models import ExamConfig, Exercise


class ExamConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamConfig
        fields = [
            "id", "est_examen", "max_tentatives",
            "deadline", "duree_minutes", "nb_images",
        ]

    def validate_deadline(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError("Deadline must be in the future.")
        return value

    def validate_nb_images(self, value):
        if value < 2:
            raise serializers.ValidationError("nb_images must be at least 2.")
        if value % 2 != 0:
            raise serializers.ValidationError(
                "nb_images must be even to maintain a 50/50 malade/sain balance."
            )
        return value


DOMAIN_LABELS = {
    "pneumonie": "Pneumonie",
    "melanome": "Mélanome",
    "tumeur": "Tumeur cérébrale",
}


class ExerciseSerializer(serializers.ModelSerializer):
    """Full representation (read + write for profs)."""
    prof_email = serializers.EmailField(source="prof.email", read_only=True)
    exam_config = ExamConfigSerializer(read_only=True)
    titre = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = [
            "id", "titre", "maladie", "dataset", "difficulte", "actif",
            "cours", "prof_email", "exam_config", "created_at",
        ]
        read_only_fields = ["id", "titre", "prof_email", "exam_config", "created_at"]

    def get_titre(self, obj):
        label = DOMAIN_LABELS.get(obj.maladie.lower(), obj.maladie.capitalize())
        return f"{label} — {obj.difficulte.capitalize()}"

    def validate_dataset(self, dataset):
        request = self.context.get("request")
        if request and request.user.role == "prof":
            if dataset.prof != request.user:
                raise serializers.ValidationError(
                    "You can only use datasets you own."
                )
        if dataset.statut != "ready":
            raise serializers.ValidationError(
                "Dataset must be in 'ready' state before creating an exercise."
            )
        return dataset


class ExerciseListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    prof_email = serializers.EmailField(source="prof.email", read_only=True)
    has_exam_config = serializers.SerializerMethodField()
    titre = serializers.SerializerMethodField()
    exam_config = ExamConfigSerializer(read_only=True)

    class Meta:
        model = Exercise
        fields = [
            "id", "titre", "maladie", "difficulte", "actif",
            "prof_email", "has_exam_config", "exam_config", "created_at",
        ]

    def get_titre(self, obj):
        label = DOMAIN_LABELS.get(obj.maladie.lower(), obj.maladie.capitalize())
        return f"{label} — {obj.difficulte.capitalize()}"

    def get_has_exam_config(self, obj):
        try:
            return obj.exam_config is not None
        except ExamConfig.DoesNotExist:
            return False


class SessionImageSerializer(serializers.Serializer):
    """Image representation in a session — no label exposed."""
    id = serializers.IntegerField()
    chemin = serializers.CharField()
    url = serializers.CharField()


class ExerciseSessionSerializer(serializers.Serializer):
    """Response payload for the /start/ endpoint."""
    exercise_id = serializers.IntegerField()
    mode = serializers.CharField()
    duree_minutes = serializers.IntegerField()
    nb_images = serializers.IntegerField()
    images = SessionImageSerializer(many=True)
