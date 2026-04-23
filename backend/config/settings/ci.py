"""
CI settings — identical to test.py but uses the PostgreSQL service container
spun up by GitHub Actions instead of SQLite.
"""
import os

from .test import *  # noqa: F401, F403 — intentional wildcard

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "medtrain_ci"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", "postgres"),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
        "ATOMIC_REQUESTS": False,
        "AUTOCOMMIT": True,
        "CONN_MAX_AGE": 0,
        "OPTIONS": {},
        "TIME_ZONE": None,
        "TEST": {"NAME": "test_medtrain_ci"},
    },
    # Analytics DB stays SQLite in CI (in-memory)
    "analytics": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
        "TEST": {"NAME": ":memory:"},
    },
}
