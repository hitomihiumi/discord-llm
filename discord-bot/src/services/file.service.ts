import axios from "axios";
import { Attachment, Collection } from "discord.js";
import { logger } from "../utils/logger";

export class FileService {
  private readonly MAX_FILE_SIZE = 1024 * 1024; // 1MB
  private readonly ALLOWED_EXTENSIONS = [".txt", ".log"];
  private readonly MAX_CONTENT_LENGTH = 10000; // 10k characters

  /**
   * Check if attachment is a text/log file
   */
  isTextFile(attachment: Attachment): boolean {
    const extension = this.getExtension(attachment.name);
    return this.ALLOWED_EXTENSIONS.includes(extension);
  }

  /**
   * Download and read text file content
   */
  async readTextFile(attachment: Attachment): Promise<string | null> {
    try {
      // Check file size
      if (attachment.size > this.MAX_FILE_SIZE) {
        logger.warn(`File too large: ${attachment.name} (${attachment.size} bytes)`);
        return `[Файл ${attachment.name} слишком большой. Максимум: 1MB]`;
      }

      // Check extension
      if (!this.isTextFile(attachment)) {
        return null;
      }

      logger.info(`Downloading file: ${attachment.name}`);

      // Download file
      const response = await axios.get(attachment.url, {
        timeout: 10000,
        responseType: "text",
        maxContentLength: this.MAX_FILE_SIZE,
      });

      let content = response.data;

      // Truncate if too long
      if (content.length > this.MAX_CONTENT_LENGTH) {
        content = content.substring(content.length - this.MAX_CONTENT_LENGTH, content.length);
        content += `\n\n[... файл обрезан, показаны последние ${this.MAX_CONTENT_LENGTH} символов]`;
      }

      logger.info(`Successfully read file: ${attachment.name} (${content.length} chars)`);

      return `--- Содержимое файла: ${attachment.name} ---\n${content}\n--- Конец файла ---`;
    } catch (error: any) {
      logger.error(`Failed to read file ${attachment.name}:`, error.message);
      return `[Не удалось прочитать файл ${attachment.name}]`;
    }
  }

  /**
   * Process all attachments from a message
   */
  async processAttachments(attachments: Collection<string, Attachment>): Promise<string> {
    const contents: string[] = [];

    for (const [, attachment] of attachments) {
      if (this.isTextFile(attachment)) {
        const content = await this.readTextFile(attachment);
        if (content) {
          contents.push(content);
        }
      }
    }

    if (contents.length === 0) {
      return "";
    }

    return "\n\n" + contents.join("\n\n");
  }

  /**
   * Get file extension
   */
  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return "";
    return filename.substring(lastDot).toLowerCase();
  }

  /**
   * Format file info for display
   */
  formatFileInfo(attachments: Collection<string, Attachment>): string {
    const textFiles = Array.from(attachments.values()).filter((att) => this.isTextFile(att));

    if (textFiles.length === 0) {
      return "";
    }

    const fileList = textFiles.map((f) => `📎 ${f.name} (${this.formatSize(f.size)})`).join("\n");
    return `\n\n**Прикреплённые файлы:**\n${fileList}`;
  }

  /**
   * Format file size
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }
}
