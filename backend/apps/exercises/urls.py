from django.urls import path

from apps.exercises.views import (
    ExamConfigView,
    ExerciseDetailView,
    ExerciseListCreateView,
    ExerciseStartView,
)

app_name = "exercises"

urlpatterns = [
    path("", ExerciseListCreateView.as_view(), name="list-create"),
    path("<int:pk>/", ExerciseDetailView.as_view(), name="detail"),
    path("<int:pk>/start/", ExerciseStartView.as_view(), name="start"),
    path("<int:pk>/exam-config/", ExamConfigView.as_view(), name="exam-config"),
]
