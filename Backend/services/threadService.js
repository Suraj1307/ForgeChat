import Thread from "../models/Thread.js";
import { createAppError } from "../utils/appError.js";

const buildThreadTitle = (message) => {
  const normalized = String(message || "").trim();
  return normalized.length > 35 ? `${normalized.slice(0, 35)}...` : normalized;
};

const createOrUpdateThreadWithUserMessage = async (userId, threadId, message, attachment) => {
  let thread = await Thread.findOne({ threadId, userId });
  const attachments = attachment ? [attachment] : [];
  const newUserMessage = {
    role: "user",
    content: message,
    attachments,
  };

  if (!thread) {
    thread = new Thread({
      threadId,
      userId,
      title: buildThreadTitle(message),
      messages: [newUserMessage],
    });
  } else {
    thread.messages.push(newUserMessage);
    thread.updatedAt = new Date();
  }

  await thread.save();
  return thread;
};

const appendAssistantReply = async (thread, reply) => {
  thread.messages.push({ role: "assistant", content: reply });
  thread.updatedAt = new Date();
  await thread.save();
};

const listThreadsForUser = async (userId, limit) =>
  Thread.find({ userId })
    .select("threadId title updatedAt")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

const getThreadMessagesForUser = async (userId, threadId) => {
  const thread = await Thread.findOne({ threadId, userId }).select("messages").lean();

  if (!thread) {
    throw createAppError(404, "Thread not found.", "THREAD_NOT_FOUND");
  }

  return thread.messages;
};

const deleteThreadForUser = async (userId, threadId) => {
  const deletedThread = await Thread.findOneAndDelete({ threadId, userId }).lean();

  if (!deletedThread) {
    throw createAppError(404, "Thread not found.", "THREAD_NOT_FOUND");
  }
};

export {
  appendAssistantReply,
  createOrUpdateThreadWithUserMessage,
  deleteThreadForUser,
  getThreadMessagesForUser,
  listThreadsForUser,
};
