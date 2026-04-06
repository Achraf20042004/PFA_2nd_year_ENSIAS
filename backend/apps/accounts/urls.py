"""
URL patterns for the accounts app.

Auth endpoints:
  POST /api/auth/login/        → email + password → JWT (access + refresh)
  POST /api/auth/refresh/      → refresh token → new access token
  POST /api/auth/register/     → create account → JWT
  GET  /api/auth/me/           → current user profile
  PATCH /api/auth/me/          → update profile

OAuth2 (handled by allauth, callback issues JWT):
  GET  /api/auth/social/       → allauth social routes (Google / Microsoft)
  GET  /api/auth/oauth/token/  → internal callback target → returns JWT JSON
"""
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import (
    CustomTokenObtainPairView,
    MeView,
    OAuthTokenView,
    RegisterView,
)

app_name = "accounts"

urlpatterns = [
    # Classic JWT auth
    path("login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", MeView.as_view(), name="me"),

    # OAuth2 — allauth handles the redirect + callback dance
    # After callback, allauth redirects to /api/auth/oauth/token/ below
    path("social/", include("allauth.urls")),
    path("oauth/token/", OAuthTokenView.as_view(), name="oauth_token"),
]
