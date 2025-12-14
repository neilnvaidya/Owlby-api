const windowMsDefault = 60 * 1000; // 1 minute

type Bucket = {
  timestamps: number[];
};

const buckets: Record<string, Bucket> = {};

/**
 * Simple in-memory sliding window rate limiter.
 * Not perfect for multi-instance, but sufficient for immediate protection.
 */
export function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = windowMsDefault
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets[key] || { timestamps: [] };

  // drop old entries
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

  if (bucket.timestamps.length >= limit) {
    const retryAfterMs = windowMs - (now - bucket.timestamps[0]);
    buckets[key] = bucket;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  bucket.timestamps.push(now);
  buckets[key] = bucket;

  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    retryAfterMs: 0,
  };
}










