import { Client, GatewayIntentBits, Events, Message, TextChannel } from 'discord.js';
import { config } from './config';
import { LLMService } from './services/llm.service';
import { RAGService } from './services/rag.service';
import { SecurityService } from './services/security.service';
import { ConversationManager } from './services/conversation.manager';
import { MessageSplitter } from './utils/message-splitter';
import { logger } from './utils/logger';
import { discordLogger } from './utils/discord-logger';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const llmService = new LLMService(config.llm.apiUrl);
const ragService = new RAGService(config.rag.apiUrl);
const securityService = new SecurityService();
const conversationManager = new ConversationManager();

// Metrics tracking
const metrics = {
  totalQueries: 0,
  totalResponseTime: 0,
  errors: 0,
  activeUsers: new Set<string>(),
  ragHits: 0,
  ragMisses: 0,
};

client.once(Events.ClientReady, async (c) => {
  logger.info(`✅ Bot is ready! Logged in as ${c.user.tag}`);
  await discordLogger.logSystemEvent('ready', `Logged in as ${c.user.tag}`);
  
  // Send metrics every hour
  setInterval(async () => {
    const avgResponseTime = metrics.totalQueries > 0 
      ? Math.round(metrics.totalResponseTime / metrics.totalQueries) 
      : 0;
    const errorRate = metrics.totalQueries > 0 
      ? metrics.errors / metrics.totalQueries 
      : 0;
    const ragHitRate = (metrics.ragHits + metrics.ragMisses) > 0
      ? metrics.ragHits / (metrics.ragHits + metrics.ragMisses)
      : 0;

    await discordLogger.logMetrics({
      totalQueries: metrics.totalQueries,
      avgResponseTime,
      errorRate,
      activeUsers: metrics.activeUsers.size,
      ragHitRate,
    });

    // Reset hourly metrics
    metrics.activeUsers.clear();
  }, 3600000); // Every hour
});

client.on(Events.MessageCreate, async (message: Message) => {
  // Ignore bot messages
  if (message.author.bot) return;
  
  if (!message.mentions.has(client.user!) || message.channel.isDMBased()) return;

  let ragTime = 0;
  let llmTime = 0;

  const startTime = Date.now();
  metrics.totalQueries++;
  metrics.activeUsers.add(message.author.id);

  try {
    // Rate limiting check
    if (securityService.isRateLimited(message.author.id)) {
      await message.reply('⏳ Пожалуйста, подождите немного перед следующим запросом.');
      
      if (config.logging.logSecurity) {
        await discordLogger.logRateLimitHit(message.author.id, message.author.username);
      }
      return;
    }

    // Show typing indicator
    await (message.channel as TextChannel).sendTyping();

    // Clean message content
    let userQuery = message.content.replace(/<@!?\d+>/g, '').trim();

    // Security: sanitize input
    if (!securityService.validateInput(userQuery)) {
      await message.reply('❌ Ваш запрос содержит недопустимые элементы.');
      
      if (config.logging.logSecurity) {
        await discordLogger.logSecurityAlert(
          message.author.id,
          message.author.username,
          'Input validation failed',
          userQuery
        );
      }
      return;
    }

    // Detect language
    const language = detectLanguage(userQuery);
    
    logger.info(`Query from ${message.author.tag}: ${userQuery} [${language}]`);
    
    // Log query to Discord webhook
    if (config.logging.logQueries) {
      await discordLogger.logUserQuery(
        message.author.id,
        message.author.username,
        userQuery,
        message.channelId,
        message.guildId || undefined
      );
    }

    const ragStart = Date.now();
    const ragContext = await ragService.search(userQuery, language);
    ragTime = Date.now() - ragStart;
    logger.info(`RAG returned ${ragContext.length} documents`);
    ragContext.forEach((doc, index) => {
        logger.info(`RAG Document ${index + 1}:`);
        logger.info(doc);
        logger.info('---');
    });
    logger.info(`RAG search took ${ragTime}ms`);


      if (ragContext.length > 0) {
      metrics.ragHits++;
    } else {
      metrics.ragMisses++;
    }
    
    // Get conversation history
    const conversationHistory = conversationManager.getHistory(message.author.id);

    // Build prompt with context
    const systemPrompt = getSystemPrompt(language);
    const prompt = buildPrompt(systemPrompt, ragContext, conversationHistory, userQuery);

    logger.info('=== FULL PROMPT ===');
    logger.info(prompt);
    logger.info('=== END PROMPT ===');

    // Get response from LLM
    const llmStart = Date.now();
    const response = await llmService.generate(prompt, {
        temperature: 0.3,
        maxTokens: 512,
        language,
    });
    llmTime = Date.now() - llmStart;
    logger.info(`LLM generation took ${llmTime}ms`);

    // Save to conversation history
    conversationManager.addMessage(message.author.id, {
      role: 'user',
      content: userQuery,
    });
    conversationManager.addMessage(message.author.id, {
      role: 'assistant',
      content: response,
    });

    // Calculate response time
    const responseTime = Date.now() - startTime;
    metrics.totalResponseTime += responseTime;

    // Log response to Discord webhook
    if (config.logging.logResponses) {
      await discordLogger.logBotResponse(
        message.author.id,
        message.author.username,
        response,
        responseTime,
        ragContext.length,
        message.channelId
      );
    }

    // Send response using smart splitter
    await MessageSplitter.sendSplit(message, response, {
      asReply: true,
      splitBy: 'paragraph',
      preserveCodeBlocks: true,
      delay: 500,
    });

  } catch (error) {
    metrics.errors++;
    logger.error('Error processing message:', error);
    
    if (config.logging.logErrors) {
      await discordLogger.logError(
        'Failed to process user message',
        error as Error,
        {
          userId: message.author.id,
          username: message.author.username,
          channelId: message.channelId,
          action: 'message_processing',
        }
      );
    }

    await message.reply('❌ Произошла ошибка при обработке вашего запроса. Попробуйте позже.');
  }
});

