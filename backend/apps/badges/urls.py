from django.urls import path

from apps.badges.views import BadgeListView

app_name = "badges"

urlpatterns = [
    path("me/", BadgeListView.as_view(), name="me"),
]
