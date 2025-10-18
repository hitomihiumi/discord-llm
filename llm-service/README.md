# LLM Service - Qwen2.5 7B Instruct (CPU Optimized)

CPU-optimized inference service for Qwen2.5 7B Instruct using quantization.

## System Requirements

✅ **Your System:**
- CPU: 8 cores / 8 threads
- RAM: 16GB (12GB allocated to service)
- Storage: 10GB for model
- **NO GPU REQUIRED**

## Performance Expectations

### With Q4_K_M Quantization (Recommended)
- **Model Size**: ~4GB
- **RAM Usage**: 6-8GB during inference
- **Speed**: 2-4 tokens/second
- **Latency**: 250-500ms per token
- **Quality**: Minimal degradation from FP16

### Response Times (Estimates)
- Short answer (50 tokens): ~15-20 seconds
- Medium answer (200 tokens): ~60-80 seconds
- Long answer (500 tokens): ~2-3 minutes

## Quick Start

### 1. Download Model

```bash
# Run download script
python scripts/download_model.py

# Or manual download from:
# https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF
# Download: qwen2.5-7b-instruct-q4_k_m.gguf (~4GB)
# Place in: ./models/
```

### 2. Build and Run

```bash
# Build
docker-compose build

# Run
docker-compose up -d

# First startup takes 2-3 minutes to load model into RAM
docker-compose logs -f
```

### 3. Test

```bash
# Wait for "Model loaded successfully" message
curl http://localhost:8000/health

# Test generation
python src/test_client.py
```

## Optimization Tips

### 1. Reduce Memory Usage

If experiencing OOM errors:

```python
# In main.py, reduce context window
n_ctx=2048  # Instead of 4096
```

### 2. Increase Speed

```python
# Use smaller quantization (less quality, faster)
# Download: qwen2.5-7b-instruct-q3_k_m.gguf (~3GB)
```

### 3. Batch Processing

For multiple requests, enable request queuing:

```python
# Process requests sequentially to avoid memory spikes
```

## Alternative: Use Smaller Model

If 7B model is too slow, consider:

```bash
# Qwen2.5-3B-Instruct (faster, less capable)
MODEL_NAME=Qwen/Qwen2.5-3B-Instruct-GGUF
# ~2GB, 4-6 tokens/sec on CPU
```

## API Usage

Same as GPU version, but expect slower response times.

### Example

```python
import requests

response = requests.post(
    "http://localhost:8000/v1/completions",
    json={
        "prompt": "Привет! Как установить Python?",
        "max_tokens": 200,  # Keep lower for faster responses
        "temperature": 0.7
    }
)

print(response.json()['choices'][0]['text'])
```

## Troubleshooting

### Model Loading Takes Forever

First download takes 5-10 minutes. Subsequent starts are faster (2-3 min).

### High Memory Usage

```bash
# Check memory
docker stats llm-service

# If >12GB, reduce context window or use smaller model
```

### Slow Responses

This is expected on CPU. Consider:
1. Use streaming for better UX
2. Reduce max_tokens
3. Use smaller model (3B instead of 7B)
4. Add response caching for common queries

### Connection Timeout

Increase Discord bot timeout:

```typescript
// In discord-bot LLM service
timeout: 120000  // 2 minutes instead of 30s
```

## Production Recommendations

1. **Use Caching**: Cache common responses in Redis
2. **Add Queue**: Process requests sequentially
3. **Set Limits**: `max_tokens: 256` for faster responses
4. **Monitor**: Watch RAM usage
5. **Consider Upgrade**: For better UX, consider VPS with GPU

## Comparison: CPU vs GPU

| Metric | CPU (Your Setup) | GPU (RTX 4090) |
|--------|------------------|----------------|
| Speed | 2-4 tok/s | 50+ tok/s |
| RAM | 8GB | 14GB VRAM |
| Cost | $0 | $1500+ |
| Quality | Same (Q4) | Slightly better (FP16) |

## License

MIT License