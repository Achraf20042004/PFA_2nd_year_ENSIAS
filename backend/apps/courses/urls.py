from django.urls import path

from apps.courses.views import CourseDetailView, CourseListView, CourseUploadView

app_name = "courses"

urlpatterns = [
    path("", CourseListView.as_view(), name="list"),
    path("upload/", CourseUploadView.as_view(), name="upload"),
    path("<int:pk>/", CourseDetailView.as_view(), name="detail"),
]
