import { GoogleGenAI } from "@google/genai";
import env from "../config/env.js";

const systemInstruction =
  "You are ForgeChat, a helpful AI assistant. Use the conversation history provided to maintain context.";
const allowedRoles = new Set(["user", "model"]);
let client;

const getClient = () => {
  if (!env.geminiApiKey) {
    throw new Error("Gemini service is not configured.");
  }

  client ||= new GoogleGenAI({ apiKey: env.geminiApiKey });
  return client;
};

const normalizeRole = (role, fallback = "user") => {
  const normalizedRole = String(role || "").trim().toLowerCase();

  if (["assistant", "gpt", "bot", "model"].includes(normalizedRole)) {
    return "model";
  }

  if (["system", "developer"].includes(normalizedRole)) {
    return "user";
  }

  if (["human", "client", "user"].includes(normalizedRole)) {
    return "user";
  }

  return allowedRoles.has(normalizedRole) ? normalizedRole : fallback;
};

const dataUrlToInlineData = (dataUrl, mimeType) => {
  const value = String(dataUrl || "");
  const commaIndex = value.indexOf(",");

  if (value.startsWith("data:") && commaIndex > 0) {
    return {
      mimeType: value.slice(5, commaIndex).split(";")[0] || mimeType,
      data: value.slice(commaIndex + 1),
    };
  }

  return value ? { mimeType, data: value } : null;
};

const attachmentToParts = (attachment) => {
  const parts = [];
  const text = String(attachment?.textContent || "").trim();

  if (text) {
    parts.push({ text: `Attachment: ${attachment.name}\nType: ${attachment.mimeType}\nContent:\n${text}` });
  }

  if (attachment?.kind === "image" && attachment.previewUrl) {
    const inlineData = dataUrlToInlineData(attachment.previewUrl, attachment.mimeType || "image/jpeg");
    if (inlineData) parts.push({ inlineData });
  }

  if (["pdf", "docx"].includes(attachment?.kind) && attachment.fileData) {
    parts.push({
      inlineData: {
        mimeType: attachment.mimeType,
        data: attachment.fileData,
      },
    });
  }

  return parts;
};

const toGeminiContents = (messages = []) =>
  messages
    .map((message) => {
      const parts = [];
      const text = String(message?.content || "").trim();

      if (text) parts.push({ text });
      parts.push(...(message?.attachments?.flatMap(attachmentToParts) || []));

      return {
        role: normalizeRole(message?.role),
        parts,
      };
    })
    .filter((message) => message.parts.length > 0);

const getText = (response) => {
  const text = response?.text;
  if (typeof text === "string" && text.trim()) return text.trim();
  throw new Error("Gemini returned an empty response.");
};

const normalizeGeminiError = (error) => {
  const message = String(error?.message || error || "").toLowerCase();

  if (message.includes("api key") || message.includes(" unauthenticated") || message.includes("permission")) {
    return { message: "The Gemini service is not configured correctly.", code: "GEMINI_AUTH_ERROR" };
  }

  if (message.includes("quota") || message.includes("rate limit") || message.includes("resource exhausted")) {
    return { message: "ForgeChat is busy right now. Please try again in a moment.", code: "GEMINI_RATE_LIMIT" };
  }

  if (message.includes("abort") || message.includes("timeout")) {
    return { message: "The AI service timed out. Please try again.", code: "GEMINI_TIMEOUT" };
  }

  return { message: "The AI service is temporarily unavailable. Please try again shortly.", code: "GEMINI_ERROR" };
};

const createRequestConfig = (signal) => ({
  systemInstruction,
  abortSignal: signal,
});

const withTimeout = (externalSignal) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Gemini request timed out.")), env.geminiTimeoutMs);
  const abort = () => controller.abort(externalSignal?.reason);

  if (externalSignal) {
    if (externalSignal.aborted) abort();
    else externalSignal.addEventListener("abort", abort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abort);
    },
  };
};

const runWithRetry = async (operation, externalSignal) => {
  let lastError;

  for (let attempt = 0; attempt <= env.geminiMaxRetries; attempt += 1) {
    const timeout = withTimeout(externalSignal);

    try {
      return await operation(timeout.signal);
    } catch (error) {
      lastError = error;
      if (timeout.signal.aborted || attempt >= env.geminiMaxRetries) throw error;
    } finally {
      timeout.cleanup();
    }
  }

  throw lastError;
};

const generateResponse = async (messages) => {
  try {
    const response = await runWithRetry(
      (signal) =>
        getClient().models.generateContent({
          model: env.geminiModel,
          contents: toGeminiContents(messages),
          config: createRequestConfig(signal),
        }),
    );

    return getText(response);
  } catch (error) {
    const normalized = normalizeGeminiError(error);
    const serviceError = new Error(normalized.message);
    serviceError.code = normalized.code;
    serviceError.statusCode = normalized.code === "GEMINI_AUTH_ERROR" ? 503 : 502;
    throw serviceError;
  }
};

const streamResponse = async (messages, handlers = {}, options = {}) => {
  try {
    const stream = await runWithRetry(
      (signal) =>
        getClient().models.generateContentStream({
          model: env.geminiModel,
          contents: toGeminiContents(messages),
          config: createRequestConfig(signal),
        }),
      options.signal,
    );
    let accumulated = "";

    for await (const chunk of stream) {
      const text = typeof chunk?.text === "string" ? chunk.text : "";
      if (text) {
        accumulated += text;
        handlers.onDelta?.(text);
      }
    }

    if (!accumulated.trim()) throw new Error("Gemini returned an empty response.");
    return accumulated.trim();
  } catch (error) {
    const normalized = normalizeGeminiError(error);
    const serviceError = new Error(normalized.message);
    serviceError.code = normalized.code;
    serviceError.statusCode = normalized.code === "GEMINI_AUTH_ERROR" ? 503 : 502;
    throw serviceError;
  }
};

export { generateResponse, normalizeRole, streamResponse, toGeminiContents };
