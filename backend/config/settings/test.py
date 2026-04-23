"""
Test settings — uses in-memory SQLite so no Postgres needed.
"""
from .base import *

DEBUG = True
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
        "ATOMIC_REQUESTS": False,
        "AUTOCOMMIT": True,
        "CONN_MAX_AGE": 0,
        "OPTIONS": {},
        "TIME_ZONE": None,
        "TEST": {"NAME": ":memory:"},
    },
    "analytics": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
        "TEST": {"NAME": ":memory:"},
    },
}
# No real MinIO in tests — boto3 path is skipped when MINIO_ENDPOINT is empty
MINIO_ENDPOINT = ""

# Skip S3/MinIO during tests — use local filesystem
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {"location": "/tmp/medtrain_test_media"},
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
MEDIA_ROOT = "/tmp/medtrain_test_media"
CORS_ALLOW_ALL_ORIGINS = True

# Run Celery tasks synchronously in tests (no broker needed)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
