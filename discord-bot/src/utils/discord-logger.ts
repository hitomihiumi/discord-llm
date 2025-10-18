import axios from 'axios';
import { EmbedBuilder, WebhookClient } from 'discord.js';
import { config } from '../config';

export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
  SUCCESS = 'success',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  userId?: string;
  channelId?: string;
  guildId?: string;
  error?: Error;
  timestamp?: Date;
}

export class DiscordLogger {
  private webhookClient: WebhookClient | null = null;
  private readonly colors = {
    [LogLevel.INFO]: 0x3498db, // Blue
    [LogLevel.WARN]: 0xf39c12, // Orange
    [LogLevel.ERROR]: 0xe74c3c, // Red
    [LogLevel.DEBUG]: 0x95a5a6, // Gray
    [LogLevel.SUCCESS]: 0x2ecc71, // Green
  };

  private readonly emojis = {
    [LogLevel.INFO]: 'ℹ️',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.ERROR]: '❌',
    [LogLevel.DEBUG]: '🔍',
    [LogLevel.SUCCESS]: '✅',
  };

  constructor() {
    if (config.logging.webhookUrl) {
      try {
        this.webhookClient = new WebhookClient({ url: config.logging.webhookUrl });
      } catch (error) {
        console.error('Failed to initialize Discord webhook logger:', error);
      }
    }
  }

  async log(entry: LogEntry): Promise<void> {
    if (!this.webhookClient) return;

    try {
      const embed = this.createEmbed(entry);
      await this.webhookClient.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send log to Discord webhook:', error);
    }
  }

  async info(message: string, data?: any): Promise<void> {
    await this.log({ level: LogLevel.INFO, message, data });
  }

  async warn(message: string, data?: any): Promise<void> {
    await this.log({ level: LogLevel.WARN, message, data });
  }

  async error(message: string, error?: Error, data?: any): Promise<void> {
    await this.log({ level: LogLevel.ERROR, message, error, data });
  }

  async debug(message: string, data?: any): Promise<void> {
    if (config.logging.debugWebhook) {
      await this.log({ level: LogLevel.DEBUG, message, data });
    }
  }

  async success(message: string, data?: any): Promise<void> {
    await this.log({ level: LogLevel.SUCCESS, message, data });
  }

  async logUserQuery(
    userId: string,
    username: string,
    query: string,
    channelId: string,
    guildId?: string
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('💬 User Query')
      .setDescription(`\`\`\`${this.truncate(query, 2000)}\`\`\``)
      .addFields(
        { name: '👤 User', value: `<@${userId}> (${username})`, inline: true },
        { name: '📍 Channel', value: `<#${channelId}>`, inline: true },
        { name: '🆔 User ID', value: `\`${userId}\``, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Query Received' });

    if (guildId) {
      embed.addFields({ name: '🏠 Guild ID', value: `\`${guildId}\``, inline: true });
    }

    if (this.webhookClient) {
      await this.webhookClient.send({ embeds: [embed] });
    }
  }

  async logBotResponse(
    userId: string,
    username: string,
    response: string,
    responseTime: number,
    ragHits: number,
    channelId: string
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('🤖 Bot Response')
      .setDescription(`\`\`\`${this.truncate(response, 1500)}\`\`\``)
      .addFields(
        { name: '👤 User', value: `<@${userId}> (${username})`, inline: true },
        { name: '⏱️ Response Time', value: `${responseTime}ms`, inline: true },
        { name: '📚 RAG Hits', value: `${ragHits}`, inline: true },
        { name: '📍 Channel', value: `<#${channelId}>`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Response Sent' });

    if (this.webhookClient) {
      await this.webhookClient.send({ embeds: [embed] });
    }
  }

  async logRateLimitHit(userId: string, username: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('⏳ Rate Limit Hit')
      .setDescription('User exceeded rate limit')
      .addFields(
        { name: '👤 User', value: `<@${userId}> (${username})`, inline: true },
        { name: '🆔 User ID', value: `\`${userId}\``, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Rate Limit Triggered' });

    if (this.webhookClient) {
      await this.webhookClient.send({ embeds: [embed] });
    }
  }

  async logSecurityAlert(
    userId: string,
    username: string,
    reason: string,
    suspiciousContent: string
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🚨 Security Alert')
      .setDescription(`**Reason:** ${reason}`)
      .addFields(
        { name: '👤 User', value: `<@${userId}> (${username})`, inline: true },
        { name: '🆔 User ID', value: `\`${userId}\``, inline: true },
        {
          name: '⚠️ Suspicious Content',
          value: `\`\`\`${this.truncate(suspiciousContent, 1000)}\`\`\``,
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Security System' });

    if (this.webhookClient) {
      await this.webhookClient.send({ 
        embeds: [embed],
        content: '🚨 **SECURITY ALERT** 🚨'
      });
    }
  }

  async logError(
    errorMessage: string,
    error: Error,
    context?: {
      userId?: string;
      username?: string;
      channelId?: string;
      action?: string;
    }
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('❌ Error Occurred')
      .setDescription(`**Message:** ${errorMessage}`)
      .addFields(
        { name: '🐛 Error Type', value: error.name, inline: true },
        { name: '📝 Error Message', value: `\`\`\`${this.truncate(error.message, 1000)}\`\`\``, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Error Log' });

    if (error.stack) {
      embed.addFields({
        name: '📚 Stack Trace',
        value: `\`\`\`${this.truncate(error.stack, 1000)}\`\`\``,
      });
    }

    if (context) {
      const contextFields = [];
      if (context.userId) {
        contextFields.push({ 
          name: '👤 User', 
          value: `<@${context.userId}>${context.username ? ` (${context.username})` : ''}`, 
          inline: true 
        });
      }
      if (context.channelId) {
        contextFields.push({ name: '📍 Channel', value: `<#${context.channelId}>`, inline: true });
      }
      if (context.action) {
        contextFields.push({ name: '⚙️ Action', value: context.action, inline: true });
      }
      if (contextFields.length > 0) {
        embed.addFields(contextFields);
      }
    }

    if (this.webhookClient) {
      await this.webhookClient.send({ embeds: [embed] });
    }
  }

  async logSystemEvent(
    event: 'startup' | 'shutdown' | 'ready' | 'reconnect',
    details?: string
  ): Promise<void> {
    const eventInfo = {
      startup: { emoji: '🚀', title: 'System Startup', color: 0x3498db },
      shutdown: { emoji: '🛑', title: 'System Shutdown', color: 0xe74c3c },
      ready: { emoji: '✅', title: 'Bot Ready', color: 0x2ecc71 },
      reconnect: { emoji: '🔄', title: 'Reconnected', color: 0xf39c12 },
    };

    const info = eventInfo[event];
    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setTitle(`${info.emoji} ${info.title}`)
      .setTimestamp()
      .setFooter({ text: 'System Event' });

    if (details) {
      embed.setDescription(details);
    }

    // Add system info for startup
    if (event === 'startup' || event === 'ready') {
      embed.addFields(
        { name: '🖥️ Node Version', value: process.version, inline: true },
        { name: '💾 Memory Usage', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
        { name: '⏰ Uptime', value: `${Math.round(process.uptime())}s`, inline: true }
      );
    }

    if (this.webhookClient) {
      await this.webhookClient.send({ embeds: [embed] });
    }
  }

  async logMetrics(metrics: {
    totalQueries: number;
    avgResponseTime: number;
    errorRate: number;
    activeUsers: number;
    ragHitRate: number;
  }): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('📊 Bot Metrics')
      .addFields(
        { name: '💬 Total Queries', value: metrics.totalQueries.toString(), inline: true },
        { name: '⏱️ Avg Response Time', value: `${metrics.avgResponseTime}ms`, inline: true },
        { name: '❌ Error Rate', value: `${(metrics.errorRate * 100).toFixed(2)}%`, inline: true },
        { name: '👥 Active Users', value: metrics.activeUsers.toString(), inline: true },
        { name: '📚 RAG Hit Rate', value: `${(metrics.ragHitRate * 100).toFixed(2)}%`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Performance Metrics' });

    if (this.webhookClient) {
      await this.webhookClient.send({ embeds: [embed] });
    }
  }

  private createEmbed(entry: LogEntry): EmbedBuilder {
    const timestamp = entry.timestamp || new Date();
    const emoji = this.emojis[entry.level];
    const color = this.colors[entry.level];

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${emoji} ${entry.level.toUpperCase()}`)
      .setDescription(entry.message)
      .setTimestamp(timestamp)
      .setFooter({ text: `Log Level: ${entry.level}` });

    // Add data fields if present
    if (entry.data) {
      const dataStr = typeof entry.data === 'string' 
        ? entry.data 
        : JSON.stringify(entry.data, null, 2);
      embed.addFields({ 
        name: '📋 Data', 
        value: `\`\`\`json\n${this.truncate(dataStr, 1000)}\n\`\`\``,
        inline: false 
      });
    }

    // Add error details if present
    if (entry.error) {
      embed.addFields(
        { name: '🐛 Error', value: entry.error.name, inline: true },
        { name: '📝 Message', value: `\`${this.truncate(entry.error.message, 500)}\``, inline: false }
      );

      if (entry.error.stack) {
        embed.addFields({
          name: '📚 Stack',
          value: `\`\`\`${this.truncate(entry.error.stack, 800)}\`\`\``,
          inline: false,
        });
      }
    }

    // Add context fields
    if (entry.userId) {
      embed.addFields({ name: '👤 User ID', value: `\`${entry.userId}\``, inline: true });
    }
    if (entry.channelId) {
      embed.addFields({ name: '📍 Channel ID', value: `\`${entry.channelId}\``, inline: true });
    }
    if (entry.guildId) {
      embed.addFields({ name: '🏠 Guild ID', value: `\`${entry.guildId}\``, inline: true });
    }

    return embed;
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  async destroy(): Promise<void> {
    if (this.webhookClient) {
      await this.webhookClient.destroy();
      this.webhookClient = null;
    }
  }
}

// Singleton instance
export const discordLogger = new DiscordLogger();