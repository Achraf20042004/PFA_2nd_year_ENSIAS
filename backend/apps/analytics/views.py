"""
Analytics dashboard views.

Endpoint summary:
  GET /api/analytics/etl-logs/          — admin only
  GET /api/analytics/model-metrics/     — prof or admin
  GET /api/analytics/dashboard/prof/    — prof (own data) or admin (pass ?prof_id=X)
  GET /api/analytics/dashboard/admin/   — admin only
"""
import logging

from rest_framework import permissions, serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.services import (
    get_admin_dashboard,
    get_etl_logs,
    get_model_metrics_summary,
    get_prof_dashboard,
    get_prof_profile_stats,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared permission helpers
# ---------------------------------------------------------------------------


class _IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


class _IsProfOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ("prof", "admin")
        )


# ---------------------------------------------------------------------------
# Inline serializers (read-only, so kept close to views)
# ---------------------------------------------------------------------------


class ETLLogSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    pipeline_run_id = serializers.CharField()
    dataset_id = serializers.IntegerField()
    step = serializers.CharField()
    status = serializers.CharField()
    message = serializers.CharField()
    duration_ms = serializers.IntegerField(allow_null=True)
    created_at = serializers.DateTimeField()


class _ETLLogPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------


class ETLLogsView(APIView):
    """
    GET /api/analytics/etl-logs/

    List ETL pipeline logs. Admin only.

    Query params:
      domain      — filter by dataset maladie (partial match)
      dataset_id  — filter by exact dataset ID
      status      — 'started' | 'success' | 'error'
      step        — 'extract' | 'validate' | 'transform' | 'load'
      date_from   — ISO date string (inclusive lower bound on created_at)
      date_to     — ISO date string (inclusive upper bound on created_at)
      page        — page number (default 1)
      page_size   — items per page (default 50, max 200)
    """

    permission_classes = [permissions.IsAuthenticated, _IsAdmin]

    def get(self, request):
        params = request.query_params

        # Parse optional dataset_id
        raw_ds_id = params.get("dataset_id")
        dataset_id = None
        if raw_ds_id is not None:
            try:
                dataset_id = int(raw_ds_id)
            except ValueError:
                raise ValidationError({"dataset_id": "Must be an integer."})

        qs = get_etl_logs(
            dataset_id=dataset_id,
            domain=params.get("domain"),
            status=params.get("status"),
            step=params.get("step"),
            date_from=params.get("date_from"),
            date_to=params.get("date_to"),
        )

        paginator = _ETLLogPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ETLLogSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class ModelMetricsView(APIView):
    """
    GET /api/analytics/model-metrics/

    Return average confidence and latency per disease domain. Prof or admin.

    Query params:
      domain — comma-separated list of disease keys to include (optional)
    """

    permission_classes = [permissions.IsAuthenticated, _IsProfOrAdmin]

    def get(self, request):
        raw_domain = request.query_params.get("domain", "")
        malades = [d.strip() for d in raw_domain.split(",") if d.strip()] or None

        # Profs can only see metrics for their own disease domains
        if request.user.role == "prof":
            from apps.exercises.models import Exercise

            prof_malades = list(
                Exercise.objects.filter(prof=request.user)
                .values_list("maladie", flat=True)
                .distinct()
            )
            # Normalise to lowercase for matching with analytics DB
            prof_malades_lower = [m.lower() for m in prof_malades]
            if malades:
                malades = [m for m in malades if m.lower() in prof_malades_lower]
            else:
                malades = prof_malades_lower

        data = get_model_metrics_summary(malades=malades if malades else None)
        return Response(data)


class ProfDashboardView(APIView):
    """
    GET /api/analytics/dashboard/prof/

    Per-exercise stats (score, hardest images) and ML confidence trends.

    Access:
      - Prof: sees their own data.
      - Admin: must pass ?prof_id=<id> to view a specific prof's dashboard.
    """

    permission_classes = [permissions.IsAuthenticated, _IsProfOrAdmin]

    def get(self, request):
        from django.contrib.auth import get_user_model

        User = get_user_model()

        if request.user.role == "admin":
            raw_id = request.query_params.get("prof_id")
            if not raw_id:
                raise ValidationError(
                    {"prof_id": "Admin must supply ?prof_id=<id> to view a prof's dashboard."}
                )
            try:
                prof = User.objects.get(pk=int(raw_id), role="prof")
            except (User.DoesNotExist, ValueError):
                raise NotFound("Professor not found.")
        else:
            prof = request.user

        data = get_prof_dashboard(prof)
        return Response(data)


class ProfProfileStatsView(APIView):
    """
    GET /api/analytics/prof/profile-stats/

    Teaching statistics for the professor profile page.
    Returns dataset counts, student/attempt aggregates, most active domain,
    weekly sparkline data, and the 3 most recent datasets.
    """

    permission_classes = [permissions.IsAuthenticated, _IsProfOrAdmin]

    def get(self, request):
        data = get_prof_profile_stats(request.user)
        return Response(data)


class AdminDashboardView(APIView):
    """
    GET /api/analytics/dashboard/admin/

    Global platform statistics. Admin only.
    """

    permission_classes = [permissions.IsAuthenticated, _IsAdmin]

    def get(self, request):
        data = get_admin_dashboard()
        return Response(data)
