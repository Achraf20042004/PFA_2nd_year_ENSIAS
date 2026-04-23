"""
Base settings shared across all environments.
"""
from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

# Base directory is backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# Application definition
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.microsoft",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.courses",
    "apps.exercises",
    "apps.exams",
    "apps.datasets",
    "apps.ai_models",
    "apps.results",
    "apps.badges",
    "apps.analytics",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "medtrain"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    },
    # Analytical database — SQLite, separate from transactional PostgreSQL
    "analytics": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / os.getenv("ANALYTICS_DB_NAME", "analytics.db"),
    },
}

DATABASE_ROUTERS = ["apps.analytics.router.AnalyticsRouter"]

# HuggingFace model cache directory (relative to backend root by default)
ML_CACHE_DIR = os.getenv("ML_CACHE_DIR", str(BASE_DIR / "ml_cache"))

# Custom user model
AUTH_USER_MODEL = "accounts.User"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static & media files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.getenv("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", 60))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.getenv("JWT_REFRESH_TOKEN_LIFETIME_DAYS", 7))
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# django-allauth
SITE_ID = 1
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = "none"
SOCIALACCOUNT_ADAPTER = "apps.accounts.adapters.MedTrainSocialAccountAdapter"
ACCOUNT_ADAPTER = "apps.accounts.adapters.MedTrainAccountAdapter"

# After OAuth2 success, redirect here (configurable per environment)
OAUTH_SUCCESS_REDIRECT_URL = os.getenv("OAUTH_SUCCESS_REDIRECT_URL", "/api/auth/oauth/token/")

SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
            "secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        },
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
    },
    "microsoft": {
        "APP": {
            "client_id": os.getenv("MICROSOFT_CLIENT_ID", ""),
            "secret": os.getenv("MICROSOFT_CLIENT_SECRET", ""),
        },
    },
}

# Allowed email domains (empty = all domains allowed)
ALLOWED_EMAIL_DOMAINS = [
    d.strip()
    for d in os.getenv("ALLOWED_EMAIL_DOMAINS", "").split(",")
    if d.strip()
]

# Celery
CELERY_BROKER_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# Storage backend (minio or s3)
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "minio")

if STORAGE_BACKEND == "s3":
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_S3_BUCKET", "medtrain")
    AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION", "us-east-1")
    AWS_DEFAULT_ACL = "private"
else:
    # MinIO via boto3-compatible interface
    AWS_ACCESS_KEY_ID = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    AWS_SECRET_ACCESS_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    AWS_STORAGE_BUCKET_NAME = os.getenv("MINIO_BUCKET", "medtrain")
    AWS_S3_ENDPOINT_URL = f"http://{os.getenv('MINIO_ENDPOINT', 'localhost:9000')}"
    AWS_DEFAULT_ACL = "public-read"
    AWS_QUERYSTRING_AUTH = False
    AWS_S3_VERIFY = False

# Django 4.2+ requires STORAGES dict; DEFAULT_FILE_STORAGE is ignored in Django 5+
STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

MINIO_PUBLIC_URL = os.getenv("MINIO_PUBLIC_URL", "http://localhost:9000")

# Exposed as top-level settings so tasks can use settings.MINIO_* directly
MINIO_ENDPOINT   = os.getenv("MINIO_ENDPOINT",   "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY",  "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY",  "minioadmin")
MINIO_BUCKET     = os.getenv("MINIO_BUCKET",      "medtrain")

# MLflow
MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
MODEL_ACCURACY_THRESHOLD = float(os.getenv("MODEL_ACCURACY_THRESHOLD", 0.80))
