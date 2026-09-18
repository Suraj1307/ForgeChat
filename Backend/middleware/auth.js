import jwt from "jsonwebtoken";
import User from "../models/User.js";
import env from "../config/env.js";
import { createAppError } from "../utils/appError.js";

const auth = async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(createAppError(401, "Unauthorized.", "UNAUTHORIZED"));
    return;
  }

  const token = authHeader.slice(7).trim();

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.userId).select("tokenVersion").lean();

    if (!user || Number(decoded.tokenVersion ?? 0) !== Number(user.tokenVersion ?? 0)) {
      next(createAppError(401, "Unauthorized.", "UNAUTHORIZED"));
      return;
    }

    req.userId = String(decoded.userId);
    next();
  } catch {
    next(createAppError(401, "Unauthorized.", "UNAUTHORIZED"));
  }
};

export default auth;
