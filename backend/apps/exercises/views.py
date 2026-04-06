"""
Views for the exercises app.
"""
from rest_framework import generics, permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.exercises.models import ExamConfig, Exercise
from apps.exercises.serializers import (
    ExamConfigSerializer,
    ExerciseListSerializer,
    ExerciseSerializer,
    ExerciseSessionSerializer,
)
from apps.exercises.services import ExerciseStartError, check_exam_access, get_exercise_images


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------

class IsProfOrAdmin(permissions.BasePermission):
    message = "Only professors can perform this action."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("prof", "admin")


class IsExerciseOwnerOrAdmin(permissions.BasePermission):
    message = "You do not own this exercise."

    def has_object_permission(self, request, view, obj):
        return request.user.role == "admin" or obj.prof == request.user


# ---------------------------------------------------------------------------
# Exercise CRUD
# ---------------------------------------------------------------------------

class ExerciseListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ExerciseSerializer
        return ExerciseListSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return Exercise.objects.select_related("prof", "exam_config").all()
        if user.role == "prof":
            return Exercise.objects.select_related("prof", "exam_config").filter(prof=user)
        return Exercise.objects.select_related("prof", "exam_config").filter(actif=True)

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated(), IsProfOrAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(prof=self.request.user)


class ExerciseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExerciseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ("prof", "admin"):
            return Exercise.objects.all()
        return Exercise.objects.filter(actif=True)

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT", "DELETE"):
            return [permissions.IsAuthenticated(), IsExerciseOwnerOrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_object(self):
        try:
            obj = self.get_queryset().get(pk=self.kwargs["pk"])
        except Exercise.DoesNotExist:
            raise NotFound("Exercise not found.")
        self.check_object_permissions(self.request, obj)
        return obj


# ---------------------------------------------------------------------------
# Start session
# ---------------------------------------------------------------------------

class ExerciseStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            exercise = Exercise.objects.select_related(
                "dataset", "exam_config"
            ).get(pk=pk)
        except Exercise.DoesNotExist:
            raise NotFound("Exercise not found.")

        if request.user.role == "etudiant" and not exercise.actif:
            raise NotFound("Exercise not found.")

        try:
            check_exam_access(request.user, exercise)
        except ExerciseStartError as exc:
            raise PermissionDenied(str(exc))

        try:
            cfg = exercise.exam_config
            mode = "exam" if cfg.est_examen else "practice"
            nb_images = cfg.nb_images
            duree_minutes = cfg.duree_minutes
        except Exercise.exam_config.RelatedObjectDoesNotExist:
            mode = "practice"
            nb_images = 10
            duree_minutes = 60

        images = get_exercise_images(request.user, exercise, n=nb_images)
        payload = {
            "exercise_id": exercise.id,
            "mode": mode,
            "duree_minutes": duree_minutes,
            "nb_images": len(images),
            "images": [{"id": img.id, "chemin": img.chemin} for img in images],
        }
        return Response(ExerciseSessionSerializer(payload).data)


# ---------------------------------------------------------------------------
# ExamConfig
# ---------------------------------------------------------------------------

class ExamConfigView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsProfOrAdmin]

    def _get_exercise(self, request, pk):
        try:
            exercise = Exercise.objects.get(pk=pk)
        except Exercise.DoesNotExist:
            raise NotFound("Exercise not found.")
        if request.user.role != "admin" and exercise.prof != request.user:
            raise PermissionDenied("You do not own this exercise.")
        return exercise

    def get(self, request, pk):
        exercise = self._get_exercise(request, pk)
        try:
            cfg = exercise.exam_config
        except ExamConfig.DoesNotExist:
            raise NotFound("No exam config for this exercise.")
        return Response(ExamConfigSerializer(cfg).data)

    def post(self, request, pk):
        exercise = self._get_exercise(request, pk)
        if ExamConfig.objects.filter(exercise=exercise).exists():
            raise ValidationError({"detail": "Exam config already exists. Use PATCH to update."})
        serializer = ExamConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(exercise=exercise)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def patch(self, request, pk):
        exercise = self._get_exercise(request, pk)
        try:
            cfg = exercise.exam_config
        except ExamConfig.DoesNotExist:
            raise NotFound("No exam config for this exercise. Use POST to create one.")
        serializer = ExamConfigSerializer(cfg, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        exercise = self._get_exercise(request, pk)
        try:
            exercise.exam_config.delete()
        except ExamConfig.DoesNotExist:
            raise NotFound("No exam config for this exercise.")
        return Response(status=status.HTTP_204_NO_CONTENT)
