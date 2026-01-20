import express from "express";
import Thread from "../models/Thread.js";
import getOpenAIAPIResponse from "../utils/openai.js";
import auth from "../utils/auth.js";

const router = express.Router();

// --- 1. TEST ROUTE ---
router.post("/test", auth, async (req, res) => {
  try {
    const thread = new Thread({
      threadId: "test-" + Date.now(),
      userId: req.userId, 
      title: "Test Thread",
      messages: [{ role: "assistant", content: "Test successful! Database is connected." }]
    });

    const response = await thread.save();
    res.status(201).send(response);
  } catch (err) {
    console.error("Test Route Error:", err);
    res.status(500).json({ error: "Failed to save in DB" });
  }
});

// --- 2. GET ALL THREADS (SIDEBAR) ---
router.get("/thread", auth, async (req, res) => {
  try {
    const threads = await Thread.find({ userId: req.userId })
      .select("threadId title updatedAt") // Only fetch what the sidebar needs
      .sort({ updatedAt: -1 });

    res.json(threads);
  } catch (err) {
    console.error("Fetch Threads Error:", err);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

// --- 3. GET SINGLE THREAD ---
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

// --- 4. DELETE THREAD ---
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

// --- 5. CHAT ROUTE (THE BRAIN) ---
router.post("/chat", auth, async (req, res) => {
  const { threadId, message } = req.body;

  if (!threadId || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // A. Check for existing thread
    let thread = await Thread.findOne({ threadId, userId: req.userId });
    const newUserMessage = { role: "user", content: message };

    if (!thread) {
      // Create new thread if user started a new conversation
      thread = new Thread({
        threadId,
        userId: req.userId,
        title: message.substring(0, 35) + "...", 
        messages: [newUserMessage]
      });
    } else {
      // Push to existing history
      thread.messages.push(newUserMessage);
    }

    // B. MEMORY LOGIC: Send history to AI
    const contextWindow = thread.messages.slice(-10);
    const assistantReply = await getOpenAIAPIResponse(contextWindow);

    // C. Save AI Response
    thread.messages.push({ role: "assistant", content: assistantReply });
    thread.updatedAt = new Date();
    
    await thread.save();

    res.json({ reply: assistantReply });
  } catch (err) {
    console.error("Chat Logic Error:", err);
    res.status(500).json({ error: "AI Processing Failed" });
  }
});

export default router;