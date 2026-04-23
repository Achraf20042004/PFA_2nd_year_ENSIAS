"""
Analytical models stored in the dedicated SQLite database.

These models are routed to the 'analytics' database (see router.py) and are
never mixed with the transactional PostgreSQL data.

ETLLog   — structured log of every step in the dataset ETL pipeline.
ModelMetric — performance metrics recorded per HuggingFace model call.
"""
from django.db import models


class ETLLog(models.Model):
    """One log entry per ETL step execution."""

    class Step(models.TextChoices):
        EXTRACT = "extract", "Extract"
        VALIDATE = "validate", "Validate"
        TRANSFORM = "transform", "Transform"
        LOAD = "load", "Load"

    class Status(models.TextChoices):
        STARTED = "started", "Started"
        SUCCESS = "success", "Success"
        ERROR = "error", "Error"

    pipeline_run_id = models.CharField(max_length=36)   # UUID of the Celery task run
    dataset_id = models.IntegerField()                   # FK-by-value (cross-DB safe)
    step = models.CharField(max_length=20, choices=Step.choices)
    status = models.CharField(max_length=20, choices=Status.choices)
    message = models.TextField(blank=True)
    duration_ms = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "analytics"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["pipeline_run_id"]),
            models.Index(fields=["dataset_id"]),
        ]

    def __str__(self):
        return f"[{self.pipeline_run_id}] {self.step} — {self.status}"


class ModelMetric(models.Model):
    """A single metric observation for a HuggingFace model inference call."""

    maladie = models.CharField(max_length=50)           # e.g. 'pneumonie'
    model_id = models.CharField(max_length=200)          # HF model identifier
    metric_name = models.CharField(max_length=50)        # 'confidence', 'latency_ms', …
    metric_value = models.FloatField()
    image_id = models.IntegerField(null=True, blank=True)  # FK-by-value
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "analytics"
        ordering = ["-recorded_at"]
        indexes = [
            models.Index(fields=["maladie", "metric_name"]),
        ]

    def __str__(self):
        return f"{self.maladie}/{self.metric_name}={self.metric_value}"
