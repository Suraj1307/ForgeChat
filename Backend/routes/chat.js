import express from "express";
import auth from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createChat,
  deleteThread,
  getThreadMessages,
  listThreads,
  streamChat,
} from "../controllers/chatController.js";

const router = express.Router();

router.get("/thread", auth, asyncHandler(listThreads));
router.get("/thread/:threadId", auth, asyncHandler(getThreadMessages));
router.delete("/thread/:threadId", auth, asyncHandler(deleteThread));
router.post("/chat", auth, asyncHandler(createChat));
router.post("/chat/stream", auth, asyncHandler(streamChat));

export default router;
