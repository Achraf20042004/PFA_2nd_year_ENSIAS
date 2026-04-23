from django.contrib import admin

from apps.results.models import Attempt, ImageResult


class ImageResultInline(admin.TabularInline):
    model = ImageResult
    extra = 0
    readonly_fields = ("image", "reponse_etudiant", "reponse_modele", "correct", "gradcam_path")


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ("id", "etudiant", "exercise", "score", "mode", "date", "duree_reelle")
    list_filter = ("mode", "exercise__maladie")
    search_fields = ("etudiant__email", "exercise__maladie")
    readonly_fields = ("date",)
    inlines = [ImageResultInline]


@admin.register(ImageResult)
class ImageResultAdmin(admin.ModelAdmin):
    list_display = ("id", "attempt", "image", "reponse_etudiant", "reponse_modele", "correct")
    list_filter = ("correct",)
