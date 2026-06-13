from django.db import migrations, models


def ophtalmologie_to_neurologie(apps, schema_editor):
    StudentDomainScore = apps.get_model("badges", "StudentDomainScore")
    StudentDomainScore.objects.filter(domain="ophtalmologie").update(domain="neurologie")


class Migration(migrations.Migration):

    dependencies = [
        ("badges", "0002_studentdomainscore"),
    ]

    operations = [
        migrations.RunPython(ophtalmologie_to_neurologie, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="studentdomainscore",
            name="domain",
            field=models.CharField(
                choices=[
                    ("radiologie", "Radiologie"),
                    ("dermatologie", "Dermatologie"),
                    ("neurologie", "Neurologie"),
                ],
                max_length=20,
            ),
        ),
    ]
