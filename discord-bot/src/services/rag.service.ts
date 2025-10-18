import axios from 'axios';
import { logger } from '../utils/logger';

interface SearchResult {
  content: string;
  score: number;
  metadata: {
    id: string;
    type: 'faq' | 'ticket';
    language: string;
  };
}

export class RAGService {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async search(query: string, language: 'ru' | 'en', topK: number = 3): Promise<string[]> {
    try {
      const response = await axios.post<{ results: SearchResult[] }>(
        `${this.apiUrl}/search`,
        {
          query,
          language,
          top_k: topK,
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const results = response.data.results.map((result) => {
        const typeLabel = result.metadata.type === 'faq' ? 'FAQ' : 'Решенный тиккет';
        return `[${typeLabel} - ID: ${result.metadata.id}]\n${result.content}`;
      });

      logger.info(`RAG found ${results.length} relevant documents`);
      return results;
    } catch (error) {
      logger.error('RAG API error:', error);
      return []; // Return empty context on error
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