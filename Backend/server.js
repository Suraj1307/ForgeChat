import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import env from "./config/env.js";
import { closeDatabase, connectDatabase, isDatabaseReady } from "./config/database.js";
import chatRoutes from "./routes/chat.js";
import userRoutes from "./routes/user.js";
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";
import requestLogger from "./middleware/requestLogger.js";
import securityHeaders from "./middleware/securityHeaders.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const frontendDistDir = path.join(rootDir, "Frontend", "dist");
const isProduction = env.nodeEnv === "production";
const server = express();
let httpServer = null;

const allowedOrigins = new Set(
  env.corsOrigins.length
    ? env.corsOrigins
    : isProduction
      ? []
      : ["http://localhost:5173", "http://127.0.0.1:5173"]
);

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }

  if (!allowedOrigins.size) {
    return !isProduction;
  }

  return allowedOrigins.has(origin);
};

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down.`);

  if (!httpServer) {
    await closeDatabase().catch(() => {});
    process.exit(0);
    return;
  }

  httpServer.close(async () => {
    await closeDatabase().catch(() => {});
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10000).unref();
};

server.disable("x-powered-by");
server.set("trust proxy", 1);
server.use(securityHeaders);
server.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Blocked by CORS"));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
server.use(express.json({ limit: "6mb" }));
server.use(requestLogger);

server.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    database: isDatabaseReady() ? "connected" : "disconnected",
    uptimeSeconds: Math.round(process.uptime()),
  });
});

server.get("/api/ready", (_req, res) => {
  res.status(isDatabaseReady() ? 200 : 503).json({
    ok: isDatabaseReady(),
    database: isDatabaseReady() ? "connected" : "disconnected",
  });
});

server.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.path === "/ready") {
    next();
    return;
  }

  if (!isDatabaseReady()) {
    res.status(503).json({
      error: "ForgeChat backend is running, but MongoDB is unavailable.",
      code: "DATABASE_UNAVAILABLE",
    });
    return;
  }

  next();
});

server.use("/api", chatRoutes);
server.use("/api", userRoutes);

if (fs.existsSync(frontendDistDir)) {
  server.use(express.static(frontendDistDir));
  server.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDistDir, "index.html"));
  });
}

server.use(notFound);
server.use(errorHandler);

httpServer = server.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void connectDatabase();
