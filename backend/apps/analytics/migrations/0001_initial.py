import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="ETLLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("pipeline_run_id", models.CharField(max_length=36)),
                ("dataset_id", models.IntegerField()),
                (
                    "step",
                    models.CharField(
                        choices=[
                            ("extract", "Extract"),
                            ("validate", "Validate"),
                            ("transform", "Transform"),
                            ("load", "Load"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("started", "Started"),
                            ("success", "Success"),
                            ("error", "Error"),
                        ],
                        max_length=20,
                    ),
                ),
                ("message", models.TextField(blank=True)),
                ("duration_ms", models.IntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["created_at"],
            },
        ),
        migrations.CreateModel(
            name="ModelMetric",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("maladie", models.CharField(max_length=50)),
                ("model_id", models.CharField(max_length=200)),
                ("metric_name", models.CharField(max_length=50)),
                ("metric_value", models.FloatField()),
                ("image_id", models.IntegerField(blank=True, null=True)),
                ("recorded_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["-recorded_at"],
            },
        ),
        migrations.AddIndex(
            model_name="etllog",
            index=models.Index(
                fields=["pipeline_run_id"], name="analytics_e_pipelin_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="etllog",
            index=models.Index(
                fields=["dataset_id"], name="analytics_e_dataset_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="modelmetric",
            index=models.Index(
                fields=["maladie", "metric_name"], name="analytics_m_maladie_idx"
            ),
        ),
    ]
