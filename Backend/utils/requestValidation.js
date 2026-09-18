import { createAppError } from "./appError.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const THREAD_ID_PATTERN = /^[a-zA-Z0-9-]{8,120}$/;

const ensurePlainObject = (value, fieldName = "payload") => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createAppError(400, `Invalid ${fieldName}.`, "INVALID_PAYLOAD");
  }

  return value;
};

const readTrimmedString = (value, fieldName, options = {}) => {
  if (typeof value !== "string") {
    throw createAppError(400, `${fieldName} is required.`, "INVALID_INPUT");
  }

  const normalized = value.trim();

  if (!normalized) {
    throw createAppError(400, `${fieldName} is required.`, "INVALID_INPUT");
  }

  if (options.maxLength && normalized.length > options.maxLength) {
    throw createAppError(400, `${fieldName} is too long.`, "INVALID_INPUT");
  }

  return normalized;
};

const readOptionalString = (value, maxLength = 0) => {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw createAppError(400, "Invalid input.", "INVALID_INPUT");
  }

  const normalized = value.trim();
  return maxLength ? normalized.slice(0, maxLength) : normalized;
};

const normalizeEmail = (value) => {
  const email = readTrimmedString(value, "Email", { maxLength: 320 }).toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw createAppError(400, "Enter a valid email address.", "INVALID_EMAIL");
  }

  return email;
};

const normalizePassword = (value, minLength = 8) => {
  if (typeof value !== "string" || !value) {
    throw createAppError(400, "Password is required.", "INVALID_PASSWORD");
  }

  if (value.length < minLength) {
    throw createAppError(400, `Password must be at least ${minLength} characters.`, "INVALID_PASSWORD");
  }

  if (value.length > 128) {
    throw createAppError(400, "Password is too long.", "INVALID_PASSWORD");
  }

  return value;
};

const normalizeName = (value) => {
  const name = readTrimmedString(value, "Name", { maxLength: 80 });

  if (name.length < 2) {
    throw createAppError(400, "Name should be at least 2 characters.", "INVALID_NAME");
  }

  return name;
};

const normalizeThreadId = (value) => {
  const threadId = readTrimmedString(value, "Thread ID", { maxLength: 120 });

  if (!THREAD_ID_PATTERN.test(threadId)) {
    throw createAppError(400, "Invalid thread ID.", "INVALID_THREAD_ID");
  }

  return threadId;
};

const normalizeMessage = (value) => readTrimmedString(value, "Message", { maxLength: 12000 });

const normalizePaginationLimit = (value, fallback = 50, max = 100) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.trunc(parsed)));
};

export {
  ensurePlainObject,
  normalizeEmail,
  normalizeMessage,
  normalizeName,
  normalizePaginationLimit,
  normalizePassword,
  normalizeThreadId,
  readOptionalString,
};
