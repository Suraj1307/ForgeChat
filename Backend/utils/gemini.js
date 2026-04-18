import "dotenv/config";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 45000);
const GEMINI_MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES || 1);

const systemInstruction =
  "You are ForgeChat, a helpful AI assistant. Use the conversation history provided to maintain context.";
const ALLOWED_ROLES = new Set(["user", "assistant", "developer"]);

const normalizeRole = (role, fallback = "user") => {
  const normalizedRole = String(role || "").trim().toLowerCase();

  if (normalizedRole === "system") {
    return "developer";
  }

  if (normalizedRole === "gpt" || normalizedRole === "bot" || normalizedRole === "model") {
    return "assistant";
  }

  if (normalizedRole === "human" || normalizedRole === "client") {
    return "user";
  }

  if (ALLOWED_ROLES.has(normalizedRole)) {
    return normalizedRole;
  }

  return fallback;
};

const toGeminiRole = (role) => (normalizeRole(role) === "assistant" ? "model" : "user");

const extractBase64FromDataUrl = (value = "") => {
  const match = String(value).match(/^data:.*?;base64,(.+)$/);
  return match?.[1] || "";
};

const buildAttachmentTextPart = (attachment) => ({
  text: `Attachment: ${attachment.name}\nType: ${attachment.mimeType}\nContent:\n${attachment.textContent}`,
});

const attachmentToGeminiParts = (attachment) => {
  if (attachment.kind === "image" && attachment.previewUrl) {
    const data = extractBase64FromDataUrl(attachment.previewUrl);
    if (data) {
      return [
        {
          inline_data: {
            mime_type: attachment.mimeType || "image/jpeg",
            data,
          },
        },
      ];
    }
  }

  if (attachment.kind === "pdf" && attachment.fileData) {
    return [
      {
        inline_data: {
          mime_type: attachment.mimeType || "application/pdf",
          data: attachment.fileData,
        },
      },
    ];
  }

  if (attachment.textContent) {
    return [buildAttachmentTextPart(attachment)];
  }

  return [];
};

const buildGeminiMessage = (message) => {
  const normalizedRole = normalizeRole(message?.role);
  const text = String(message?.content || "").trim();
  const parts = [
    ...(text
      ? [
          {
            text:
              normalizedRole === "developer"
                ? `Follow this instruction for the conversation:\n${text}`
                : text,
          },
        ]
      : []),
    ...(message.attachments?.flatMap(attachmentToGeminiParts) || []),
  ];

  return {
    role: toGeminiRole(normalizedRole),
    parts,
  };
};

const sanitizeMessagesForModel = (messages = []) =>
  messages
    .map(buildGeminiMessage)
    .filter((message) => message.parts.length > 0);

const buildRequestBody = (messages) => ({
  system_instruction: {
    parts: [{ text: systemInstruction }],
  },
  contents: sanitizeMessagesForModel(messages),
});

const getGeminiApiKey = () => {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in Backend/.env");
  }
  return apiKey;
};

const parseGeminiError = async (response) => {
  const text = await response.text();

  try {
    const data = JSON.parse(text);
    return data.error?.message || "Gemini request failed.";
  } catch {
    return text || "Gemini request failed.";
  }
};

const shouldRetryResponse = (response) => response.status >= 500 || response.status === 429;

const createAbortSignal = (externalSignal) => {
  const controller = new AbortController();
  const abortWithReason = () => {
    try {
      controller.abort(externalSignal?.reason);
    } catch {
      controller.abort();
    }
  };

  const timeout = setTimeout(
    () => controller.abort(new Error("Gemini request timed out.")),
    GEMINI_TIMEOUT_MS
  );

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortWithReason();
    } else {
      externalSignal.addEventListener("abort", abortWithReason, { once: true });
    }
  }

  return {
    signal: controller.signal,
    timeout,
    cleanup() {
      clearTimeout(timeout);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", abortWithReason);
      }
    },
  };
};

const postToGemini = async (messages, stream, options = {}) => {
  let lastError;
  const endpoint = stream
    ? `${GEMINI_API_BASE}/${GEMINI_MODEL}:streamGenerateContent?alt=sse`
    : `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent`;

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
    const { signal, cleanup } = createAbortSignal(options.signal);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": getGeminiApiKey(),
        },
        body: JSON.stringify(buildRequestBody(messages)),
        signal,
      });

      cleanup();

      if (!response.ok && attempt < GEMINI_MAX_RETRIES && shouldRetryResponse(response)) {
        lastError = new Error(await parseGeminiError(response));
        continue;
      }

      if (!response.ok) {
        throw new Error(await parseGeminiError(response));
      }

      return response;
    } catch (error) {
      cleanup();
      if (error.name === "AbortError") {
        lastError = options.signal?.aborted
          ? new Error("Gemini request aborted.")
          : new Error("Gemini request timed out.");
      } else {
        lastError = error;
      }

      if (attempt >= GEMINI_MAX_RETRIES) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("Gemini request failed.");
};

const extractTextFromGeminiResponse = (payload) =>
  payload?.candidates
    ?.flatMap((candidate) => candidate?.content?.parts || [])
    ?.filter((part) => typeof part?.text === "string")
    ?.map((part) => part.text)
    ?.join("") || "";

const createGeminiResponse = async (messages) => {
  const response = await postToGemini(messages, false);
  const data = await response.json();

  return extractTextFromGeminiResponse(data) || "I couldn't generate a response.";
};

const streamGeminiResponse = async (messages, handlers = {}, options = {}) => {
  const response = await postToGemini(messages, true, options);

  if (!response.body) {
    throw new Error("Streaming is unavailable for this response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let eventDataLines = [];

  const flushEvent = () => {
    if (!eventDataLines.length) {
      return;
    }

    const payload = eventDataLines.join("\n").trim();
    eventDataLines = [];

    if (!payload || payload === "[DONE]") {
      return;
    }

    const event = JSON.parse(payload);
    const chunkText = extractTextFromGeminiResponse(event);

    if (!chunkText) {
      return;
    }

    const delta =
      accumulated && chunkText.startsWith(accumulated)
        ? chunkText.slice(accumulated.length)
        : chunkText;

    if (delta) {
      accumulated += delta;
      handlers.onDelta?.(delta, accumulated);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line) {
        flushEvent();
        continue;
      }

      if (line.startsWith("data:")) {
        eventDataLines.push(line.replace(/^data:\s?/, ""));
      }
    }

    if (done) {
      break;
    }
  }

  if (buffer.startsWith("data:")) {
    eventDataLines.push(buffer.replace(/^data:\s?/, ""));
  }
  flushEvent();

  handlers.onDone?.(accumulated);
  return accumulated;
};

export { createGeminiResponse, normalizeRole, sanitizeMessagesForModel, streamGeminiResponse };
