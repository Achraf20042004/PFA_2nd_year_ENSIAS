from django.contrib import admin

from .models import ETLLog, ModelMetric


@admin.register(ETLLog)
class ETLLogAdmin(admin.ModelAdmin):
    list_display = ("pipeline_run_id", "dataset_id", "step", "status", "duration_ms", "created_at")
    list_filter = ("step", "status")
    search_fields = ("pipeline_run_id",)
    readonly_fields = ("created_at",)

    def get_queryset(self, request):
        return super().get_queryset(request).using("analytics")


@admin.register(ModelMetric)
class ModelMetricAdmin(admin.ModelAdmin):
    list_display = ("maladie", "model_id", "metric_name", "metric_value", "recorded_at")
    list_filter = ("maladie", "metric_name")
    readonly_fields = ("recorded_at",)

    def get_queryset(self, request):
        return super().get_queryset(request).using("analytics")
