"""
Views for the badges app.
"""
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.badges.models import Badge, UserBadge
from apps.badges.serializers import BadgeSerializer, UserBadgeSerializer


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
