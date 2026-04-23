# ── Stage 1: build dependencies ──────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# System deps for psycopg2-binary, Pillow, opencv-headless, and torch
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --prefix=/install --no-cache-dir -r requirements.txt \
 && pip install --prefix=/install --no-cache-dir gunicorn==23.0.0


# ── Stage 2: runtime image ───────────────────────────────────────────────────
FROM python:3.12-slim

# Non-root user
RUN groupadd --gid 1001 appgroup \
 && useradd  --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

# Runtime system deps only
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        postgresql-client \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

WORKDIR /app

# Copy application code
COPY --chown=appuser:appgroup . .

# Writable dirs for staticfiles, media, analytics DB, and HF model cache.
# Pre-create analytics.db so the named volume is initialised with the file
# already owned by appuser — avoids "unable to open database file" on first run.
RUN mkdir -p /app/staticfiles /app/media /app/ml_cache /app/analytics_db \
 && touch /app/analytics_db/analytics.db \
 && chown -R appuser:appgroup /app/staticfiles /app/media /app/ml_cache /app/analytics_db

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

USER appuser

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
