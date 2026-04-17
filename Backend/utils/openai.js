import "dotenv/config";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 45000);
const OPENAI_MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES || 1);

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

const attachmentToInputParts = (attachment) => {
  if (attachment.kind === "image" && attachment.previewUrl) {
    return [
      {
        type: "input_image",
        image_url: attachment.previewUrl,
      },
    ];
  }

  if (attachment.kind === "pdf" && attachment.fileData) {
    return [
      {
        type: "input_file",
        filename: attachment.name,
        file_data: `data:${attachment.mimeType || "application/pdf"};base64,${attachment.fileData}`,
      },
    ];
  }

  if (attachment.textContent) {
    return [
      {
        type: "input_text",
        text: `Attachment: ${attachment.name}\nType: ${attachment.mimeType}\nContent:\n${attachment.textContent}`,
      },
    ];
  }

  return [];
};

const buildInputMessage = (message) => {
  const role = normalizeRole(message?.role);
  const textType = role === "assistant" ? "output_text" : "input_text";
  const text = String(message?.content || "").trim();
  const content = [
    ...(text
      ? [
          {
            type: textType,
            text,
          },
        ]
      : []),
    ...(message.attachments?.flatMap(attachmentToInputParts) || []),
  ];

  return { role, content };
};

const sanitizeMessagesForModel = (messages = []) =>
  messages
    .map(buildInputMessage)
    .filter((message) => message.content.length > 0)
    .map((message) => ({
      role: normalizeRole(message.role),
      content: message.content,
    }));

const buildRequestBody = (messages, stream = false) => ({
  model: OPENAI_MODEL,
  instructions: systemInstruction,
  input: sanitizeMessagesForModel(messages),
  stream,
});

const parseOpenAIError = async (response) => {
  const text = await response.text();

  try {
    const data = JSON.parse(text);
    return data.error?.message || "OpenAI request failed.";
  } catch {
    return text || "OpenAI request failed.";
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

  const timeout = setTimeout(() => controller.abort(new Error("OpenAI request timed out.")), OPENAI_TIMEOUT_MS);

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
      const response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(buildRequestBody(messages, stream)),
        signal,
      });

      cleanup();

      if (!response.ok && attempt < OPENAI_MAX_RETRIES && shouldRetryResponse(response)) {
        lastError = new Error(await parseOpenAIError(response));
        continue;
      }

      if (!response.ok) {
        throw new Error(await parseOpenAIError(response));
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

const createOpenAIResponse = async (messages) => {
  const response = await postToOpenAI(messages, false);

  const data = await response.json();
  return data.output_text || "I couldn't generate a response.";
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

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const eventChunk of events) {
      const lines = eventChunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, ""));

      if (!lines.length) continue;

      const payload = lines.join("\n");
      if (payload === "[DONE]") continue;

      const event = JSON.parse(payload);

      if (event.type === "response.output_text.delta") {
        accumulated += event.delta;
        handlers.onDelta?.(event.delta, accumulated);
      }

      if (event.type === "error") {
        throw new Error(event.error?.message || "Streaming failed.");
      }
    }
  }

  handlers.onDone?.(accumulated);
  return accumulated;
};

export { createOpenAIResponse, normalizeRole, sanitizeMessagesForModel, streamOpenAIResponse };
