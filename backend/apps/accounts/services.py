"""
Business logic for the accounts app.
"""
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken


def validate_email_domain(email: str) -> None:
    """
    Raise ValueError if email domain is not in ALLOWED_EMAIL_DOMAINS.
    A empty list means all domains are accepted.
    """
    allowed = getattr(settings, "ALLOWED_EMAIL_DOMAINS", [])
    if not allowed:
        return
    domain = email.split("@")[-1].lower()
    if domain not in [d.lower() for d in allowed]:
        raise ValueError(
            f"Email domain '@{domain}' is not allowed. "
            f"Accepted domains: {', '.join(allowed)}"
        )


def generate_jwt_for_user(user) -> dict:
    """Return a fresh access/refresh JWT pair for the given user."""
    refresh = RefreshToken.for_user(user)
    # Embed role in token payload for convenience
    refresh["role"] = user.role
    refresh["email"] = user.email
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }
