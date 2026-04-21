import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("tokenVersion");

    if (!user || Number(decoded.tokenVersion ?? 0) !== Number(user.tokenVersion ?? 0)) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    req.userId = decoded.userId; // attach userId to request
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

export default auth;
