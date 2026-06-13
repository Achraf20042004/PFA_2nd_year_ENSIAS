from django.urls import re_path

from apps.analytics.consumers import StreamingAnalyticsConsumer

websocket_urlpatterns = [
    re_path(r"^ws/analytics/streaming/$", StreamingAnalyticsConsumer.as_asgi()),
]
