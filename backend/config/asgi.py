"""
ASGI entry point for MedTrain AI.

HTTP  → Django ASGI application (same as WSGI)
WS    → StreamingAnalyticsConsumer  (JWT auth via ?token= query param)

Run with:
    daphne -p 8000 config.asgi:application
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

# Initialise Django before importing consumers (AppRegistry must be ready)
_django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

from apps.analytics.middleware import JWTAuthMiddlewareStack  # noqa: E402
from config.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": _django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            JWTAuthMiddlewareStack(
                URLRouter(websocket_urlpatterns)
            )
        ),
    }
)
