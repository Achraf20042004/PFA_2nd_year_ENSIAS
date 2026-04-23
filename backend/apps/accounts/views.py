"""
Views for the accounts app.
"""
from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.accounts.serializers import (
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
)
from apps.accounts.services import generate_jwt_for_user

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """POST /api/auth/login/ — returns JWT with role + email claims."""
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/ — creates a new user account."""
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = generate_jwt_for_user(user)
        return Response(
            {"user": UserSerializer(user).data, **tokens},
            status=status.HTTP_201_CREATED,
        )


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/auth/me/ — retrieve or update the current user's profile."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class OAuthTokenView(APIView):
    """
    GET /api/auth/oauth/token/

    Internal redirect target after a successful OAuth2 login via allauth.
    The user is already authenticated in the Django session at this point.
    Issues JWT tokens and returns them as JSON.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response(
                {"detail": "OAuth login did not complete successfully."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        tokens = generate_jwt_for_user(user)
        return Response({"user": UserSerializer(user).data, **tokens})
