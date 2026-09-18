import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dns from "node:dns";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import chatRoutes from "./routes/chat.js";
import userRoutes from "./routes/user.js";

// =======================
// FIX __dirname (ESM)
// =======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const mongoDnsServers = process.env.MONGODB_DNS_SERVERS
  ?.split(",")
  .map((server) => server.trim())
  .filter(Boolean);

if (mongoDnsServers?.length) {
  dns.setServers(mongoDnsServers);
  console.log(`MongoDB DNS servers configured: ${mongoDnsServers.join(", ")}`);
}

const app = express();
const PORT = process.env.PORT || 5000;
const DEFAULT_DB_TIMEOUT_MS = 15_000;
const DB_RETRY_DELAY_MS = 15_000;
let hasStartedServer = false;
let dbReconnectTimer = null;
let isConnectingToDb = false;

// Project root (ForgeChat/)
const ROOT_DIR = path.join(__dirname, "..");
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

// =======================
// Middleware
// =======================
app.use(express.json({ limit: "6mb" }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !allowedOrigins.length || process.env.NODE_ENV !== "production") {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Blocked by CORS"));
    },
  })
);

// =======================
// API Routes
// =======================
app.get("/api/health", (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;

  res.status(dbConnected ? 200 : 503).json({
    ok: dbConnected,
    database: dbConnected ? "connected" : "disconnected",
  });
});

app.use("/api", (req, res, next) => {
  if (req.path === "/health") {
    next();
    return;
  }

  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      error: "ForgeChat backend is running, but MongoDB is unavailable.",
    });
    return;
  }

  next();
});

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
const getDbConnectionOptions = () => ({
  serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || DEFAULT_DB_TIMEOUT_MS,
  connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS) || DEFAULT_DB_TIMEOUT_MS,
});

const describeMongoError = (error) => {
  const message = error?.message || String(error);

  if (/querySrv ECONNREFUSED/i.test(message)) {
    return [
      "Atlas SRV DNS lookup was refused by your network resolver.",
      "Use the standard Atlas connection string (mongodb://...) or switch your DNS to a public resolver.",
      "You can keep MONGODB_URI as-is and add a non-SRV URI in MONGODB_URI_FALLBACK.",
    ].join(" ");
  }

  if (/ENOTFOUND|EAI_AGAIN|querySrv/i.test(message)) {
    return [
      "MongoDB hostname lookup failed.",
      "Check your internet connection, DNS settings, and whether the Atlas cluster is running.",
    ].join(" ");
  }

  if (/bad auth|authentication failed/i.test(message)) {
    return "MongoDB authentication failed. Verify the Atlas username/password in Backend/.env.";
  }

  return "Failed to connect to MongoDB.";
};

const connectWithUri = async (uri, label) => {
  if (!uri) {
    throw new Error(`Missing ${label} in environment.`);
  }

  await mongoose.connect(uri, getDbConnectionOptions());
};

const startServer = () => {
  if (hasStartedServer) return;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  hasStartedServer = true;
};

const scheduleDbReconnect = () => {
  if (dbReconnectTimer || mongoose.connection.readyState === 1) {
    return;
  }

  console.log(`Retrying MongoDB connection in ${Math.round(DB_RETRY_DELAY_MS / 1000)} seconds...`);
  dbReconnectTimer = setTimeout(() => {
    dbReconnectTimer = null;
    void connectDB();
  }, DB_RETRY_DELAY_MS);
};

const connectDB = async () => {
  if (isConnectingToDb || mongoose.connection.readyState === 1) {
    return;
  }

  isConnectingToDb = true;
  const primaryUri = process.env.MONGODB_URI?.trim();
  const fallbackUri = process.env.MONGODB_URI_FALLBACK?.trim();

  try {
    await connectWithUri(primaryUri, "MONGODB_URI");
    console.log("DB connected");
  } catch (err) {
    console.error("Primary MongoDB connection failed.");
    console.error(describeMongoError(err));

    if (fallbackUri && fallbackUri !== primaryUri) {
      try {
        console.log("Retrying with MONGODB_URI_FALLBACK...");
        await connectWithUri(fallbackUri, "MONGODB_URI_FALLBACK");
        console.log("DB connected");
      } catch (fallbackError) {
        console.error("Fallback MongoDB connection failed.");
        console.error(describeMongoError(fallbackError));
        console.error(fallbackError);
        scheduleDbReconnect();
      }
    } else {
      console.error(err);
      scheduleDbReconnect();
    }
  } finally {
    isConnectingToDb = false;
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected.");
  scheduleDbReconnect();
});

mongoose.connection.on("connected", () => {
  if (dbReconnectTimer) {
    clearTimeout(dbReconnectTimer);
    dbReconnectTimer = null;
  }
});

startServer();
void connectDB();
