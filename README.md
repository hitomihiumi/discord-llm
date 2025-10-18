# Discord LLM Support Bot 🤖

Intelligent Discord support bot powered by LLM with semantic search through knowledge base.

## ✨ Features

- 🤖 **CPU LLM**: Qwen2.5-3B (no GPU required!)
- 🔍 **RAG Search**: Automatic search through FAQ and resolved tickets
- 🌐 **Multilingual**: Russian and English support
- 🛡️ **Security**: Prompt injection protection and rate limiting
- 📊 **Logging**: Discord webhooks with rich embeds
- 🐳 **Docker**: Full containerization

## 📋 Requirements

### Hardware
- **CPU**: 8+ cores
- **RAM**: 16GB
- **Storage**: 10GB free space
- **GPU**: Not required ✅

### Software
- Linux (tested on Arch Linux)
- Docker + Docker Compose
- Python 3.10+ (for scripts)

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/hitomihiumi/discord-llm.git
cd discord-llm
```

### 2. Create .env File

```bash
cp .env.example .env
nano .env
```

Fill in:

```env
# REQUIRED: Discord bot token
DISCORD_TOKEN=your_token_here

# OPTIONAL: Webhook for logs
DISCORD_WEBHOOK_URL=

# Leave these as default
LLM_API_URL=http://llm-service:8000
RAG_API_URL=http://embedding-service:8001
```

### 3. Start Services

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Start everything
./scripts/start.sh

# Wait for models to load (2-3 minutes)
./scripts/logs.sh
```

**First run**: Models will download ~20GB. This takes 5-10 minutes depending on your internet.

### 4. Load Knowledge Base

After services are ready:

```bash
./scripts/load_dataset.sh
```

### 5. Done! 🎉

Invite your bot to a server and mention it:

```
@YourBot How do you feel?
```

## 📁 Project Structure

```
discord-llm/
├── discord-bot/          # Discord bot (TypeScript)
├── llm-service/          # LLM service (Python, Phi-3.5 or Qwen)
├── embedding-service/    # RAG service (Python, ChromaDB)
├── datasets/             # Knowledge base (FAQ + tickets)
└── scripts/              # Utility scripts
```

## 🔧 Management

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# Logs (all services)
docker-compose logs -f

# Logs (specific service)
docker-compose logs -f discord-bot
docker-compose logs -f llm-service
docker-compose logs -f embedding-service

# Rebuild (after changes)
docker-compose build --no-cache
docker-compose up -d
```

## 📊 Performance

On your hardware (8 cores, 16GB RAM):

| Metric | Value |
|--------|-------|
| LLM Speed | 10-20 tokens/sec |
| Short answer (50 tokens) | ~5-10 seconds |
| Medium answer (256 tokens) | ~20-40 seconds |
| RAG Search | 50-100ms |
| RAM Usage | ~10-12GB |

## 📚 Knowledge Base

File: `datasets/knowledge_base.json`

**Current content:**
- 49 FAQ about Minecraft Vortex modpack
- 3 FAQ about Discord bots
- 6 Resolved tickets with solutions

### Adding New Data

1. Edit `datasets/knowledge_base.json`:

```json
{
  "faqs": [
    {
      "id": "faq-custom-001-en",
      "question": "Your question?",
      "answer": "Your answer",
      "tags": ["tag1", "tag2"],
      "language": "en"
    }
  ]
}
```

2. Reload data:

```bash
# Reset database
curl -X POST http://localhost:8001/reset

# Load again
docker-compose exec embedding-service python src/ingest_data.py /app/datasets/knowledge_base.json
```

## 🛠️ Configuration

### Change LLM Model

In `llm-service/src/main.py` you can switch models:

```python
# Qwen2.5-3B (better quality, 3GB)
"Qwen/Qwen2.5-3B-Instruct"

# Qwen2.5-1.5B (fastest, 2GB)
"Qwen/Qwen2.5-1.5B-Instruct"
```

### Change Rate Limits

In `discord-bot/.env`:

```env
# Max requests per minute
RATE_LIMIT_MAX=5

# Max input length
MAX_INPUT_LENGTH=2000

# Message history
MAX_HISTORY_LENGTH=10
```

### Change LLM Parameters

In `discord-bot/src/index.ts`:

```typescript
const response = await llmService.generateChat(messages, {
  temperature: 0.3,  // Precision (0.1-1.0)
  maxTokens: 512,    // Response length
  language,
});
```

## 🐛 Troubleshooting

### Bot Not Responding

```bash
# 1. Check all services are running
docker-compose ps

# 2. Check bot logs
docker-compose logs discord-bot

# 3. Verify token in .env
cat .env | grep DISCORD_TOKEN
```

### LLM Service Takes Long to Start

First run downloads model. Wait 5-10 minutes:

```bash
docker-compose logs -f llm-service
# Wait for "Model loaded successfully"
```

### Slow Responses

This is normal on CPU. Optimizations:

1. **Reduce maxTokens** in bot (256 instead of 512)
2. **Use lighter model** (1.5B instead of 3B)
3. **Disable history** (comment out recentHistory)

### Out of Memory

```bash
# Check usage
docker stats

# Reduce limits in docker-compose.yml
memory: 6G  # for llm-service
memory: 3G  # for embedding-service
```

### RAG Not Finding Documents

```bash
# Check data is loaded
curl http://localhost:8001/stats

# If empty - reload
docker-compose exec embedding-service python src/ingest_data.py /app/datasets/knowledge_base.json
```

## 🔒 Security

Built-in protection:

- ✅ Input validation
- ✅ Prompt injection protection
- ✅ Rate limiting (5 requests/minute)
- ✅ Suspicious pattern filtering
- ✅ All actions logged

## 📝 Logging

### Console

All logs are written to console:

```bash
docker-compose logs -f
```

### Discord Webhooks

Create webhook in Discord channel:
1. Channel Settings → Integrations → Webhooks
2. Copy URL
3. Add to `.env`:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK
```

Logs include:
- 💬 User queries
- 🤖 Bot responses
- ⏳ Rate limit violations
- 🚨 Security alerts
- ❌ Errors
- 📊 Hourly statistics

## 🔄 Updates

```bash
# Stop
docker-compose down

# Update code
git pull

# Rebuild
docker-compose build --no-cache

# Start
docker-compose up -d
```

## 🏗️ Architecture

```
Discord User
     ↓
Discord Bot (Node.js)
    ↙         ↘
LLM Service   Embedding Service
  (Qwen)       (ChromaDB + RAG)
    ↓              ↓
Response    Knowledge Base (JSON)
```

## 📈 Roadmap

- [ ] Redis caching for frequent queries
- [ ] Discord slash commands
- [ ] More languages (UA, DE, etc)
- [ ] Analytics database
- [ ] Docker Hub images

## 🤝 Contributing

1. Fork repository
2. Create branch: `git checkout -b feature/name`
3. Make changes
4. Push: `git push origin feature/name`
5. Create Pull Request

## 🙏 Acknowledgments

- [Qwen](https://github.com/QwenLM) - for amazing models
- [ChromaDB](https://www.trychroma.com/) - for vector database

## 📞 Support

- 🐛 [Create Issue](https://github.com/hitomihiumi/discord-llm/issues)
- 💬 [Discussions](https://github.com/hitomihiumi/discord-llm/discussions)