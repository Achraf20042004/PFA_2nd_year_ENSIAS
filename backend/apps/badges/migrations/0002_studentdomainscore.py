import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("badges", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="StudentDomainScore",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("domain", models.CharField(choices=[("radiologie", "Radiologie"), ("dermatologie", "Dermatologie"), ("ophtalmologie", "Ophtalmologie")], max_length=20)),
                ("score", models.IntegerField(default=0)),
                ("last_session_date", models.DateTimeField(blank=True, null=True)),
                ("last_penalty_applied_date", models.DateField(blank=True, null=True)),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="domain_scores",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "unique_together": {("student", "domain")},
            },
        ),
    ]
