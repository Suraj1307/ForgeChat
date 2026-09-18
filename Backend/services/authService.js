import jwt from "jsonwebtoken";
import User from "../models/User.js";
import env from "../config/env.js";
import { createAppError } from "../utils/appError.js";

const signAuthToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      tokenVersion: Number(user.tokenVersion ?? 0),
    },
    env.jwtSecret,
    { expiresIn: "7d" }
  );

const buildSafeUser = (user) => ({
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl || "",
  createdAt: user.createdAt,
});

const buildAuthPayload = (user) => ({
  token: signAuthToken(user),
  userId: user._id,
  user: buildSafeUser(user),
});

const registerUser = async ({ name, email, password, avatarUrl }) => {
  const existingUser = await User.findOne({ email }).select("_id").lean();

  if (existingUser) {
    throw createAppError(409, "User already exists.", "USER_EXISTS");
  }

  const user = await User.create({
    name,
    email,
    password,
    avatarUrl,
  });

  return buildAuthPayload(user);
};

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw createAppError(401, "Invalid credentials.", "INVALID_CREDENTIALS");
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw createAppError(401, "Invalid credentials.", "INVALID_CREDENTIALS");
  }

  return buildAuthPayload(user);
};

const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).select("name email avatarUrl createdAt").lean();

  if (!user) {
    throw createAppError(404, "User not found.", "USER_NOT_FOUND");
  }

  return user;
};

const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
};

export { getCurrentUser, loginUser, logoutUser, registerUser };
