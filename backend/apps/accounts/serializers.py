"""
Serializers for the accounts app.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.services import validate_email_domain

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT login serializer that embeds role and email into the token."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["email"] = user.email
        return token


class RegisterSerializer(serializers.ModelSerializer):
    """Handles new user registration with domain validation."""

    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, label="Confirm password")

    class Meta:
        model = User
        fields = ["email", "password", "password2", "role", "etablissement"]
        extra_kwargs = {
            "role": {"default": User.Role.ETUDIANT},
            "etablissement": {"required": False},
        }

    def validate_email(self, value):
        try:
            validate_email_domain(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password2"):
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        email = validated_data["email"]
        user = User(
            email=email,
            username=email,  # username required by AbstractUser, use email
            role=validated_data.get("role", User.Role.ETUDIANT),
            etablissement=validated_data.get("etablissement", ""),
        )
        user.set_password(validated_data["password"])
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    """Read/update serializer for the authenticated user's own profile."""

    class Meta:
        model = User
        fields = ["id", "email", "role", "etablissement", "avatar", "date_joined"]
        read_only_fields = ["id", "email", "role", "date_joined"]
