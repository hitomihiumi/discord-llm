#!/bin/bash
# Setup script for Discord LLM Bot

set -e

echo "🚀 Discord LLM Bot Setup"
echo "========================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running on Arch Linux
if [ -f /etc/arch-release ]; then
    echo -e "${GREEN}✓ Arch Linux detected${NC}"
fi

# Check Docker
echo -n "Checking Docker... "
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗${NC}"
    echo "Docker not found. Installing..."
    if [ -f /etc/arch-release ]; then
        sudo pacman -S docker docker-compose --noconfirm
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
        echo -e "${YELLOW}Please log out and log back in for Docker group changes to take effect${NC}"
    else
        echo -e "${RED}Please install Docker manually: https://docs.docker.com/engine/install/${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC}"
fi

# Check Docker Compose
echo -n "Checking Docker Compose... "
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗${NC}"
    echo -e "${RED}Please install docker-compose${NC}"
    exit 1
else
    echo -e "${GREEN}✓${NC}"
fi

# Create .env if not exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo -e "${YELLOW}⚠ Please edit .env file and add your Discord token${NC}"
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p discord-bot/logs
mkdir -p llm-service/models
mkdir -p llm-service/logs
mkdir -p embedding-service/data
mkdir -p embedding-service/models
mkdir -p datasets

# Download LLM model
echo ""
echo "📥 Downloading LLM model..."
echo "This will download ~4GB. Continue? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    cd llm-service
    python3 scripts/download_model.py
    cd ..
else
    echo -e "${YELLOW}Skipped model download. You can download it later with:${NC}"
    echo "  cd llm-service && python scripts/download_model.py"
fi

# Build containers
echo ""
echo "🔨 Building Docker containers..."
docker-compose build

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your Discord token"
echo "2. Start services: ./scripts/start.sh"
echo "3. Load dataset: ./scripts/load_dataset.sh"
echo ""