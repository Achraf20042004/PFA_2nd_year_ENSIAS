"""
Tests for the accounts app.

Coverage:
- User model creation and role properties
- POST /api/auth/register/ (success, duplicate email, bad domain, password mismatch)
- POST /api/auth/login/ (success, wrong password, inactive user)
- POST /api/auth/refresh/ (success, invalid token)
- GET  /api/auth/me/ (authenticated, unauthenticated)
- PATCH /api/auth/me/ (update etablissement)
- Email domain validation service
"""
import base64
import json as _json

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.services import generate_jwt_for_user, validate_email_domain

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def student_user(db):
    user = User(
        email="student@example.com",
        username="student@example.com",
        role=User.Role.ETUDIANT,
    )
    user.set_password("StrongPass123!")
    user.save()
    return user


@pytest.fixture
def prof_user(db):
    user = User(
        email="prof@example.com",
        username="prof@example.com",
        role=User.Role.PROF,
    )
    user.set_password("StrongPass123!")
    user.save()
    return user


@pytest.fixture
def auth_client(api_client, student_user):
    tokens = generate_jwt_for_user(student_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    return api_client


# ---------------------------------------------------------------------------
# User model
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestUserModel:
    def test_str(self, student_user):
        assert "student@example.com" in str(student_user)
        assert "etudiant" in str(student_user)

    def test_is_etudiant(self, student_user):
        assert student_user.is_etudiant is True
        assert student_user.is_prof is False

    def test_is_prof(self, prof_user):
        assert prof_user.is_prof is True
        assert prof_user.is_etudiant is False

    def test_username_field_is_email(self):
        assert User.USERNAME_FIELD == "email"

    def test_default_role_is_etudiant(self, db):
        user = User(email="new@example.com", username="new@example.com")
        user.set_password("pass")
        user.save()
        assert user.role == User.Role.ETUDIANT


# ---------------------------------------------------------------------------
# Email domain validation service
# ---------------------------------------------------------------------------


class TestValidateEmailDomain:
    @override_settings(ALLOWED_EMAIL_DOMAINS=[])
    def test_empty_list_allows_all(self):
        validate_email_domain("any@whatever.io")  # must not raise

    @override_settings(ALLOWED_EMAIL_DOMAINS=["ensias.ma"])
    def test_allowed_domain_passes(self):
        validate_email_domain("student@ensias.ma")  # must not raise

    @override_settings(ALLOWED_EMAIL_DOMAINS=["ensias.ma"])
    def test_disallowed_domain_raises(self):
        with pytest.raises(ValueError, match="not allowed"):
            validate_email_domain("student@gmail.com")

    @override_settings(ALLOWED_EMAIL_DOMAINS=["ENSIAS.MA"])
    def test_domain_check_is_case_insensitive(self):
        validate_email_domain("student@ensias.ma")  # must not raise


# ---------------------------------------------------------------------------
# Register endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestRegisterView:
    url = "/api/auth/register/"

    def test_register_success(self, api_client):
        payload = {
            "email": "new@example.com",
            "password": "StrongPass123!",
            "password2": "StrongPass123!",
        }
        response = api_client.post(self.url, payload)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "access" in data
        assert "refresh" in data
        assert data["user"]["email"] == "new@example.com"
        assert data["user"]["role"] == User.Role.ETUDIANT

    def test_register_default_role_is_etudiant(self, api_client):
        payload = {
            "email": "another@example.com",
            "password": "StrongPass123!",
            "password2": "StrongPass123!",
        }
        response = api_client.post(self.url, payload)
        assert response.json()["user"]["role"] == "etudiant"

    def test_register_with_etablissement(self, api_client):
        payload = {
            "email": "s@example.com",
            "password": "StrongPass123!",
            "password2": "StrongPass123!",
            "etablissement": "ENSIAS",
        }
        response = api_client.post(self.url, payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["user"]["etablissement"] == "ENSIAS"

    def test_register_duplicate_email(self, api_client, student_user):
        payload = {
            "email": student_user.email,
            "password": "StrongPass123!",
            "password2": "StrongPass123!",
        }
        response = api_client.post(self.url, payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_password_mismatch(self, api_client):
        payload = {
            "email": "x@example.com",
            "password": "StrongPass123!",
            "password2": "DifferentPass!",
        }
        response = api_client.post(self.url, payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password" in response.json()

    def test_register_weak_password(self, api_client):
        payload = {
            "email": "x@example.com",
            "password": "123",
            "password2": "123",
        }
        response = api_client.post(self.url, payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @override_settings(ALLOWED_EMAIL_DOMAINS=["ensias.ma"])
    def test_register_blocked_domain(self, api_client):
        payload = {
            "email": "s@gmail.com",
            "password": "StrongPass123!",
            "password2": "StrongPass123!",
        }
        response = api_client.post(self.url, payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "not allowed" in str(response.json()).lower()

    @override_settings(ALLOWED_EMAIL_DOMAINS=["ensias.ma"])
    def test_register_allowed_domain(self, api_client):
        payload = {
            "email": "s@ensias.ma",
            "password": "StrongPass123!",
            "password2": "StrongPass123!",
        }
        response = api_client.post(self.url, payload)
        assert response.status_code == status.HTTP_201_CREATED


# ---------------------------------------------------------------------------
# Login endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestLoginView:
    url = "/api/auth/login/"

    def test_login_success(self, api_client, student_user):
        response = api_client.post(
            self.url, {"email": student_user.email, "password": "StrongPass123!"}
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access" in data
        assert "refresh" in data

    def test_login_contains_role_claim(self, api_client, student_user):
        response = api_client.post(
            self.url, {"email": student_user.email, "password": "StrongPass123!"}
        )
        access = response.json()["access"]
        payload_b64 = access.split(".")[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = _json.loads(base64.b64decode(payload_b64))
        assert payload["role"] == student_user.role
        assert payload["email"] == student_user.email

    def test_login_wrong_password(self, api_client, student_user):
        response = api_client.post(
            self.url, {"email": student_user.email, "password": "wrongpassword"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_nonexistent_email(self, api_client):
        response = api_client.post(
            self.url, {"email": "nobody@example.com", "password": "pass"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_inactive_user(self, api_client, student_user):
        student_user.is_active = False
        student_user.save()
        response = api_client.post(
            self.url, {"email": student_user.email, "password": "StrongPass123!"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# Token refresh endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestTokenRefreshView:
    url = "/api/auth/refresh/"

    def test_refresh_success(self, api_client, student_user):
        tokens = generate_jwt_for_user(student_user)
        response = api_client.post(self.url, {"refresh": tokens["refresh"]})
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.json()

    def test_refresh_invalid_token(self, api_client):
        response = api_client.post(self.url, {"refresh": "not.a.valid.token"})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_refresh_missing_token(self, api_client):
        response = api_client.post(self.url, {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ---------------------------------------------------------------------------
# /me endpoint
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestMeView:
    url = "/api/auth/me/"

    def test_me_authenticated(self, auth_client, student_user):
        response = auth_client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == student_user.email
        assert data["role"] == student_user.role

    def test_me_unauthenticated(self, api_client):
        response = api_client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_patch_etablissement(self, auth_client):
        response = auth_client.patch(self.url, {"etablissement": "ENSIAS"})
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["etablissement"] == "ENSIAS"

    def test_me_cannot_change_role(self, auth_client, student_user):
        auth_client.patch(self.url, {"role": User.Role.ADMIN})
        student_user.refresh_from_db()
        assert student_user.role == User.Role.ETUDIANT

    def test_me_cannot_change_email(self, auth_client, student_user):
        auth_client.patch(self.url, {"email": "hacker@example.com"})
        student_user.refresh_from_db()
        assert student_user.email == "student@example.com"
