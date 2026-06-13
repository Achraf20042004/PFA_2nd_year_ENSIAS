"""
Views for the accounts app.
"""
from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.accounts.serializers import (
    AdminUserSerializer,
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
)
from apps.accounts.services import generate_jwt_for_user

User = get_user_model()


class _IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


class CustomTokenObtainPairView(TokenObtainPairView):
    """POST /api/auth/login/ — returns JWT with role + email claims."""
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            try:
                from apps.badges.services import apply_inactivity_penalty
                user = get_user_model().objects.filter(
                    email=request.data.get("email", "")
                ).first()
                if user and user.role == "etudiant":
                    apply_inactivity_penalty(user)
            except Exception:
                pass
        return response


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


# ---------------------------------------------------------------------------
# Admin — user management
# ---------------------------------------------------------------------------


class UsersListView(APIView):
    """
    GET /api/accounts/users/
    Returns all users (admin only).
    """
    permission_classes = [permissions.IsAuthenticated, _IsAdmin]

    def get(self, request):
        role = request.query_params.get("role")
        qs = User.objects.all().order_by("-date_joined")
        if role:
            qs = qs.filter(role=role)
        serializer = AdminUserSerializer(qs, many=True)
        return Response(serializer.data)


class UserDetailView(APIView):
    """
    GET  /api/accounts/users/<id>/
    PATCH /api/accounts/users/<id>/
    Admin only.
    """
    permission_classes = [permissions.IsAuthenticated, _IsAdmin]

    def _get_user(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            return None

    def get(self, request, pk):
        user = self._get_user(pk)
        if not user:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdminUserSerializer(user).data)

    def patch(self, request, pk):
        user = self._get_user(pk)
        if not user:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AdminUserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ApproveUserView(APIView):
    """POST /api/accounts/users/<id>/approve/ — activate a user account."""
    permission_classes = [permissions.IsAuthenticated, _IsAdmin]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        user.is_active = True
        user.save(update_fields=["is_active"])
        return Response(AdminUserSerializer(user).data)


class DeactivateUserView(APIView):
    """POST /api/accounts/users/<id>/deactivate/ — deactivate a user account."""
    permission_classes = [permissions.IsAuthenticated, _IsAdmin]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if user.role == "admin":
            return Response(
                {"detail": "Cannot deactivate an admin account."},
                status=status.HTTP_403_FORBIDDEN,
            )
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response(AdminUserSerializer(user).data)
