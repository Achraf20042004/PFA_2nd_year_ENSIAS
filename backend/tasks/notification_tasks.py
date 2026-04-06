"""
Celery tasks for sending notifications.
"""
from config.celery import app


@app.task
def notify_training_complete(prof_id: int, dataset_id: int, success: bool):
    """Notify professor when model training completes."""
    # Email/push notification — implemented alongside notification system
    pass
