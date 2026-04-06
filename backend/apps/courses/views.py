"""
Views for the courses app.
"""
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.courses.models import Course
from apps.courses.serializers import CourseSerializer, CourseUploadSerializer


class IsProfOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("prof", "admin")


class CourseUploadView(APIView):
    """
    POST /api/courses/

    Prof uploads a course resource (PDF or video). The file type is determined
    automatically from the file extension.
    """
    permission_classes = [IsProfOrAdmin]

    def post(self, request):
        serializer = CourseUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course = serializer.save(prof=request.user)
        return Response(CourseSerializer(course).data, status=status.HTTP_201_CREATED)


class CourseListView(APIView):
    """
    GET /api/courses/

    Returns the list of courses. Supports optional ?maladie= query parameter
    to filter by disease tag. All authenticated users can access this.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = Course.objects.select_related("prof")
        maladie = request.query_params.get("maladie", "").strip()
        if maladie:
            qs = qs.filter(maladie__iexact=maladie)
        return Response(CourseSerializer(qs, many=True).data)


class CourseDetailView(APIView):
    """
    GET /api/courses/{pk}/

    Returns full detail for a single course. All authenticated users can access.

    DELETE /api/courses/{pk}/

    Profs can delete their own courses; admins can delete any.
    """
    permission_classes = [permissions.IsAuthenticated]

    def _get_course(self, pk):
        try:
            return Course.objects.select_related("prof").get(pk=pk)
        except Course.DoesNotExist:
            raise NotFound("Course not found.")

    def get(self, request, pk):
        return Response(CourseSerializer(self._get_course(pk)).data)

    def delete(self, request, pk):
        course = self._get_course(pk)
        if request.user.role == "etudiant":
            raise PermissionDenied("Students cannot delete courses.")
        if request.user.role == "prof" and course.prof != request.user:
            raise PermissionDenied("You do not own this course.")
        course.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
