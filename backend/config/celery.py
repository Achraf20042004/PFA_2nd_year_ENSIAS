"""
Celery application configuration.
"""
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("medtrain")
app.config_from_object("django.conf:settings", namespace="CELERY")

# autodiscover_tasks() scans INSTALLED_APPS for a module literally named
# `tasks.py`.  Our task modules are in a top-level `tasks/` package with
# non-standard names (training_tasks.py, notification_tasks.py), so they are
# invisible to autodiscover.  Register them explicitly instead.
app.conf.imports = [
    "tasks.training_tasks",
    "tasks.notification_tasks",
]

app.autodiscover_tasks()
