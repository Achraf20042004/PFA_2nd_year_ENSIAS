"""
Admin-only user management endpoints.

  GET   /api/accounts/users/              — list all users
  GET   /api/accounts/users/<id>/         — get one user
  PATCH /api/accounts/users/<id>/         — update user (role, etablissement, …)
  POST  /api/accounts/users/<id>/approve/     — activate account
  POST  /api/accounts/users/<id>/deactivate/  — deactivate account
"""
from django.urls import path

from apps.accounts.views import (
    ApproveUserView,
    DeactivateUserView,
    UserDetailView,
    UsersListView,
)

urlpatterns = [
    path("users/",                          UsersListView.as_view(),    name="users-list"),
    path("users/<int:pk>/",                 UserDetailView.as_view(),   name="users-detail"),
    path("users/<int:pk>/approve/",         ApproveUserView.as_view(),  name="users-approve"),
    path("users/<int:pk>/deactivate/",      DeactivateUserView.as_view(), name="users-deactivate"),
]
