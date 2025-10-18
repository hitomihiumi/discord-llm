import { config } from "../config";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export class ConversationManager {
  private conversations: Map<string, Message[]> = new Map();

  addMessage(userId: string, message: Omit<Message, "timestamp">): void {
    const conversation = this.conversations.get(userId) || [];

    conversation.push({
      ...message,
      timestamp: Date.now(),
    });

    // Keep only last N messages
    if (conversation.length > config.conversation.maxHistoryLength) {
      conversation.shift();
    }

    this.conversations.set(userId, conversation);
  }

  getHistory(userId: string): Array<{ role: string; content: string }> {
    const conversation = this.conversations.get(userId) || [];
    const now = Date.now();

    // Filter out expired messages
    const validMessages = conversation.filter(
      (msg) => now - msg.timestamp < config.conversation.historyTTL,
    );

    // Update conversation
    if (validMessages.length !== conversation.length) {
      this.conversations.set(userId, validMessages);
    }

    return validMessages.map(({ role, content }) => ({ role, content }));
  }

  clearHistory(userId: string): void {
    this.conversations.delete(userId);
  }

  // Clean up expired conversations
  cleanup(): void {
    const now = Date.now();
    for (const [userId, messages] of this.conversations.entries()) {
      const validMessages = messages.filter(
        (msg) => now - msg.timestamp < config.conversation.historyTTL,
      );

      if (validMessages.length === 0) {
        this.conversations.delete(userId);
      } else if (validMessages.length !== messages.length) {
        this.conversations.set(userId, validMessages);
      }
    }
  }
}
