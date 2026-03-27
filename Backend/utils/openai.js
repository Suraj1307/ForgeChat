import "dotenv/config";

const OPENAI_URL = "https://api.openai.com/v1/responses";

const systemInstruction =
  "You are ForgeChat, a helpful AI assistant. Use the conversation history provided to maintain context.";

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
  const role = message.role === "system" ? "developer" : message.role;
  const textType = role === "assistant" ? "output_text" : "input_text";
  const content = [
    {
      type: textType,
      text: message.content,
    },
    ...(message.attachments?.flatMap(attachmentToInputParts) || []),
  ];

  return { role, content };
};

const buildRequestBody = (messages, stream = false) => ({
  model: "gpt-4o-mini",
  instructions: systemInstruction,
  input: messages.map(buildInputMessage),
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

const createOpenAIResponse = async (messages) => {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(buildRequestBody(messages, false)),
  });

  if (!response.ok) {
    throw new Error(await parseOpenAIError(response));
  }

  const data = await response.json();
  return data.output_text || "I couldn't generate a response.";
};

const streamOpenAIResponse = async (messages, handlers = {}) => {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(buildRequestBody(messages, true)),
  });

  if (!response.ok) {
    throw new Error(await parseOpenAIError(response));
  }

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

export { createOpenAIResponse, streamOpenAIResponse };
