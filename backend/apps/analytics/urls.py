from django.urls import path

from apps.analytics.views import (
    AdminDashboardView,
    ETLLogsView,
    ModelMetricsView,
    ProfDashboardView,
)

app_name = "analytics"

urlpatterns = [
    path("etl-logs/", ETLLogsView.as_view(), name="etl-logs"),
    path("model-metrics/", ModelMetricsView.as_view(), name="model-metrics"),
    path("dashboard/prof/", ProfDashboardView.as_view(), name="dashboard-prof"),
    path("dashboard/admin/", AdminDashboardView.as_view(), name="dashboard-admin"),
]
