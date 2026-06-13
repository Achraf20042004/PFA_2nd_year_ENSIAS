"""
Serializers for the results app.
"""
from django.conf import settings
from rest_framework import serializers

from apps.exercises.models import Exercise
from apps.results.models import Attempt, ImageResult


# ---------------------------------------------------------------------------
# Submission
# ---------------------------------------------------------------------------

class AnswerSerializer(serializers.Serializer):
    image_id = serializers.IntegerField()
    reponse_etudiant = serializers.ChoiceField(choices=["malade", "sain"])


class SubmitAttemptSerializer(serializers.Serializer):
    exercise = serializers.IntegerField()
    duree_reelle = serializers.IntegerField(min_value=1)
    mode = serializers.ChoiceField(choices=["practice", "exam"])
    answers = AnswerSerializer(many=True)

    def validate_answers(self, value):
        if not value:
            raise serializers.ValidationError("answers must not be empty.")
        ids = [a["image_id"] for a in value]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Duplicate image_id values in answers.")
        return value


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

class ImageResultFeedbackSerializer(serializers.ModelSerializer):
    image_id = serializers.IntegerField(source="image.id")
    chemin = serializers.CharField(source="image.chemin")
    url = serializers.SerializerMethodField()
    label = serializers.CharField(source="image.label")  # ground truth revealed in feedback
    ml_confidence = serializers.FloatField(allow_null=True)
    ml_prediction = serializers.CharField(allow_null=True)

    def get_url(self, obj):
        bucket = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "medtrain")
        public_base = f"{settings.MINIO_PUBLIC_URL}/{bucket}"
        return f"{public_base}/{obj.image.chemin}"

    class Meta:
        model = ImageResult
        fields = [
            "image_id", "chemin", "url", "label",
            "reponse_etudiant", "reponse_modele",
            "ml_prediction", "ml_confidence",
            "correct", "gradcam_path",
        ]


class CourseSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    titre = serializers.CharField()
    type_fichier = serializers.CharField()


class FeedbackSerializer(serializers.Serializer):
    attempt_id = serializers.IntegerField(source="id")
    exercise_id = serializers.IntegerField(source="exercise.id")
    maladie = serializers.CharField(source="exercise.maladie")
    score = serializers.FloatField()
    mode = serializers.CharField()
    date = serializers.DateTimeField()
    duree_reelle = serializers.IntegerField()
    correct_count = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    cours_recommande = serializers.SerializerMethodField()
    image_results = ImageResultFeedbackSerializer(many=True)

    def get_correct_count(self, obj):
        return sum(1 for ir in obj.image_results.all() if ir.correct)

    def get_total(self, obj):
        return obj.image_results.count()

    def get_cours_recommande(self, obj):
        # Only recommend if there were errors and exercise has a linked course
        has_errors = obj.image_results.filter(correct=False).exists()
        if has_errors and obj.exercise.cours_id:
            cours = obj.exercise.cours
            return CourseSummarySerializer(cours).data
        return None


# ---------------------------------------------------------------------------
# History (/results/me/)
# ---------------------------------------------------------------------------

_DOMAIN_LABELS = {
    "pneumonie": "Pneumonie",
    "melanome": "Mélanome",
    "tumeur": "Tumeur cérébrale",
}


class ExerciseMiniSerializer(serializers.ModelSerializer):
    titre = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = ["id", "titre", "maladie", "difficulte"]

    def get_titre(self, obj):
        label = _DOMAIN_LABELS.get(obj.maladie.lower(), obj.maladie.capitalize())
        return f"{label} — {obj.difficulte.capitalize()}"


class AttemptHistorySerializer(serializers.ModelSerializer):
    exercise = ExerciseMiniSerializer(read_only=True)

    class Meta:
        model = Attempt
        fields = ["id", "exercise", "score", "mode", "date", "duree_reelle"]


# ---------------------------------------------------------------------------
# Attempt summary (returned after POST /api/attempts/)
# ---------------------------------------------------------------------------

class AttemptSerializer(serializers.ModelSerializer):
    exercise_id = serializers.IntegerField(source="exercise.id")
    maladie = serializers.CharField(source="exercise.maladie")

    class Meta:
        model = Attempt
        fields = ["id", "exercise_id", "maladie", "score", "mode", "date", "duree_reelle"]
