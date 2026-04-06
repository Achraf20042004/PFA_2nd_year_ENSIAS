from django.contrib import admin

from apps.exercises.models import ExamConfig, Exercise


class ExamConfigInline(admin.StackedInline):
    model = ExamConfig
    extra = 0


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ["maladie", "prof", "difficulte", "actif", "created_at"]
    list_filter = ["difficulte", "actif"]
    search_fields = ["maladie", "prof__email"]
    inlines = [ExamConfigInline]


@admin.register(ExamConfig)
class ExamConfigAdmin(admin.ModelAdmin):
    list_display = ["exercise", "est_examen", "max_tentatives", "deadline", "nb_images"]
    list_filter = ["est_examen"]
