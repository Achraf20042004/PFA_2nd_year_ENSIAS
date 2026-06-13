from django.urls import path

from apps.badges.views import BadgeListView, ProfStudentGamificationView, StudentDomainScoreView

app_name = "badges"

urlpatterns = [
    path("me/", BadgeListView.as_view(), name="me"),
    path("domains/", StudentDomainScoreView.as_view(), name="domains"),
    path("students/", ProfStudentGamificationView.as_view(), name="students"),
]
