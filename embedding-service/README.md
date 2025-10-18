# Embedding & RAG Service (CPU Optimized)

Multilingual semantic search and retrieval service optimized for CPU.

## Features

- 🌐 **Multilingual**: Russian & English support
- 🔍 **Semantic Search**: Find relevant FAQ/tickets
- 💾 **ChromaDB**: Persistent vector storage
- 🚀 **CPU Optimized**: Works without GPU
- 📊 **REST API**: Easy integration

## System Requirements

✅ **Your System:**
- CPU: 4 cores allocated
- RAM: 2-4GB
- Storage: 1GB for model

## Performance

- **Model**: paraphrase-multilingual-mpnet-base-v2 (~420MB)
- **Embedding Speed**: ~10-15 texts/second
- **Search Latency**: 50-100ms
- **Embedding Dimension**: 768

## Quick Start

### 1. Start Service

```bash
docker-compose up -d
docker-compose logs -f
```

### 2. Ingest Dataset

```bash
# Wait for service to be ready
curl http://localhost:8001/health

# Ingest knowledge base
docker-compose exec embedding-service python src/ingest_data.py /app/datasets/knowledge_base.json
```

### 3. Test Search

```bash
docker-compose exec embedding-service python src/test_search.py "Как установить бота?"
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Generate Embeddings
```bash
POST /v1/embeddings
{
  "texts": ["Example text"]
}
```

### Search
```bash
POST /search
{
  "query": "Как установить Python?",
  "language": "ru",
  "top_k": 3,
  "min_score": 0.5
}
```

### Ingest Documents
```bash
POST /ingest
{
  "documents": [
    {
      "id": "doc-1",
      "content": "Document text",
      "type": "faq",
      "language": "ru"
    }
  ]
}
```

### Get Stats
```bash
GET /stats
```

## Dataset Format

```json
{
  "faqs": [
    {
      "id": "unique-id",
      "question": "Question text",
      "answer": "Answer text",
      "tags": ["tag1", "tag2"],
      "language": "ru"
    }
  ],
  "resolved_tickets": [
    {
      "id": "unique-id",
      "title": "Ticket title",
      "question": "Problem description",
      "solution": "Solution text",
      "tags": ["tag1"],
      "language": "ru"
    }
  ]
}
```

## Usage Example

```python
import requests

# Search
response = requests.post(
    "http://localhost:8001/search",
    json={
        "query": "Discord bot not responding",
        "language": "en",
        "top_k": 3
    }
)

results = response.json()['results']
for result in results:
    print(f"Score: {result['score']}")
    print(f"Content: {result['content']}\n")
```

## Troubleshooting

### Slow Embedding Generation

Reduce batch size or text length:
```python
embedding_model.max_seq_length = 128
```

### No Results Found

1. Check documents are ingested: `GET /stats`
2. Lower `min_score` to 0.3
3. Verify language filter matches documents

### High Memory Usage

Restart service to clear cache:
```bash
docker-compose restart embedding-service
```

## Arch Linux Specific

Install Docker if needed:
```bash
sudo pacman -S docker docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

## License

MIT License