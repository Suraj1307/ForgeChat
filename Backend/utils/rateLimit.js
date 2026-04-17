const buckets = new Map();

const pruneOldBuckets = (now) => {
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

const getClientKey = (req, prefix) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || req.ip || "unknown").split(",")[0].trim();

  return `${prefix}:${ip}`;
};

const createRateLimit = ({
  keyPrefix,
  maxRequests,
  windowMs,
  message,
}) => {
  return (req, res, next) => {
    const now = Date.now();
    pruneOldBuckets(now);

    const key = getClientKey(req, keyPrefix);
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    existing.count += 1;

    if (existing.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
};

export default createRateLimit;
