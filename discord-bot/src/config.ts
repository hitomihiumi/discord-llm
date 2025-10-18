import dotenv from "dotenv";

dotenv.config();

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || "",
  },
  llm: {
    apiUrl: process.env.LLM_API_URL || "http://llm-service:8000",
  },
  rag: {
    apiUrl: process.env.RAG_API_URL || "http://embedding-service:8001",
  },
  security: {
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || "60000"),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "5"),
    maxInputLength: parseInt(process.env.MAX_INPUT_LENGTH || "2000"),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "1048576"), // 1MB
  },
  conversation: {
    maxHistoryLength: parseInt(process.env.MAX_HISTORY_LENGTH || "10"),
    historyTTL: parseInt(process.env.HISTORY_TTL || "3600000"), // 1 hour
  },
  logging: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
    debugWebhook: process.env.LOG_DEBUG_TO_WEBHOOK === "true",
    logQueries: process.env.LOG_QUERIES === "true",
    logResponses: process.env.LOG_RESPONSES === "true",
    logErrors: process.env.LOG_ERRORS !== "false", // enabled by default
    logSecurity: process.env.LOG_SECURITY !== "false", // enabled by default
  },
};
