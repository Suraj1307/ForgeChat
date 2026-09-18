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

const toList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const env = {
  nodeEnv: toTrimmedString(process.env.NODE_ENV) || "development",
  port: toNumber(process.env.PORT, 5000),
  jwtSecret: toTrimmedString(process.env.JWT_SECRET),
  mongoUri: toTrimmedString(process.env.MONGODB_URI),
  mongoFallbackUri: toTrimmedString(process.env.MONGODB_URI_FALLBACK),
  mongoDnsServers: toList(process.env.MONGODB_DNS_SERVERS),
  mongoServerSelectionTimeoutMs: toNumber(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 15000),
  mongoConnectTimeoutMs: toNumber(process.env.MONGODB_CONNECT_TIMEOUT_MS, 15000),
  mongoReconnectDelayMs: toNumber(process.env.MONGODB_RECONNECT_DELAY_MS, 15000),
  geminiApiKey: toTrimmedString(process.env.GEMINI_API_KEY),
  geminiModel: toTrimmedString(process.env.GEMINI_MODEL) || "gemini-2.5-flash",
  geminiTimeoutMs: toNumber(process.env.GEMINI_TIMEOUT_MS, 45000),
  geminiMaxRetries: Math.max(0, Number(process.env.GEMINI_MAX_RETRIES || 1)),
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
