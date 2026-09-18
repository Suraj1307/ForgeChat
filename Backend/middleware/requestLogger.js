const requestLogger = (req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const forwardedFor = req.headers["x-forwarded-for"];
    const ip = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : String(forwardedFor || req.ip || "unknown").split(",")[0].trim();

    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms ${ip}`);
  });

  next();
};

export default requestLogger;
