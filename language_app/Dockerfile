# ---------- Stage 1: build dependencies ----------
FROM python:3.11-slim AS builder

# Install build essentials (needed for some packages like psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    curl \
 && rm -rf /var/lib/apt/lists/*

# Install build tools
RUN pip install --upgrade pip setuptools wheel

# Copy project metadata
WORKDIR /app
COPY pyproject.toml ./
COPY app/ ./app

# Install all deps into a wheelhouse
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /wheels .

# ---------- Stage 2: runtime ----------
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

# Install Python runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libpq5 \
 && rm -rf /var/lib/apt/lists/*

# Copy wheels from builder and install
WORKDIR /app
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/*

# Copy project code
COPY app/ ./app

# Expose FastAPI port
EXPOSE 8000

# Run FastAPI app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
