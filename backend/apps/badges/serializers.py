"""
Serializers for the badges app.
"""
from rest_framework import serializers

from apps.badges.models import Badge, UserBadge


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = ["id", "nom", "description", "icone_svg", "condition_type", "condition_seuil"]


class UserBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)

    class Meta:
        model = UserBadge
        fields = ["badge", "date_obtention"]
