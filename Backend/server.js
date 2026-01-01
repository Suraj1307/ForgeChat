import express from "express";
import "dotenv/config";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import chatRoutes from "./routes/chat.js";
import userRoutes from "./routes/user.js";

const app = express();
const PORT = process.env.PORT || 5000;

// =======================
// FIX __dirname (ESM)
// =======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root (ForgeChat/)
const ROOT_DIR = path.join(__dirname, "..");

// =======================
// Middleware
// =======================
app.use(express.json());
app.use(cors());

// =======================
// API Routes
// =======================
app.use("/api", chatRoutes);
app.use("/api", userRoutes);

// =======================
// Serve Frontend (PROD)
// =======================
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(ROOT_DIR, "Frontend/dist")));

  // SPA fallback (Express 5 compatible)
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(
      path.join(ROOT_DIR, "Frontend/dist/index.html")
    );
  });
}

// =======================
// DB + Server
// =======================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("DB connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect with DB", err);
    process.exit(1);
  }
};

connectDB();
