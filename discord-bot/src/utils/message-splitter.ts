import { Message } from 'discord.js';

interface SplitOptions {
  maxLength?: number;
  splitBy?: 'paragraph' | 'sentence' | 'word';
  prefix?: string;
  preserveCodeBlocks?: boolean;
}

export class MessageSplitter {
  private static readonly DISCORD_MAX_LENGTH = 2000;
  private static readonly CODE_BLOCK_REGEX = /```[\s\S]*?```/g;

  /**
   * Split a long message into multiple chunks intelligently
   */
  static split(text: string, options: SplitOptions = {}): string[] {
    const {
      maxLength = this.DISCORD_MAX_LENGTH,
      splitBy = 'paragraph',
      prefix = '',
      preserveCodeBlocks = true,
    } = options;

    if (text.length <= maxLength - prefix.length) {
      return [prefix + text];
    }

    if (preserveCodeBlocks) {
      return this.splitWithCodeBlocks(text, maxLength, prefix);
    }

    switch (splitBy) {
      case 'paragraph':
        return this.splitByParagraph(text, maxLength, prefix);
      case 'sentence':
        return this.splitBySentence(text, maxLength, prefix);
      case 'word':
        return this.splitByWord(text, maxLength, prefix);
      default:
        return this.splitByParagraph(text, maxLength, prefix);
    }
  }

