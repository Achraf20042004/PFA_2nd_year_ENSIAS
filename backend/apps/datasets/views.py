"""
Views for the datasets app.
"""
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.datasets.models import Dataset
from apps.datasets.serializers import DatasetSerializer, DatasetUploadSerializer


class IsProfOrAdmin(permissions.BasePermission):
    """Allow only professors and admins."""
    message = "Only professors can perform this action."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("prof", "admin")


class DatasetUploadView(APIView):
    """
    POST /api/datasets/upload/

    Accepts a multipart form with:
      - maladie (str)
      - fichier_zip (file)

    Saves the zip to storage, creates a Dataset record, and dispatches
    the processing task asynchronously. Returns 202 Accepted immediately.
    """
    parser_classes = [MultiPartParser]
    permission_classes = [permissions.IsAuthenticated, IsProfOrAdmin]

    def post(self, request):
        serializer = DatasetUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        dataset = Dataset(
            prof=request.user,
            maladie=serializer.validated_data["maladie"],
            fichier_zip=serializer.validated_data["fichier_zip"],
        )
        dataset.save()

        # Delay task dispatch until after the transaction commits so the worker
        # sees the new row when it queries the database.
        from tasks.training_tasks import process_dataset_zip
        transaction.on_commit(lambda: process_dataset_zip.delay(dataset.id))

        return Response(
            DatasetSerializer(dataset).data,
            status=status.HTTP_202_ACCEPTED,
        )


class DatasetStatusView(generics.RetrieveAPIView):
    """
    GET /api/datasets/{id}/status/

    Returns current statut, error_message, and image count.
    Profs can only see their own datasets; admins see all.
    """
    serializer_class = DatasetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return Dataset.objects.all()
        return Dataset.objects.filter(prof=user)

    def get_object(self):
        qs = self.get_queryset()
        try:
            return qs.get(pk=self.kwargs["pk"])
        except Dataset.DoesNotExist:
            # Return 404 for non-existent and 403 for unauthorised uniformly as 404
            # to avoid leaking existence of other profs' datasets to students
            from rest_framework.exceptions import NotFound
            raise NotFound("Dataset not found.")


class DatasetListView(generics.ListAPIView):
    """
    GET /api/datasets/

    Lists datasets owned by the current prof (or all for admins).
    """
    serializer_class = DatasetSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return Dataset.objects.all().order_by("-created_at")
        return Dataset.objects.filter(prof=user).order_by("-created_at")
