from django.urls import path

from apps.datasets.views import DatasetListView, DatasetStatusView, DatasetUploadView

app_name = "datasets"

urlpatterns = [
    path("", DatasetListView.as_view(), name="list"),
    path("upload/", DatasetUploadView.as_view(), name="upload"),
    path("<int:pk>/status/", DatasetStatusView.as_view(), name="status"),
]
