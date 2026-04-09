from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("results", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="imageresult",
            name="ml_prediction",
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name="imageresult",
            name="ml_confidence",
            field=models.FloatField(blank=True, null=True),
        ),
    ]
