import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),

  wx: {
    appid: process.env.WX_APPID || '',
    secret: process.env.WX_SECRET || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jinying_property',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  fastgpt: {
    baseUrl: process.env.FASTGPT_BASE_URL || 'http://localhost:3000/api/v1',
    apiKey: process.env.FASTGPT_API_KEY || '',
  },

  // 报修字段提取用的LLM（通用OpenAI兼容接口，不绑定特定厂商）
  // 优先级：llm > fastgpt（llm直连更快，fastgpt走RAG约8-9秒）
  // 兼容：通义千问/DeepSeek/智谱GLM/OpenAI/Kimi/任何兼容 /v1/chat/completions 的服务
  llm: {
    baseUrl: process.env.LLM_BASE_URL || '',           // 如 https://dashscope.aliyuncs.com/compatible-mode/v1
    apiKey: process.env.LLM_API_KEY || '',             // 如 sk-xxx
    model: process.env.LLM_MODEL || '',                // 如 qwen-max / deepseek-chat / glm-4 / gpt-4o-mini
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '500', 10),   // 输出限制（token数）
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.1'),  // 0-2，越低越确定
    timeout: parseInt(process.env.LLM_TIMEOUT || '15000', 10),     // 请求超时（毫秒）
  },

  funasr: {
    baseUrl: process.env.FUNASR_BASE_URL || 'http://localhost:8000',
  },

  tencentCloud: {
    secretId: process.env.TENCENT_CLOUD_SECRET_ID || '',
    secretKey: process.env.TENCENT_CLOUD_SECRET_KEY || '',
  },

  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    accessKey: process.env.MINIO_ACCESS_KEY || 'fastgpt_minio',
    secretKey: process.env.MINIO_SECRET_KEY || 'fastgpt_minio_secret_2026',
    bucket: process.env.MINIO_BUCKET || 'jinying-repair',
  },

  workOrder: {
    apiUrl: process.env.WORK_ORDER_API_URL || '',
    apiKey: process.env.WORK_ORDER_API_KEY || '',
  },
};

export type Config = typeof config;
