"""
Custom django-allauth adapters for MedTrain.
"""
from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.exceptions import ImmediateHttpResponse
from django.conf import settings
from django.http import JsonResponse

from apps.accounts.services import validate_email_domain


class MedTrainAccountAdapter(DefaultAccountAdapter):
    """Account adapter that enforces email domain restrictions on sign-up."""

    def clean_email(self, email: str) -> str:
        email = super().clean_email(email)
        try:
            validate_email_domain(email)
        except ValueError as exc:
            from django import forms
            raise forms.ValidationError(str(exc))
        return email


class MedTrainSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Social account adapter that:
    - Validates email domain before allowing OAuth sign-in.
    - After successful OAuth login, redirects to a JWT-issuance endpoint
      instead of the default allauth success page.
    """

    def pre_social_login(self, request, sociallogin):
        """
        Called after OAuth provider authenticates the user but before
        Django login. Reject early if email domain is not allowed.
        """
        email = sociallogin.user.email or ""
        if email:
            try:
                validate_email_domain(email)
            except ValueError as exc:
                raise ImmediateHttpResponse(
                    JsonResponse({"detail": str(exc)}, status=403)
                )

    def get_connect_redirect_url(self, request, socialaccount):
        return settings.OAUTH_SUCCESS_REDIRECT_URL

    def get_login_redirect_url(self, request):
        return settings.OAUTH_SUCCESS_REDIRECT_URL
