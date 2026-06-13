"""
Views for the badges app.
"""
from django.contrib.auth import get_user_model
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.badges.models import Badge, StudentDomainScore, UserBadge
from apps.badges.serializers import (
    BadgeSerializer,
    StudentDomainScoreSerializer,
    StudentGamificationSerializer,
    UserBadgeSerializer,
)

User = get_user_model()


class BadgeListView(APIView):
    """
    GET /api/badges/me/

    Returns all badges for the authenticated student:
    - earned: badges the student has already unlocked (with date)
    - available: badges not yet earned
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        earned_qs = (
            UserBadge.objects.filter(etudiant=request.user)
            .select_related("badge")
            .order_by("date_obtention")
        )
        earned_ids = {ub.badge_id for ub in earned_qs}
        available_qs = Badge.objects.exclude(id__in=earned_ids)

        return Response({
            "earned": UserBadgeSerializer(earned_qs, many=True).data,
            "available": BadgeSerializer(available_qs, many=True).data,
        })


class StudentDomainScoreView(APIView):
    """
    GET /api/badges/domains/

    Returns the authenticated student's gamification scores and badges
    grouped by medical domain.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scores = StudentDomainScore.objects.filter(student=request.user).order_by("domain")
        return Response(StudentDomainScoreSerializer(scores, many=True).data)


class ProfStudentGamificationView(APIView):
    """
    GET /api/badges/students/

    Professor-only. Returns all students with their domain scores, badges,
    and last login date.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role not in ("prof", "admin"):
            raise PermissionDenied("Only professors can access this view.")

        students = User.objects.filter(role="etudiant").order_by("email")
        scores_by_student = {}
        for sds in StudentDomainScore.objects.filter(student__in=students).select_related("student"):
            scores_by_student.setdefault(sds.student_id, []).append(sds)

        data = []
        for student in students:
            data.append({
                "id": student.id,
                "email": student.email,
                "first_name": student.first_name,
                "last_name": student.last_name,
                "last_login": student.last_login,
                "domains": scores_by_student.get(student.id, []),
            })

        return Response(StudentGamificationSerializer(data, many=True).data)
