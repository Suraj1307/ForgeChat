import express from "express";
import auth from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import createRateLimit from "../utils/rateLimit.js";
import { login, logout, me, register } from "../controllers/userController.js";

const router = express.Router();
const authRateLimit = createRateLimit({
  keyPrefix: "auth",
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
  message: "Too many authentication attempts. Please try again in a few minutes.",
});

router.post("/register", authRateLimit, asyncHandler(register));
router.post("/login", authRateLimit, asyncHandler(login));
router.get("/me", auth, asyncHandler(me));
router.post("/logout", auth, asyncHandler(logout));

export default router;
