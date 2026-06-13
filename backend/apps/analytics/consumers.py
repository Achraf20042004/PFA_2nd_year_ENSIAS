"""
WebSocket consumer: streams live platform analytics every 5 seconds.
Only professors and admins may connect.

Connect URL:
    ws://localhost:8000/ws/analytics/streaming/?token=<access_token>
"""
import asyncio
import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

BROADCAST_INTERVAL = 5  # seconds between broadcasts
ANALYTICS_GROUP = "streaming_analytics"

_MALADIE_TO_DOMAIN = {
    "pneumonie": "radiologie",
    "melanome": "dermatologie",
    "tumeur": "neurologie",
    "tumeur cerebrale": "neurologie",
}


# ---------------------------------------------------------------------------
# Stats payload builder  (sync — called via database_sync_to_async)
# ---------------------------------------------------------------------------


def build_stats_payload() -> dict:
    """
    Query PostgreSQL and return the full streaming analytics payload.
    Runs in a thread pool via database_sync_to_async.
    """
    from datetime import timedelta

    from django.db.models import Avg, Count, Q, Sum
    from django.utils import timezone

    from apps.badges.models import StudentDomainScore
    from apps.results.models import Attempt, ImageResult

    now = timezone.now()

    # 1. Active sessions — proxy: attempts started in the last 15 minutes
    active_sessions = Attempt.objects.filter(
        date__gte=now - timedelta(minutes=15)
    ).count()

    # 2. Average score per medical domain (Attempt.score is stored as 0–1 float)
    raw: dict[str, float] = {}
    for row in Attempt.objects.values("exercise__maladie").annotate(avg=Avg("score")):
        maladie = (row["exercise__maladie"] or "").lower()
        domain = _MALADIE_TO_DOMAIN.get(maladie, maladie)
        if row["avg"] is not None:
            raw[domain] = round(row["avg"] * 100, 1)

    avg_score_by_domain = {
        "radiologie":   raw.get("radiologie", 0.0),
        "dermatologie": raw.get("dermatologie", 0.0),
        "neurologie":   raw.get("neurologie", 0.0),
    }

    # 3. Hardest images — top 5 by error rate (min 3 appearances to be meaningful)
    image_rows = list(
        ImageResult.objects
        .values("image_id", "image__chemin", "attempt__exercise__maladie")
        .annotate(total=Count("id"), errors=Count("id", filter=Q(correct=False)))
        .filter(total__gte=3)
        .order_by("-errors")[:20]
    )
    hardest_images = sorted(
        [
            {
                "image_id": r["image_id"],
                "path": r["image__chemin"] or "",
                "error_rate": round(r["errors"] / r["total"], 3) if r["total"] else 0.0,
                "domain": _MALADIE_TO_DOMAIN.get(
                    (r["attempt__exercise__maladie"] or "").lower(), ""
                ),
            }
            for r in image_rows
        ],
        key=lambda x: x["error_rate"],
        reverse=True,
    )[:5]

    # 4. Score distribution — % of attempts per bracket
    total_attempts = Attempt.objects.count()
    if total_attempts:
        brackets = {
            "0-50":   Attempt.objects.filter(score__lt=0.50).count(),
            "50-70":  Attempt.objects.filter(score__gte=0.50, score__lt=0.70).count(),
            "70-90":  Attempt.objects.filter(score__gte=0.70, score__lt=0.90).count(),
            "90-100": Attempt.objects.filter(score__gte=0.90).count(),
        }
        score_distribution = {
            k: round(v / total_attempts * 100) for k, v in brackets.items()
        }
    else:
        score_distribution = {"0-50": 0, "50-70": 0, "70-90": 0, "90-100": 0}

    # 5. Leaderboard — top 10 students by cumulative gamification score
    leaderboard = [
        {
            "username": row["student__username"],
            "total_score": row["total_score"] or 0,
            "rank": idx + 1,
        }
        for idx, row in enumerate(
            StudentDomainScore.objects
            .values("student__username")
            .annotate(total_score=Sum("score"))
            .order_by("-total_score")[:10]
        )
    ]

    return {
        "active_sessions": active_sessions,
        "avg_score_by_domain": avg_score_by_domain,
        "hardest_images": hardest_images,
        "score_distribution": score_distribution,
        "leaderboard": leaderboard,
    }


# ---------------------------------------------------------------------------
# WebSocket consumer
# ---------------------------------------------------------------------------


class StreamingAnalyticsConsumer(AsyncWebsocketConsumer):
    """
    One shared broadcast loop per Daphne process; all connected clients
    receive the same payload via the channel group.
    """

    _broadcast_task: asyncio.Task | None = None
    _client_count: int = 0

    # -- connection lifecycle ------------------------------------------------

    async def connect(self):
        user = self.scope.get("user")
        if (
            not user
            or not user.is_authenticated
            or getattr(user, "role", None) not in ("prof", "admin")
        ):
            await self.close(code=4003)
            return

        try:
            await self.channel_layer.group_add(ANALYTICS_GROUP, self.channel_name)
        except Exception:
            logger.exception("WS connect: channel layer unavailable")
            await self.close(code=4000)
            return

        await self.accept()

        StreamingAnalyticsConsumer._client_count += 1
        if (
            StreamingAnalyticsConsumer._broadcast_task is None
            or StreamingAnalyticsConsumer._broadcast_task.done()
        ):
            StreamingAnalyticsConsumer._broadcast_task = asyncio.ensure_future(
                StreamingAnalyticsConsumer._broadcast_loop()
            )
        logger.debug("WS connect: %s (total=%d)", user, StreamingAnalyticsConsumer._client_count)

    async def disconnect(self, close_code):
        try:
            await self.channel_layer.group_discard(ANALYTICS_GROUP, self.channel_name)
        except Exception:
            logger.warning("WS disconnect: channel layer error (code=%s)", close_code)
        StreamingAnalyticsConsumer._client_count = max(
            0, StreamingAnalyticsConsumer._client_count - 1
        )
        logger.debug("WS disconnect %s (total=%d)", close_code, StreamingAnalyticsConsumer._client_count)

    async def receive(self, text_data=None, bytes_data=None):
        pass  # read-only feed; client → server messages are ignored

    # -- channel layer event handler ----------------------------------------

    async def analytics_update(self, event):
        """Relay a group broadcast to this individual WebSocket client."""
        await self.send(text_data=json.dumps(event["payload"]))

    # -- shared broadcast loop ----------------------------------------------

    @classmethod
    async def _broadcast_loop(cls):
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        logger.info("Streaming analytics broadcast loop started")

        while cls._client_count > 0:
            try:
                payload = await database_sync_to_async(build_stats_payload)()
                await channel_layer.group_send(
                    ANALYTICS_GROUP,
                    {"type": "analytics.update", "payload": payload},
                )
            except Exception:
                logger.exception("Streaming analytics broadcast error")
            await asyncio.sleep(BROADCAST_INTERVAL)

        logger.info("Streaming analytics broadcast loop stopped (no clients)")
