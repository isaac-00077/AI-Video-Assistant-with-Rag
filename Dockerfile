
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/tmp/huggingface
ENV XDG_CACHE_HOME=/tmp/.cache
ENV UV_LINK_MODE=copy

WORKDIR /app

# Install FFmpeg and certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency list first to improve Docker layer caching
COPY requirements.txt .

# Install CPU-only PyTorch
RUN uv pip install --system torch \
    --index-url https://download.pytorch.org/whl/cpu

# Install the remaining project dependencies
RUN uv pip install --system -r requirements.txt

# Copy application code
COPY . .

EXPOSE 7860

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
