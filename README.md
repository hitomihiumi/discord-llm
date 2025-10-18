# Discord LLM Support Bot

A full-featured Discord support bot using Qwen2.5 7B Instruct with RAG and semantic search capabilities.

## 🎯 Features

- 🤖 **LLM**: Qwen2.5 7B Instruct (Q4 quantization for CPU)
- 🔍 **RAG**: Semantic search through FAQ and tickets
- 🌐 **Multilingual**: Russian and English support
- 🛡️ **Security**: Prompt injection protection and rate limiting
- 📊 **Logging**: Discord webhooks with rich embeds
- 🐳 **Docker**: Full containerization
- 💻 **CPU Optimized**: Works without GPU

## 📋 Requirements

### Hardware
- **CPU**: 8 cores / 8 threads ✅
- **RAM**: 16GB ✅
- **Storage**: 10GB free space
- **GPU**: Not required ✅

### Software
- Linux (tested on Arch Linux)
- Docker + Docker Compose
- Python 3.10+ (for setup scripts)

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/hitomihiumi/discord-llm.git
cd discord-llm

# Run setup
chmod +x scripts/*.sh
./scripts/setup.sh
```

### 2. Configuration

Edit `.env`:

```bash
nano .env

# Add your Discord bot token
DISCORD_TOKEN=your_token_here

# Optional: webhook for logs
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 3. Start Services

```bash
# Start all services
./scripts/start.sh

# Load knowledge base (after services are ready)
./scripts/load_dataset.sh
```

### 4. Verification

```bash
# Check status
docker-compose ps

# Check logs
./scripts/logs.sh

# Check service health
curl http://localhost:8000/health
curl http://localhost:8001/health
```

## 📁 Project Structure

```
discord-llm/
├── discord-bot/          # Discord.js client
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── llm-service/          # Qwen2.5 7B inference
│   ├── src/
│   ├── scripts/
│   └── Dockerfile
├── embedding-service/    # RAG and embeddings
│   ├── src/
│   └── Dockerfile
├── datasets/             # FAQ and tickets
│   └── knowledge_base.json
├── scripts/              # Utilities
│   ├── setup.sh
│   ├── start.sh
│   ├── stop.sh
│   └── load_dataset.sh
├── docker-compose.yml    # Orchestration
└── README.md
```

## 🔧 Management

```bash
# Start
./scripts/start.sh

# Stop
./scripts/stop.sh

# Logs (all services)
./scripts/logs.sh

# Logs (specific service)
./scripts/logs.sh discord-bot
./scripts/logs.sh llm-service
./scripts/logs.sh embedding-service

# Restart
docker-compose restart

# Rebuild
docker-compose build --no-cache
```

## 📊 Performance

### Expected Speed (Your Hardware)

| Service | Metric | Value |
|---------|--------|-------|
| LLM | Tokens/sec | 2-4 |
| LLM | Short answer (50 tok) | ~15-20 sec |
| LLM | Medium answer (200 tok) | ~60-80 sec |
| Embeddings | Texts/sec | 10-15 |
| RAG Search | Latency | 50-100ms |
| RAM Usage | Total | ~14GB |

## 📚 Dataset

Dataset is located in `datasets/knowledge_base.json` and contains:

- ✅ **49 FAQ** about Minecraft Vortex modpack
- ✅ **3 FAQ** about Discord bots
- ✅ **6 Resolved Tickets** with solutions

### Adding New Data

Edit `datasets/knowledge_base.json`:

```json
{
  "faqs": [
    {
      "id": "unique-id",
      "question": "Your question?",
      "answer": "Your answer",
      "tags": ["tag1", "tag2"],
      "language": "ru"
    }
  ]
}
```

Then reload:

```bash
./scripts/load_dataset.sh
```

## 🛡️ Security

Implemented features:

- ✅ Input validation
- ✅ Prompt injection protection
- ✅ Rate limiting (5 req/min)
- ✅ Content sanitization
- ✅ Token security
- ✅ Webhook logging

## 📝 Logging

### Console Logs

```bash
./scripts/logs.sh
```

### Discord Webhooks

Create a webhook in Discord and add to `.env`:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Log types:
- 💬 User Queries
- 🤖 Bot Responses
- ⏳ Rate Limits
- 🚨 Security Alerts
- ❌ Errors
- 📊 Hourly Metrics

## 🔍 Troubleshooting

### LLM Service Slow to Start

First launch loads the model (2-3 min). Subsequent starts are faster.

```bash
# Check status
docker-compose logs -f llm-service
```

### Bot Not Responding

1. Check token in `.env`
2. Verify services are running
3. Check logs

```bash
docker-compose ps
./scripts/logs.sh discord-bot
```

### Out of Memory

Reduce allocated memory or close other applications:

```bash
# Check usage
docker stats

# Free memory
sudo sysctl -w vm.drop_caches=3
```

### Slow Responses

This is normal on CPU. Optimizations:

1. Reduce `max_tokens` in `discord-bot/src/services/llm.service.ts`
2. Use smaller model (3B instead of 7B)
3. Enable caching

## 📦 Updates

```bash
# Stop services
./scripts/stop.sh

# Update code
git pull

# Rebuild
docker-compose build --no-cache

# Start
./scripts/start.sh
```

## 🏗️ Architecture

```
┌─────────────┐
│   Discord   │
│   Server    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│         Discord Bot Service              │
│  ┌────────────────────────────────────┐ │
│  │  • Message Handler                 │ │
│  │  • Security & Rate Limiting        │ │
│  │  • Conversation Manager            │ │
│  │  • Smart Message Splitter          │ │
│  │  • Discord Webhook Logger          │ │
│  └────────────────────────────────────┘ │
└─────────┬───────────────────┬───────────┘
          │                   │
          ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│  LLM Service     │  │  Embedding/RAG   │
│                  │  │    Service       │
│  • Qwen2.5 7B    │  │                  │
│  • Q4 Quant      │  │  • ChromaDB      │
│  • llama.cpp     │  │  • Multilingual  │
│  • Streaming     │  │  • Semantic      │
│                  │  │    Search        │
└──────────────────┘  └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  Knowledge Base  │
                      │                  │
                      │  • 49 FAQ        │
                      │  • 6 Tickets     │
                      │  • RU/EN         │
                      └──────────────────┘
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License

## 🆘 Support

- 🐛 [Issue Tracker](https://github.com/hitomihiumi/discord-llm/issues)

## 🙏 Acknowledgments

- [Qwen Team](https://github.com/QwenLM) - For the amazing LLM
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - For CPU optimization
- [ChromaDB](https://www.trychroma.com/) - For vector database
- Minecraft Vortex community - For the inspiration

## 📈 Roadmap

- [ ] Add Redis caching for frequent queries
- [ ] Implement admin commands
- [ ] Add more languages support
- [ ] Create web dashboard
- [ ] Add voice channel support
- [ ] Implement slash commands
- [ ] Add database for analytics
- [ ] Create Docker Hub images

---

Made with ❤️ for the Minecraft Vortex community

**Star ⭐ this repo if you find it useful!**