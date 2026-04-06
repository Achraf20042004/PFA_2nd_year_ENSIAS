"""
Root URL configuration.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/exercises/", include("apps.exercises.urls")),
    path("api/exams/", include("apps.exams.urls")),
    path("api/datasets/", include("apps.datasets.urls")),
    path("api/attempts/", include("apps.results.urls")),
    path("api/results/", include("apps.results.urls_results")),
    path("api/badges/", include("apps.badges.urls")),
    path("api/courses/", include("apps.courses.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
