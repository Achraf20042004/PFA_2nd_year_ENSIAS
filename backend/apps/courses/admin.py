from django.contrib import admin

from apps.courses.models import Course


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("id", "titre", "maladie", "type_fichier", "prof", "created_at")
    list_filter = ("type_fichier", "maladie")
    search_fields = ("titre", "maladie", "prof__email")
    readonly_fields = ("created_at",)
