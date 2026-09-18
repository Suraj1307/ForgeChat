import dns from "node:dns";
import mongoose from "mongoose";
import env from "./env.js";

let isConnecting = false;
let reconnectTimer = null;

const describeMongoError = (error) => {
  const message = error?.message || String(error);

  if (/querySrv ECONNREFUSED/i.test(message)) {
    return "Atlas SRV DNS lookup was refused by your network resolver.";
  }

  if (/ENOTFOUND|EAI_AGAIN|ETIMEOUT|querySrv/i.test(message)) {
    return "MongoDB hostname lookup failed.";
  }

  if (/bad auth|authentication failed/i.test(message)) {
    return "MongoDB authentication failed.";
  }

  return "Failed to connect to MongoDB.";
};

const connectionOptions = {
  serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
  connectTimeoutMS: env.mongoConnectTimeoutMs,
  maxPoolSize: 10,
  minPoolSize: 1,
};

if (env.mongoDnsServers.length) {
  dns.setServers(env.mongoDnsServers);
}

const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const scheduleReconnect = () => {
  if (reconnectTimer || mongoose.connection.readyState === 1) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectDatabase();
  }, env.mongoReconnectDelayMs);
};

const tryConnect = async (uri, label) => {
  if (!uri) {
    throw new Error(`Missing ${label} in environment.`);
  }

  await mongoose.connect(uri, connectionOptions);
};

const connectDatabase = async () => {
  if (isConnecting || mongoose.connection.readyState === 1) {
    return;
  }

  isConnecting = true;

  try {
    await tryConnect(env.mongoUri, "MONGODB_URI");
    console.log("DB connected");
  } catch (primaryError) {
    console.error("Primary MongoDB connection failed.");
    console.error(describeMongoError(primaryError));

    if (env.mongoFallbackUri && env.mongoFallbackUri !== env.mongoUri) {
      try {
        await tryConnect(env.mongoFallbackUri, "MONGODB_URI_FALLBACK");
        console.log("DB connected");
      } catch (fallbackError) {
        console.error("Fallback MongoDB connection failed.");
        console.error(describeMongoError(fallbackError));
        scheduleReconnect();
      }
    } else {
      scheduleReconnect();
    }
  } finally {
    isConnecting = false;
  }
};

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const closeDatabase = async () => {
  clearReconnectTimer();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};

mongoose.connection.on("connected", () => {
  clearReconnectTimer();
});

mongoose.connection.on("disconnected", () => {
  scheduleReconnect();
});

mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error.");
  console.error(describeMongoError(error));
});

export { closeDatabase, connectDatabase, isDatabaseReady };
