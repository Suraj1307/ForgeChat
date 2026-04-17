import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authMiddleware from "../utils/auth.js";
import createRateLimit from "../utils/rateLimit.js";

const router = express.Router();
const AVATAR_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|jpg|webp);base64,[a-z0-9+/=]+$/i;
const MAX_AVATAR_LENGTH = 2_100_000;

const createToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

const createAuthPayload = (user) => ({
  token: createToken(user._id),
  userId: user._id,
  user: {
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl || "",
    createdAt: user.createdAt,
  },
});

const authRateLimit = createRateLimit({
  keyPrefix: "auth",
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
  message: "Too many authentication attempts. Please try again in a few minutes.",
});

router.post("/register", authRateLimit, async (req, res) => {
  try {
    const { name, email, password, avatarUrl } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedAvatarUrl = typeof avatarUrl === "string" ? avatarUrl.trim() : "";

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    if (
      normalizedAvatarUrl &&
      (!AVATAR_DATA_URL_PATTERN.test(normalizedAvatarUrl) || normalizedAvatarUrl.length > MAX_AVATAR_LENGTH)
    ) {
      return res.status(400).json({ error: "Upload a PNG, JPG, JPEG, or WEBP image under 1.5 MB." });
    }

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ error: "User already exists" });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      avatarUrl: normalizedAvatarUrl,
    });
    res.status(201).json(createAuthPayload(user));
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json(createAuthPayload(user));
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("name email avatarUrl createdAt");
    res.json(user);
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
