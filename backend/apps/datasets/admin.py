from django.contrib import admin

from apps.datasets.models import Dataset, Image


class ImageInline(admin.TabularInline):
    model = Image
    extra = 0
    readonly_fields = ["chemin", "label"]


@admin.register(Dataset)
class DatasetAdmin(admin.ModelAdmin):
    list_display = ["maladie", "prof", "statut", "nb_images", "created_at"]
    list_filter = ["statut"]
    search_fields = ["maladie", "prof__email"]
    readonly_fields = ["statut", "error_message", "nb_images", "created_at"]
    inlines = [ImageInline]


@admin.register(Image)
class ImageAdmin(admin.ModelAdmin):
    list_display = ["chemin", "label", "dataset"]
    list_filter = ["label"]
