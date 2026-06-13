"""
Serializers for the badges app.
"""
from rest_framework import serializers

from apps.badges.models import Badge, StudentDomainScore, UserBadge


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = ["id", "nom", "description", "icone_svg", "condition_type", "condition_seuil"]


class UserBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)

    class Meta:
        model = UserBadge
        fields = ["badge", "date_obtention"]


class StudentDomainScoreSerializer(serializers.ModelSerializer):
    badge = serializers.SerializerMethodField()

    class Meta:
        model = StudentDomainScore
        fields = ["domain", "score", "badge", "last_session_date"]

    def get_badge(self, obj):
        return obj.badge


class StudentGamificationSerializer(serializers.Serializer):
    """Serializer for the professor dashboard — one entry per student."""
    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    last_login = serializers.DateTimeField(allow_null=True)
    domains = StudentDomainScoreSerializer(many=True)
