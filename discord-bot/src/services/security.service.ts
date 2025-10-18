import { logger } from "../utils/logger";
import { config } from "../config";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class SecurityService {
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  private readonly suspiciousPatterns = [
    /ignore\s+(previous|above|all)\s+instructions?/i,
    /system\s*:/i,
    /act\s+as\s+(?!.*support)/i,
    /you\s+are\s+now/i,
    /new\s+instructions?/i,
    /забудь\s+(?:предыдущие|все)\s+инструкции/i,
    /ты\s+теперь/i,
    /новые\s+инструкции/i,
  ];

  isRateLimited(userId: string): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(userId);

    if (!entry || now > entry.resetTime) {
      this.rateLimits.set(userId, {
        count: 1,
        resetTime: now + config.security.rateLimitWindow,
      });
      return false;
    }

    if (entry.count >= config.security.rateLimitMax) {
      logger.warn(`Rate limit exceeded for user: ${userId}`);
      return true;
    }

    entry.count++;
    return false;
  }

  validateInput(input: string): boolean {
    // Check length (увеличено для поддержки файлов)
    const maxLength = config.security.maxInputLength + 10000; // +10k для файлов
    if (input.length > maxLength) {
      logger.warn(`Input exceeds max length: ${input.length} > ${maxLength}`);
      return false;
    }

    // Check for prompt injection attempts
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(input)) {
        logger.warn(`Suspicious pattern detected: ${pattern}`);
        return false;
      }
    }

    return true;
  }

  // Clean up old rate limit entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [userId, entry] of this.rateLimits.entries()) {
      if (now > entry.resetTime) {
        this.rateLimits.delete(userId);
      }
    }
  }
}
