import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toTrimmedString = (value) => String(value || "").trim();

const toOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const env = {
  nodeEnv: toTrimmedString(process.env.NODE_ENV) || "development",
  port: toNumber(process.env.PORT, 5000),
  jwtSecret: toTrimmedString(process.env.JWT_SECRET),
  mongoUri: toTrimmedString(process.env.MONGODB_URI),
  mongoFallbackUri: toTrimmedString(process.env.MONGODB_URI_FALLBACK),
  mongoServerSelectionTimeoutMs: toNumber(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 15000),
  mongoConnectTimeoutMs: toNumber(process.env.MONGODB_CONNECT_TIMEOUT_MS, 15000),
  mongoReconnectDelayMs: toNumber(process.env.MONGODB_RECONNECT_DELAY_MS, 15000),
  openAIApiKey: toTrimmedString(process.env.OPENAI_API_KEY),
  openAIModel: toTrimmedString(process.env.OPENAI_MODEL) || "gpt-5.1",
  openAITimeoutMs: toNumber(process.env.OPENAI_TIMEOUT_MS, 45000),
  openAIMaxRetries: Math.max(0, Number(process.env.OPENAI_MAX_RETRIES || 1)),
  openAIReasoningEffort: toTrimmedString(process.env.OPENAI_REASONING_EFFORT),
  corsOrigins: toOrigins(process.env.CORS_ORIGIN),
};

const missing = [];

if (!env.jwtSecret) {
  missing.push("JWT_SECRET");
}

if (!env.mongoUri && !env.mongoFallbackUri) {
  missing.push("MONGODB_URI or MONGODB_URI_FALLBACK");
}

if (missing.length) {
  throw new Error(`Invalid environment configuration: ${missing.join(", ")}`);
}

export default env;
