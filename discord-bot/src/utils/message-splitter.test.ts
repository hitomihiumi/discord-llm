import { MessageSplitter } from './message-splitter';

describe('MessageSplitter', () => {
  describe('split by paragraph', () => {
    it('should not split short messages', () => {
      const text = 'Короткое сообщение';
      const result = MessageSplitter.split(text);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(text);
    });

    it('should split long text by paragraphs', () => {
      const paragraph1 = 'A'.repeat(1000);
      const paragraph2 = 'B'.repeat(1000);
      const text = `${paragraph1}\n\n${paragraph2}`;
      const result = MessageSplitter.split(text, { maxLength: 1500 });
      expect(result.length).toBeGreaterThan(1);
    });

    it('should preserve paragraph structure', () => {
      const text = 'Первый параграф.\n\nВторой параграф.\n\nТретий параграф.';
      const result = MessageSplitter.split(text);
      expect(result.some(chunk => chunk.includes('Первый параграф'))).toBe(true);
    });
  });

  describe('split by sentence', () => {
    it('should split by sentences when paragraph is too long', () => {
      const longParagraph = Array(50)
        .fill('Это предложение.')
        .join(' ');
      const result = MessageSplitter.split(longParagraph, { 
        maxLength: 500,
        splitBy: 'sentence' 
      });
      expect(result.length).toBeGreaterThan(1);
    });

    it('should handle Russian sentence endings', () => {
      const text = 'Привет! Как дела? Всё хорошо.';
      const result = MessageSplitter.split(text, { splitBy: 'sentence' });
      expect(result).toBeDefined();
    });
  });

  describe('split with code blocks', () => {
    it('should preserve code blocks', () => {
      const text = 'Вот код:\n```javascript\nconst x = 1;\n```\nКонец.';
      const result = MessageSplitter.split(text, { preserveCodeBlocks: true });
      expect(result.some(chunk => chunk.includes('```javascript'))).toBe(true);
    });

    it('should split large code blocks', () => {
      const longCode = 'x'.repeat(1500);
      const text = `\`\`\`js\n${longCode}\n\`\`\``;
      const result = MessageSplitter.split(text, { 
        maxLength: 1000,
        preserveCodeBlocks: true 
      });
      expect(result.length).toBeGreaterThan(1);
      expect(result.every(chunk => chunk.includes('```'))).toBe(true);
    });
  });

  describe('split by word', () => {
    it('should split very long words', () => {
      const longWord = 'A'.repeat(2500);
      const result = MessageSplitter.split(longWord, { splitBy: 'word' });
      expect(result.length).toBeGreaterThan(1);
    });
  });

  describe('with prefix', () => {
    it('should add prefix to each chunk', () => {
      const text = 'A'.repeat(3000);
      const prefix = '> ';
      const result = MessageSplitter.split(text, { 
        prefix,
        maxLength: 1000 
      });
      expect(result.every(chunk => chunk.startsWith(prefix))).toBe(true);
    });
  });
});