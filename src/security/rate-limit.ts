type Bucket = {
  count: number;
  resetAtEpochMs: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAtEpochMs: number;
};

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAtEpochMs) {
    const resetAtEpochMs = now + windowSeconds * 1000;
    buckets.set(key, { count: 1, resetAtEpochMs });
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      resetAtEpochMs
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAtEpochMs: existing.resetAtEpochMs
    };
  }

  existing.count += 1;
  buckets.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - existing.count),
    resetAtEpochMs: existing.resetAtEpochMs
  };
}
