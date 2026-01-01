import express from "express";
import Thread from "../models/Thread.js";
import getOpenAIAPIResponse from "../utils/openai.js";
import auth from "../utils/auth.js";

const router = express.Router();


  //TEST (FIXED)

router.post("/test", auth, async (req, res) => {
  try {
    const thread = new Thread({
      threadId: "abc",
      userId: req.userId, 
      title: "Testing New Thread2",
      messages: []
    });

    const response = await thread.save();
    res.send(response);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to save in DB" });
  }
});


  //GET ALL THREADS (SIDEBAR)

router.get("/thread", auth, async (req, res) => {
  try {
    const threads = await Thread.find({
      userId: req.userId        
    }).sort({ updatedAt: -1 });

    res.json(threads);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});


  //GET SINGLE THREAD
router.get("/thread/:threadId", auth, async (req, res) => {
  const { threadId } = req.params;

  try {
    const thread = await Thread.findOne({
      threadId,
      userId: req.userId        
    });

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json(thread.messages);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch chat" });
  }
});

  //DELETE THREAD
router.delete("/thread/:threadId", auth, async (req, res) => {
  const { threadId } = req.params;

  try {
    const deletedThread = await Thread.findOneAndDelete({
      threadId,
      userId: req.userId        
    });

    if (!deletedThread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.status(200).json({ success: "Thread deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to delete thread" });
  }
});


  // CHAT ROUTE (MOST IMPORTANT)

router.post("/chat", auth, async (req, res) => {
    

  const { threadId, message } = req.body;

  if (!threadId || !message) {
    return res.status(400).json({ error: "missing required fields" });
  }

  try {
    let thread = await Thread.findOne({
      threadId,
      userId: req.userId        // 🔑 USER-SCOPED QUERY
    });

    if (!thread) {
      thread = new Thread({
        threadId,
        userId: req.userId,     // 🔑 SET OWNER
        title: message,
        messages: [{ role: "user", content: message }]
      });
    } else {
      thread.messages.push({ role: "user", content: message });
    }

    const assistantReply = await getOpenAIAPIResponse(message);

    thread.messages.push({
      role: "assistant",
      content: assistantReply
    });

    thread.updatedAt = new Date();
    await thread.save();

    res.json({ reply: assistantReply });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "something went wrong" });
  }
});

export default router;
