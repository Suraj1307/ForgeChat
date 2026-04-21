import "dotenv/config";

const OPENAI_API_BASE = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.1";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 45000);
const OPENAI_MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES || 1);
const OPENAI_REASONING_EFFORT = String(process.env.OPENAI_REASONING_EFFORT || "").trim();

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

const buildAttachmentTextPart = (attachment) => ({
  type: "input_text",
  text: `Attachment: ${attachment.name}\nType: ${attachment.mimeType}\nContent:\n${attachment.textContent}`,
});

const attachmentToOpenAIParts = (attachment) => {
  if (attachment.kind === "image" && attachment.previewUrl) {
    return [
      {
        type: "input_image",
        image_url: attachment.previewUrl,
        detail: "auto",
      },
    ];
  }

  if ((attachment.kind === "pdf" || attachment.kind === "docx") && attachment.fileData) {
    return [
      {
        type: "input_file",
        filename: attachment.name,
        file_data: attachment.fileData,
      },
    ];
  }

  if (attachment.textContent) {
    return [buildAttachmentTextPart(attachment)];
  }

  return [];
};

const buildOpenAIMessage = (message) => {
  const normalizedRole = normalizeRole(message?.role);
  const text = String(message?.content || "").trim();
  const content = [
    ...(text ? [{ type: "input_text", text }] : []),
    ...(message.attachments?.flatMap(attachmentToOpenAIParts) || []),
  ];

  return {
    role: normalizedRole,
    content,
  };
};

const sanitizeMessagesForModel = (messages = []) =>
  messages
    .map(buildOpenAIMessage)
    .filter((message) => message.content.length > 0);

const buildRequestBody = (messages, stream = false) => {
  const body = {
    model: OPENAI_MODEL,
    instructions: systemInstruction,
    input: sanitizeMessagesForModel(messages),
    stream,
  };

  if (OPENAI_REASONING_EFFORT) {
    body.reasoning = { effort: OPENAI_REASONING_EFFORT };
  }

  return body;
};

const getOpenAIApiKey = () => {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in Backend/.env");
  }
  return apiKey;
};

const normalizeOpenAIErrorMessage = (message = "") => {
  const text = String(message || "").trim();
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("rate limit") ||
    lowerText.includes("too many requests") ||
    lowerText.includes("quota") ||
    lowerText.includes("insufficient_quota")
  ) {
    return "ForgeChat is busy right now. Please try again in a moment.";
  }

  if (
    lowerText.includes("server had an error") ||
    lowerText.includes("temporarily unavailable") ||
    lowerText.includes("overloaded")
  ) {
    return "The AI service is temporarily unavailable. Please try again shortly.";
  }

  if (lowerText.includes("incorrect api key") || lowerText.includes("invalid api key")) {
    return "The OpenAI API key is invalid. Update OPENAI_API_KEY in Backend/.env.";
  }

  return text || "OpenAI request failed.";
};

const extractOpenAIErrorMessage = async (response) => {
  const text = await response.text();

  try {
    const data = JSON.parse(text);
    return normalizeOpenAIErrorMessage(data.error?.message || text);
  } catch {
    return normalizeOpenAIErrorMessage(text);
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
    () => controller.abort(new Error("OpenAI request timed out.")),
    OPENAI_TIMEOUT_MS
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

const postToOpenAI = async (messages, stream, options = {}) => {
  let lastError;

  for (let attempt = 0; attempt <= OPENAI_MAX_RETRIES; attempt += 1) {
    const { signal, cleanup } = createAbortSignal(options.signal);

    try {
      const response = await fetch(OPENAI_API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getOpenAIApiKey()}`,
        },
        body: JSON.stringify(buildRequestBody(messages, stream)),
        signal,
      });

      cleanup();

      if (!response.ok && attempt < OPENAI_MAX_RETRIES && shouldRetryResponse(response)) {
        lastError = new Error(await extractOpenAIErrorMessage(response));
        continue;
      }

      if (!response.ok) {
        throw new Error(await extractOpenAIErrorMessage(response));
      }

      return response;
    } catch (error) {
      cleanup();
      if (error.name === "AbortError") {
        lastError = options.signal?.aborted
          ? new Error("OpenAI request aborted.")
          : new Error("OpenAI request timed out.");
      } else {
        lastError = error;
      }

      if (attempt >= OPENAI_MAX_RETRIES) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("OpenAI request failed.");
};

const extractTextFromOpenAIResponse = (payload) => {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  return (
    payload?.output
      ?.flatMap((item) => item?.content || [])
      ?.filter((part) => typeof part?.text === "string")
      ?.map((part) => part.text)
      ?.join("") || ""
  );
};

const createOpenAIResponse = async (messages) => {
  const response = await postToOpenAI(messages, false);
  const data = await response.json();

  return extractTextFromOpenAIResponse(data) || "I couldn't generate a response.";
};

const streamOpenAIResponse = async (messages, handlers = {}, options = {}) => {
  const response = await postToOpenAI(messages, true, options);

  if (!response.body) {
    throw new Error("Streaming is unavailable for this response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let completedReply = "";
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

    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      accumulated += event.delta;
      handlers.onDelta?.(event.delta);
      return;
    }

    if (event.type === "response.completed") {
      completedReply = extractTextFromOpenAIResponse(event.response);
      return;
    }

    if (event.type === "response.failed") {
      throw new Error(
        normalizeOpenAIErrorMessage(event.response?.error?.message || "OpenAI response failed.")
      );
    }

    if (event.type === "error") {
      throw new Error(
        normalizeOpenAIErrorMessage(event.error?.message || event.message || "OpenAI request failed.")
      );
    }
  };

  while (true) {
    const { value, done } = await reader.read();

    buffer += decoder.decode(value, { stream: !done });
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

  return completedReply || accumulated || "I couldn't generate a response.";
};

export {
  createOpenAIResponse,
  normalizeOpenAIErrorMessage,
  normalizeRole,
  sanitizeMessagesForModel,
  streamOpenAIResponse,
};
