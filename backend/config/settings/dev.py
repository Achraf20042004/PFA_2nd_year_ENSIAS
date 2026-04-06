"""
Development settings — debug on, relaxed security, local services.
"""
from .base import *

DEBUG = True

# Allow all origins in dev
CORS_ALLOW_ALL_ORIGINS = True

# Use console email backend in dev
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Disable SSL requirement in dev
SECURE_SSL_REDIRECT = False

# Simpler logging in dev
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {
        "handlers": ["console"],
        "level": "DEBUG",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "celery": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}