  /**
   * Split text while preserving code blocks
   */
  private static splitWithCodeBlocks(
    text: string,
    maxLength: number,
    prefix: string
  ): string[] {
    const chunks: string[] = [];
    const codeBlocks: Array<{ start: number; end: number; content: string }> = [];

    // Find all code blocks
    let match;
    while ((match = this.CODE_BLOCK_REGEX.exec(text)) !== null) {
      codeBlocks.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[0],
      });
    }

    if (codeBlocks.length === 0) {
      return this.splitByParagraph(text, maxLength, prefix);
    }

    let currentPos = 0;
    let currentChunk = prefix;

    for (const block of codeBlocks) {
      // Add text before code block
      const textBefore = text.substring(currentPos, block.start);
      if (textBefore) {
        const textChunks = this.splitByParagraph(
          textBefore,
          maxLength - currentChunk.length,
          ''
        );

        for (let i = 0; i < textChunks.length; i++) {
          if (currentChunk.length + textChunks[i].length > maxLength) {
            chunks.push(currentChunk);
            currentChunk = textChunks[i];
          } else {
            currentChunk += textChunks[i];
          }
        }
      }

      // Handle code block
      if (currentChunk.length + block.content.length > maxLength) {
        if (currentChunk.length > prefix.length) {
          chunks.push(currentChunk);
          currentChunk = prefix;
        }

        // If code block itself is too long, split it
        if (block.content.length > maxLength - prefix.length) {
          const codeLines = block.content.split('\n');
          const lang = codeLines[0].replace('```', '');
          let tempBlock = '```' + lang + '\n';

          for (let i = 1; i < codeLines.length - 1; i++) {
            const line = codeLines[i] + '\n';
            if (tempBlock.length + line.length + 4 > maxLength) {
              chunks.push(tempBlock + '```');
              tempBlock = '```' + lang + '\n' + line;
            } else {
              tempBlock += line;
            }
          }

          if (tempBlock.length > 4 + lang.length) {
            chunks.push(tempBlock + '```');
          }
          currentChunk = prefix;
        } else {
          chunks.push(prefix + block.content);
          currentChunk = prefix;
        }
      } else {
        currentChunk += block.content;
      }

      currentPos = block.end;
    }

    // Add remaining text
    const textAfter = text.substring(currentPos);
    if (textAfter) {
      const textChunks = this.splitByParagraph(textAfter, maxLength, '');
      for (const chunk of textChunks) {
        if (currentChunk.length + chunk.length > maxLength) {
          chunks.push(currentChunk);
          currentChunk = prefix + chunk;
        } else {
          currentChunk += chunk;
        }
      }
    }

    if (currentChunk.length > prefix.length) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Split by paragraphs (double newline)
   */
  private static splitByParagraph(
    text: string,
    maxLength: number,
    prefix: string
  ): string[] {
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = prefix;

    for (const paragraph of paragraphs) {
      const paraWithNewline = paragraph + '\n\n';

      // If single paragraph is too long, split by sentences
      if (paraWithNewline.length > maxLength - prefix.length) {
        if (currentChunk.length > prefix.length) {
          chunks.push(currentChunk.trimEnd());
          currentChunk = prefix;
        }

        const sentenceChunks = this.splitBySentence(paragraph, maxLength, prefix);
        chunks.push(...sentenceChunks);
        currentChunk = prefix;
        continue;
      }

      // Check if adding this paragraph exceeds limit
      if (currentChunk.length + paraWithNewline.length > maxLength) {
        chunks.push(currentChunk.trimEnd());
        currentChunk = prefix + paraWithNewline;
      } else {
        currentChunk += paraWithNewline;
      }
    }

    if (currentChunk.length > prefix.length) {
      chunks.push(currentChunk.trimEnd());
    }

    return chunks.length > 0 ? chunks : [prefix + text];
  }

  /**
   * Split by sentences
   */
  private static splitBySentence(
    text: string,
    maxLength: number,
    prefix: string
  ): string[] {
    // Split by sentence endings (., !, ?, or Cyrillic equivalents)
    const sentences = text.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [text];
    const chunks: string[] = [];
    let currentChunk = prefix;

    for (const sentence of sentences) {
      const sentenceWithSpace = sentence + ' ';

      // If single sentence is too long, split by words
      if (sentenceWithSpace.length > maxLength - prefix.length) {
        if (currentChunk.length > prefix.length) {
          chunks.push(currentChunk.trimEnd());
          currentChunk = prefix;
        }

        const wordChunks = this.splitByWord(sentence, maxLength, prefix);
        chunks.push(...wordChunks);
        currentChunk = prefix;
        continue;
      }

      if (currentChunk.length + sentenceWithSpace.length > maxLength) {
        chunks.push(currentChunk.trimEnd());
        currentChunk = prefix + sentenceWithSpace;
      } else {
        currentChunk += sentenceWithSpace;
      }
    }

    if (currentChunk.length > prefix.length) {
      chunks.push(currentChunk.trimEnd());
    }

    return chunks.length > 0 ? chunks : [prefix + text];
  }

  /**
   * Split by words (last resort)
   */
  private static splitByWord(
    text: string,
    maxLength: number,
    prefix: string
  ): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk = prefix;

    for (const word of words) {
      const wordWithSpace = word + ' ';

      // If single word is too long, force split
      if (wordWithSpace.length > maxLength - prefix.length) {
        if (currentChunk.length > prefix.length) {
          chunks.push(currentChunk.trimEnd());
        }

        // Split long word into character chunks
        for (let i = 0; i < word.length; i += maxLength - prefix.length) {
          chunks.push(prefix + word.substring(i, i + maxLength - prefix.length));
        }
        currentChunk = prefix;
        continue;
      }

      if (currentChunk.length + wordWithSpace.length > maxLength) {
        chunks.push(currentChunk.trimEnd());
        currentChunk = prefix + wordWithSpace;
      } else {
        currentChunk += wordWithSpace;
      }
    }

    if (currentChunk.length > prefix.length) {
      chunks.push(currentChunk.trimEnd());
    }

    return chunks.length > 0 ? chunks : [prefix + text];
  }

  /**
   * Send split messages to Discord channel
   */
  static async sendSplit(
    message: Message,
    text: string,
    options: SplitOptions & { asReply?: boolean; delay?: number } = {}
  ): Promise<void> {
    const { asReply = true, delay = 500, ...splitOptions } = options;
    const chunks = this.split(text, splitOptions);

    for (let i = 0; i < chunks.length; i++) {
      try {
        // Add chunk indicator for long messages
        let content = chunks[i];
        if (chunks.length > 1) {
          const indicator = `\n\n*[${i + 1}/${chunks.length}]*`;
          if (content.length + indicator.length <= this.DISCORD_MAX_LENGTH) {
            content += indicator;
          }
        }

        if (i === 0 && asReply) {
          await message.reply(content);
        } else {
          await message.channel.send(content);
        }

        // Add small delay between messages to avoid rate limits
        if (i < chunks.length - 1 && delay > 0) {
          await this.sleep(delay);
        }
      } catch (error) {
        console.error(`Failed to send chunk ${i + 1}:`, error);
        throw error;
      }
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}