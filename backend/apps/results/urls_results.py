from django.urls import path

from apps.results.views_stats import ExerciseStatsView, StudentHistoryView

app_name = "results_stats"

urlpatterns = [
    path("me/", StudentHistoryView.as_view(), name="me"),
    path("exercise/<int:pk>/", ExerciseStatsView.as_view(), name="exercise-stats"),
]