function detectLanguage(text: string): 'ru' | 'en' {
  const cyrillicPattern = /[\u0400-\u04FF]/;
  return cyrillicPattern.test(text) ? 'ru' : 'en';
}

function getSystemPrompt(language: 'ru' | 'en'): string {
    const prompts = {
        ru: `Ты — помощник технической поддержки Discord сервера Saudade Studio.

ВАЖНЫЕ ИНСТРУКЦИИ:
1. ВСЕГДА используй информацию из раздела "БАЗА ЗНАНИЙ" для ответа
2. Отвечай ТОЛЬКО на основе предоставленной информации
3. Если информация есть в базе знаний - дай подробный ответ
4. Если информации нет в базе - так и скажи: "К сожалению, у меня нет информации об этом в базе знаний"
5. Отвечай на русском языке
6. Будь конкретным и полезным

ЗАПРЕЩЕНО:
- Придумывать информацию, которой нет в базе знаний
- Давать общие советы, если есть конкретная информация в базе
- Игнорировать контекст из базы знаний`,

        en: `You are a Saudade Studio Discord server technical support assistant.

IMPORTANT INSTRUCTIONS:
1. ALWAYS use information from "KNOWLEDGE BASE" section to answer
2. Answer ONLY based on provided information
3. If information exists in knowledge base - give detailed answer
4. If no information - say: "I don't have information about this in the knowledge base"
5. Respond in English
6. Be specific and helpful

PROHIBITED:
- Making up information not in knowledge base
- Giving general advice when specific info exists
- Ignoring context from knowledge base`,
    };

    return prompts[language];
}

function buildPrompt(
    systemPrompt: string,
    ragContext: string[],
    conversationHistory: Array<{ role: string; content: string }>,
    userQuery: string
): string {
    // Используем Qwen chat format
    let messages = [];

    // System message
    let systemContent = systemPrompt;

    // Add RAG context to system message
    if (ragContext.length > 0) {
        systemContent += `\n\n=== ИНФОРМАЦИЯ ИЗ БАЗЫ ЗНАНИЙ ===\n`;
        ragContext.forEach((context, index) => {
            systemContent += `\nДокумент ${index + 1}:\n${context}\n`;
        });
        systemContent += `\n=== КОНЕЦ БАЗЫ ЗНАНИЙ ===\n`;
    }

    messages.push({ role: 'system', content: systemContent });

    // Add conversation history (last 4 messages)
    const recentHistory = conversationHistory.slice(-4);
    messages.push(...recentHistory);

    // Add current user query
    messages.push({ role: 'user', content: userQuery });

    // Format for Qwen
    let prompt = '';
    for (const msg of messages) {
        prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
    }
    prompt += `<|im_start|>assistant\n`;

    return prompt;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down bot...');
  await discordLogger.logSystemEvent('shutdown', 'Bot shutting down gracefully');
  await discordLogger.destroy();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down...');
  await discordLogger.logSystemEvent('shutdown', 'Bot received SIGTERM');
  await discordLogger.destroy();
  client.destroy();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception:', error);
  if (config.logging.logErrors) {
    await discordLogger.logError('Uncaught exception', error, { action: 'uncaught_exception' });
  }
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  if (config.logging.logErrors) {
    await discordLogger.logError(
      'Unhandled promise rejection',
      reason instanceof Error ? reason : new Error(String(reason)),
      { action: 'unhandled_rejection' }
    );
  }
});

process.on('unhandledRejection', async (reason: any, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    console.error('FATAL: Unhandled rejection', reason);

    if (config.logging.logErrors && discordLogger) {
        try {
            await discordLogger.logError(
                'Unhandled promise rejection',
                reason instanceof Error ? reason : new Error(String(reason)),
                { action: 'unhandled_rejection' }
            );
        } catch (err) {
            console.error('Failed to log error to Discord:', err);
        }
    }

    setTimeout(() => process.exit(1), 1000);
});

process.on('uncaughtException', async (error: Error) => {
    logger.error('Uncaught exception:', error);
    console.error('FATAL: Uncaught exception', error);

    if (config.logging.logErrors && discordLogger) {
        try {
            await discordLogger.logError('Uncaught exception', error, { action: 'uncaught_exception' });
        } catch (err) {
            console.error('Failed to log error to Discord:', err);
        }
    }

    setTimeout(() => process.exit(1), 1000);
});

// Log startup
discordLogger.logSystemEvent('startup', 'Bot is starting...');

client.login(config.discord.token);