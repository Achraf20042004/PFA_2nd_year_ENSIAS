"""
Database router for the analytics app.

All models with app_label='analytics' are directed to the dedicated SQLite
'analytics' database. All other apps are forbidden from using that database.
"""


class AnalyticsRouter:
    """Route analytics models exclusively to the 'analytics' SQLite database."""

    APP_LABEL = "analytics"
    DB_ALIAS = "analytics"

    def db_for_read(self, model, **hints):
        if model._meta.app_label == self.APP_LABEL:
            return self.DB_ALIAS
        return None

    def db_for_write(self, model, **hints):
        if model._meta.app_label == self.APP_LABEL:
            return self.DB_ALIAS
        return None

    def allow_relation(self, obj1, obj2, **hints):
        # Allow relations only within the analytics database
        if (
            obj1._meta.app_label == self.APP_LABEL
            or obj2._meta.app_label == self.APP_LABEL
        ):
            return obj1._meta.app_label == obj2._meta.app_label
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == self.APP_LABEL:
            return db == self.DB_ALIAS
        if db == self.DB_ALIAS:
            return False
        return None
