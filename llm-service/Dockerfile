FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    curl \
    libopenblas-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Build llama-cpp-python with OpenBLAS for CPU optimization
RUN CMAKE_ARGS="-DLLAMA_BLAS=ON -DLLAMA_BLAS_VENDOR=OpenBLAS" \
    pip install --no-cache-dir --force-reinstall llama-cpp-python==0.2.27

# Copy application
COPY src/ ./src/

# Create directories
RUN mkdir -p /app/models /app/logs

# Download model script
COPY scripts/download_model.py ./scripts/

# Set environment
ENV HF_HOME=/app/models
ENV TRANSFORMERS_CACHE=/app/models
ENV OMP_NUM_THREADS=8
ENV MKL_NUM_THREADS=8

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "src/main.py"]