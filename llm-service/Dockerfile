FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Install minimal dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python packages (без llama-cpp-python)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    fastapi==0.109.0 \
    uvicorn[standard]==0.27.0 \
    pydantic==2.5.3 \
    transformers>=4.36.0 \
    torch>=2.1.0 \
    accelerate>=0.25.0 \
    bitsandbytes>=0.41.0 \
    numpy>=1.24.0 \
    python-multipart==0.0.6 \
    aiofiles==23.2.1 \
    huggingface-hub>=0.19.0

# Copy application
COPY src/ ./src/
COPY scripts/ ./scripts/

# Create directories
RUN mkdir -p /app/models /app/logs

# Environment
ENV HF_HOME=/app/models
ENV TRANSFORMERS_CACHE=/app/models
ENV OMP_NUM_THREADS=8
ENV MKL_NUM_THREADS=8

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "src/main.py"]