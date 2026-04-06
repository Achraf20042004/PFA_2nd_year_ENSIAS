from django.urls import path

from apps.results.views import FeedbackView, SubmitAttemptView

app_name = "results"

urlpatterns = [
    path("", SubmitAttemptView.as_view(), name="submit"),
    path("<int:pk>/feedback/", FeedbackView.as_view(), name="feedback"),
]
