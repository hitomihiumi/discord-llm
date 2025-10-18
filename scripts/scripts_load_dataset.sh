#!/bin/bash
# Load knowledge base dataset into embedding service

set -e

echo "📚 Loading knowledge base dataset..."

# Wait for embedding service
echo "Waiting for embedding service to be ready..."
until curl -f http://localhost:8001/health &> /dev/null; do
    echo -n "."
    sleep 2
done
echo " Ready!"

# Ingest dataset
echo "Ingesting dataset..."
docker-compose exec embedding-service python src/ingest_data.py /app/datasets/knowledge_base.json

echo ""
echo "✅ Dataset loaded!"
echo ""
echo "📊 Check stats:"
curl http://localhost:8001/stats | python -m json.tool
echo ""