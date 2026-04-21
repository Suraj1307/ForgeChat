import express from "express";
import Thread from "../models/Thread.js";
import {
  createOpenAIResponse,
  normalizeOpenAIErrorMessage,
  streamOpenAIResponse,
} from "../utils/openai.js";
import auth from "../utils/auth.js";
import { normalizeIncomingAttachment } from "../utils/attachments.js";

const router = express.Router();

const sendSse = (res, payload) => {
  if (res.writableEnded || res.destroyed) {
    return;
  }
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const buildMessagesForModel = (thread, normalizedAttachment) => {
  if (!normalizedAttachment?.processingAttachment || !thread.messages.length) {
    return thread.messages.slice(-10);
  }

  const messagesForModel = [
    ...thread.messages.slice(0, -1),
    {
      ...thread.messages.at(-1),
      attachments: [normalizedAttachment.processingAttachment],
    },
  ];

  return messagesForModel.slice(-10);
};

const createOrUpdateThreadWithUserMessage = async (reqUserId, threadId, message, attachment) => {
  let thread = await Thread.findOne({ threadId, userId: reqUserId });
  const attachments = attachment ? [attachment] : [];

  const newUserMessage = {
    role: "user",
    content: message,
    attachments,
  };

  if (!thread) {
    thread = new Thread({
      threadId,
      userId: reqUserId,
      title: message.length > 35 ? `${message.substring(0, 35)}...` : message,
      messages: [newUserMessage],
    });
  } else {
    thread.messages.push(newUserMessage);
  }

  thread.updatedAt = new Date();
  await thread.save();
  return thread;
};

router.post("/test", auth, async (req, res) => {
  try {
    const thread = new Thread({
      threadId: `test-${Date.now()}`,
      userId: req.userId,
      title: "Test Thread",
      messages: [{ role: "assistant", content: "Test successful! Database is connected." }],
    });

    const response = await thread.save();
    res.status(201).send(response);
  } catch (err) {
    console.error("Test Route Error:", err);
    res.status(500).json({ error: "Failed to save in DB" });
  }
});

router.get("/thread", auth, async (req, res) => {
  try {
    const threads = await Thread.find({ userId: req.userId })
      .select("threadId title updatedAt")
      .sort({ updatedAt: -1 });

    res.json(threads);
  } catch (err) {
    console.error("Fetch Threads Error:", err);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

router.get("/thread/:threadId", auth, async (req, res) => {
  const { threadId } = req.params;
  try {
    const thread = await Thread.findOne({ threadId, userId: req.userId });

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json(thread.messages);
  } catch (err) {
    console.error("Fetch Single Thread Error:", err);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

router.delete("/thread/:threadId", auth, async (req, res) => {
  const { threadId } = req.params;
  try {
    const deletedThread = await Thread.findOneAndDelete({ threadId, userId: req.userId });

    if (!deletedThread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.status(200).json({ success: "Thread deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: "Failed to delete thread" });
  }
});

router.post("/chat", auth, async (req, res) => {
  const { threadId, message, attachment } = req.body;

  if (!threadId || !String(message || "").trim()) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const normalizedAttachment = await normalizeIncomingAttachment(attachment);
    const thread = await createOrUpdateThreadWithUserMessage(
      req.userId,
      threadId,
      String(message).trim(),
      normalizedAttachment?.storedAttachment || null
    );

    const assistantReply = await createOpenAIResponse(buildMessagesForModel(thread, normalizedAttachment));
    thread.messages.push({ role: "assistant", content: assistantReply });
    thread.updatedAt = new Date();
    await thread.save();

    res.json({ reply: assistantReply });
  } catch (err) {
    console.error("Chat Logic Error:", err);
    res.status(500).json({
      error: normalizeOpenAIErrorMessage(err.message || "AI Processing Failed"),
    });
  }
});

router.post("/chat/stream", auth, async (req, res) => {
  const { threadId, message, attachment } = req.body;

  if (!threadId || !String(message || "").trim()) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  sendSse(res, { type: "status", status: "Connected. Preparing your request..." });

  const streamController = new AbortController();
  let clientDisconnected = false;
  const handleClientDisconnect = () => {
    if (res.writableEnded || res.destroyed) {
      return;
    }
    clientDisconnected = true;
    streamController.abort(new Error("Client disconnected."));
  };

  req.on("aborted", handleClientDisconnect);
  res.on("close", handleClientDisconnect);

  try {
    const normalizedAttachment = await normalizeIncomingAttachment(attachment);
    const safeMessage = String(message).trim();

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
      safeMessage,
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

    if (clientDisconnected) {
      return;
    }

    thread.messages.push({ role: "assistant", content: assistantReply });
    thread.updatedAt = new Date();
    await thread.save();

    sendSse(res, { type: "done", reply: assistantReply });
  } catch (err) {
    if (!clientDisconnected) {
      console.error("Streaming Chat Error:", err);
    }
    if (!clientDisconnected) {
      sendSse(res, {
        type: "error",
        message: normalizeOpenAIErrorMessage(err.message || "AI Processing Failed"),
      });
    }
  } finally {
    req.off("aborted", handleClientDisconnect);
    res.off("close", handleClientDisconnect);
    if (!res.writableEnded) {
      res.end();
    }
  }
});

export default router;
