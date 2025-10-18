import axios from 'axios';
import { logger } from '../utils/logger';

interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  language?: 'ru' | 'en';
}

export class LLMService {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/v1/completions`,
        {
          prompt,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 512,
          top_p: options.topP || 0.9,
          stop: ['Пользователь:', 'User:'],
        },
        {
          timeout: 30000, // 30 seconds
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const text = response.data.choices[0].text.trim();
      return text;
    } catch (error) {
      logger.error('LLM API error:', error);
      throw new Error('Failed to generate response from LLM');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}