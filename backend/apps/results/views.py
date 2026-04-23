"""
Views for the results app — attempt submission and feedback.
"""
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.exercises.models import Exercise
from apps.exercises.services import ExerciseStartError, check_exam_access
from apps.results.models import Attempt
from apps.results.serializers import AttemptSerializer, FeedbackSerializer, SubmitAttemptSerializer
from apps.results.services import SubmissionError, submit_attempt


class SubmitAttemptView(APIView):
    """
    POST /api/attempts/

    Student submits their answers for a session. Calculates score, persists
    Attempt + ImageResult records, triggers badge evaluation.

    Request body:
        {
          "exercise": <id>,
          "duree_reelle": <seconds>,
          "mode": "practice" | "exam",
          "answers": [{"image_id": <id>, "reponse_etudiant": "malade"|"sain"}, ...]
        }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = SubmitAttemptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            exercise = Exercise.objects.select_related("dataset", "exam_config").get(
                pk=data["exercise"]
            )
        except Exercise.DoesNotExist:
            raise NotFound("Exercise not found.")

        if request.user.role == "etudiant" and not exercise.actif:
            raise NotFound("Exercise not found.")

        # Enforce exam rules (deadline, max attempts)
        try:
            check_exam_access(request.user, exercise)
        except ExerciseStartError as exc:
            raise PermissionDenied(str(exc))

        try:
            attempt = submit_attempt(
                student=request.user,
                exercise=exercise,
                answers=data["answers"],
                duree_reelle=data["duree_reelle"],
                mode=data["mode"],
            )
        except SubmissionError as exc:
            raise ValidationError({"detail": str(exc)})

        return Response(AttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)


class FeedbackView(APIView):
    """
    GET /api/attempts/{pk}/feedback/

    Returns full scored feedback for one attempt, including:
    - Per-image breakdown with ground-truth label revealed
    - Course recommendation if there were errors and exercise has a linked course
    - gradcam_path (null in Phase 1)

    Access: the student who made the attempt OR the prof who owns the exercise.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            attempt = (
                Attempt.objects.select_related(
                    "etudiant", "exercise", "exercise__cours"
                )
                .prefetch_related("image_results__image")
                .get(pk=pk)
            )
        except Attempt.DoesNotExist:
            raise NotFound("Attempt not found.")

        user = request.user
        is_owner = attempt.etudiant == user
        is_exercise_prof = attempt.exercise.prof == user
        is_admin = user.role == "admin"

        if not (is_owner or is_exercise_prof or is_admin):
            raise PermissionDenied("You do not have access to this attempt.")

        return Response(FeedbackSerializer(attempt).data)
