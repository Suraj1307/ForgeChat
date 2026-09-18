import {
  createOpenAIResponse,
  normalizeOpenAIErrorMessage,
  streamOpenAIResponse,
} from "../utils/openai.js";
import { normalizeIncomingAttachment } from "../utils/attachments.js";
import { createAppError } from "../utils/appError.js";
import { normalizeMessage, normalizePaginationLimit, normalizeThreadId } from "../utils/requestValidation.js";
import {
  appendAssistantReply,
  createOrUpdateThreadWithUserMessage,
  deleteThreadForUser,
  getThreadMessagesForUser,
  listThreadsForUser,
} from "../services/threadService.js";

const sendSse = (res, payload) => {
  if (!res.writableEnded && !res.destroyed) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
};

const buildMessagesForModel = (thread, normalizedAttachment) => {
  if (!normalizedAttachment?.processingAttachment || !thread.messages.length) {
    return thread.messages.slice(-10);
  }

  return [
    ...thread.messages.slice(0, -1),
    {
      ...thread.messages.at(-1),
      attachments: [normalizedAttachment.processingAttachment],
    },
  ].slice(-10);
};

const listThreads = async (req, res) => {
  const limit = normalizePaginationLimit(req.query.limit, 50, 100);
  const threads = await listThreadsForUser(req.userId, limit);
  res.json(threads);
};

const getThreadMessages = async (req, res) => {
  const threadId = normalizeThreadId(req.params.threadId);
  const messages = await getThreadMessagesForUser(req.userId, threadId);
  res.json(messages);
};

const deleteThread = async (req, res) => {
  const threadId = normalizeThreadId(req.params.threadId);
  await deleteThreadForUser(req.userId, threadId);
  res.json({ success: "Thread deleted successfully" });
};

const createChat = async (req, res) => {
  const threadId = normalizeThreadId(req.body?.threadId);
  const message = normalizeMessage(req.body?.message);
  const normalizedAttachment = await normalizeIncomingAttachment(req.body?.attachment);
  const thread = await createOrUpdateThreadWithUserMessage(
    req.userId,
    threadId,
    message,
    normalizedAttachment?.storedAttachment || null
  );

  try {
    const assistantReply = await createOpenAIResponse(buildMessagesForModel(thread, normalizedAttachment));
    await appendAssistantReply(thread, assistantReply);
    res.json({ reply: assistantReply });
  } catch (error) {
    throw createAppError(
      502,
      normalizeOpenAIErrorMessage(error.message || "AI Processing Failed"),
      "OPENAI_ERROR"
    );
  }
};

const streamChat = async (req, res) => {
  const threadId = normalizeThreadId(req.body?.threadId);
  const message = normalizeMessage(req.body?.message);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  sendSse(res, { type: "status", status: "Connected. Preparing your request..." });

  const streamController = new AbortController();
  let clientDisconnected = false;
  const handleClientDisconnect = () => {
    if (!res.writableEnded && !res.destroyed) {
      clientDisconnected = true;
      streamController.abort(new Error("Client disconnected."));
    }
  };

  req.on("aborted", handleClientDisconnect);
  res.on("close", handleClientDisconnect);

  try {
    const normalizedAttachment = await normalizeIncomingAttachment(req.body?.attachment);

    if (normalizedAttachment) {
      const statusMessage =
        normalizedAttachment.processingAttachment.kind === "image"
          ? "Analyzing attached image..."
          : normalizedAttachment.processingAttachment.kind === "pdf"
            ? "Reading attached PDF..."
            : normalizedAttachment.processingAttachment.kind === "docx"
              ? "Extracting DOCX text..."
              : "Preparing attachment...";
      sendSse(res, { type: "status", status: statusMessage });
    }

    const thread = await createOrUpdateThreadWithUserMessage(
      req.userId,
      threadId,
      message,
      normalizedAttachment?.storedAttachment || null
    );

    sendSse(res, { type: "status", status: "Thinking..." });

    const assistantReply = await streamOpenAIResponse(
      buildMessagesForModel(thread, normalizedAttachment),
      {
        onDelta: (delta) => sendSse(res, { type: "delta", delta }),
      },
      {
        signal: streamController.signal,
      }
    );

    if (!clientDisconnected) {
      await appendAssistantReply(thread, assistantReply);
      sendSse(res, { type: "done", reply: assistantReply });
    }
  } catch (error) {
    if (!clientDisconnected) {
      sendSse(res, {
        type: "error",
        message: normalizeOpenAIErrorMessage(error.message || "AI Processing Failed"),
      });
    }
  } finally {
    req.off("aborted", handleClientDisconnect);
    res.off("close", handleClientDisconnect);
    if (!res.writableEnded) {
      res.end();
    }
  }
};

export { createChat, deleteThread, getThreadMessages, listThreads, streamChat };
