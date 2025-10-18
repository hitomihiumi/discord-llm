#!/bin/bash
# Start all services

set -e

echo "🚀 Starting Discord LLM Bot services..."

# Check .env file
if [ ! -f .env ]; then
    echo "❌ .env file not found. Run ./scripts/setup.sh first"
    exit 1
fi

# Check if DISCORD_TOKEN is set
source .env
if [ -z "$DISCORD_TOKEN" ] || [ "$DISCORD_TOKEN" == "your_discord_bot_token_here" ]; then
    echo "❌ Please set DISCORD_TOKEN in .env file"
    exit 1
fi

echo "Choose an mode to start services:"
echo "  1) Normal mode"
echo "  2) Without Bot (only LLM and Embedding services)"
echo -n "Enter choice [1-2]: "
read -r choice
case $choice in
    1)
        echo "Starting all services including Discord Bot..."
        docker-compose -f docker-compose.yml up
        ;;
    2)
        echo "Starting only LLM and Embedding services..."
        docker-compose -f docker-compose.services-only.yml up
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "✅ Services started!"
echo ""
echo "Checking status..."
sleep 5
docker-compose ps

echo ""
echo "📊 Service URLs:"
echo "  - LLM Service: http://localhost:8000"
echo "  - Embedding Service: http://localhost:8001"
echo ""
echo "📝 View logs:"
echo "  - All: docker-compose logs -f"
echo "  - Bot: docker-compose logs -f discord-bot"
echo "  - LLM: docker-compose logs -f llm-service"
echo "  - RAG: docker-compose logs -f embedding-service"
echo ""
echo "⏳ Wait 2-3 minutes for LLM service to load model..."
echo ""