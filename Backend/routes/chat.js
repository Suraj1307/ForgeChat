import express from "express";
import mammoth from "mammoth";
import Thread from "../models/Thread.js";
import { createOpenAIResponse, streamOpenAIResponse } from "../utils/openai.js";
import auth from "../utils/auth.js";

const router = express.Router();

const normalizeAttachment = async (attachment) => {
  if (!attachment) return null;

  const baseAttachment = {
    kind: attachment.kind || "text",
    name: attachment.name || "attachment",
    mimeType: attachment.mimeType || "text/plain",
    textContent: attachment.textContent || "",
    fileData: attachment.fileData || "",
    previewUrl: attachment.previewUrl || "",
    size: attachment.size || 0,
  };

  if (baseAttachment.kind === "docx" && baseAttachment.fileData) {
    const buffer = Buffer.from(baseAttachment.fileData, "base64");
    const extracted = await mammoth.extractRawText({ buffer });
    baseAttachment.textContent = extracted.value?.trim() || "";
  }

  return baseAttachment;
};

const sendSse = (res, payload) => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
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

  if (!threadId || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const normalizedAttachment = await normalizeAttachment(attachment);
    const thread = await createOrUpdateThreadWithUserMessage(
      req.userId,
      threadId,
      message,
      normalizedAttachment
    );

    const assistantReply = await createOpenAIResponse(thread.messages.slice(-10));
    thread.messages.push({ role: "assistant", content: assistantReply });
    thread.updatedAt = new Date();
    await thread.save();

    res.json({ reply: assistantReply });
  } catch (err) {
    console.error("Chat Logic Error:", err);
    res.status(500).json({ error: err.message || "AI Processing Failed" });
  }
});

router.post("/chat/stream", auth, async (req, res) => {
  const { threadId, message, attachment } = req.body;

  if (!threadId || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const normalizedAttachment = await normalizeAttachment(attachment);

    if (normalizedAttachment) {
      const statusMessage =
        normalizedAttachment.kind === "image"
          ? "Analyzing attached image..."
          : normalizedAttachment.kind === "pdf"
            ? "Reading attached PDF..."
            : normalizedAttachment.kind === "docx"
              ? "Extracting DOCX text..."
              : "Preparing attachment...";
      sendSse(res, { type: "status", status: statusMessage });
    }

    const thread = await createOrUpdateThreadWithUserMessage(
      req.userId,
      threadId,
      message,
      normalizedAttachment
    );

    const assistantReply = await streamOpenAIResponse(thread.messages.slice(-10), {
      onDelta: (delta) => sendSse(res, { type: "delta", delta }),
    });

    thread.messages.push({ role: "assistant", content: assistantReply });
    thread.updatedAt = new Date();
    await thread.save();

    sendSse(res, { type: "done", reply: assistantReply });
  } catch (err) {
    console.error("Streaming Chat Error:", err);
    sendSse(res, {
      type: "error",
      message: err.message || "AI Processing Failed",
    });
  } finally {
    res.end();
  }
});

export default router;
