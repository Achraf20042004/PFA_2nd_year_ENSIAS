"""
JWT authentication middleware for Django Channels WebSocket connections.

Browser WebSocket API cannot set custom headers, so the JWT access token
is passed as a query parameter: ws://host/ws/.../?token=<access_token>
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        if scope["type"] in ("websocket", "http"):
            params = parse_qs(scope.get("query_string", b"").decode())
            token = (params.get("token") or [None])[0]
            scope["user"] = await _get_user(token)
        return await super().__call__(scope, receive, send)


@database_sync_to_async
def _get_user(token_str):
    if not token_str:
        return AnonymousUser()
    try:
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.tokens import AccessToken

        payload = AccessToken(token_str)
        User = get_user_model()
        return User.objects.get(id=payload["user_id"])
    except Exception:
        return AnonymousUser()


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)
