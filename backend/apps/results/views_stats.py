"""
Views for /api/results/ — student history and professor exercise statistics.
"""
from datetime import date, timedelta

from django.db.models import Avg
from rest_framework import permissions
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.exercises.models import Exercise
from apps.results.models import Attempt
from apps.results.serializers import AttemptHistorySerializer
from apps.results.services import get_exercise_stats


class StudentHistoryView(APIView):
    """
    GET /api/results/me/

    Returns the authenticated student's full attempt history with
    aggregate statistics (total attempts, average score, streak, results).
    Field names match the frontend contract: count, average_score, streak, results.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        attempts = (
            Attempt.objects.filter(etudiant=request.user)
            .select_related("exercise")
            .order_by("-date")
        )

        avg_raw = attempts.aggregate(avg=Avg("score"))["avg"]

        # Consecutive-day streak ending today
        attempt_dates = set(attempts.values_list("date__date", flat=True))
        streak = 0
        current = date.today()
        while current in attempt_dates:
            streak += 1
            current -= timedelta(days=1)

        return Response({
            "count": attempts.count(),
            "average_score": round(avg_raw * 100, 1) if avg_raw is not None else None,
            "streak": streak,
            "results": AttemptHistorySerializer(attempts, many=True).data,
        })


class ExerciseStatsView(APIView):
    """
    GET /api/results/exercise/{pk}/

    Returns aggregated statistics for a professor's exercise:
    avg score, score distribution across 5 buckets, most common error images.

    Access: the prof who owns the exercise, or admin.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            exercise = Exercise.objects.get(pk=pk)
        except Exercise.DoesNotExist:
            raise NotFound("Exercise not found.")

        if request.user.role == "etudiant":
            raise PermissionDenied("Students cannot access exercise statistics.")

        if request.user.role == "prof" and exercise.prof != request.user:
            raise PermissionDenied("You do not own this exercise.")

        stats = get_exercise_stats(exercise)
        return Response({"exercise_id": exercise.id, "maladie": exercise.maladie, **stats})
