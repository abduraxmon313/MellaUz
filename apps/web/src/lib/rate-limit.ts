/**
 * Oddiy xotiradagi (in-memory) rate limiter.
 * Bitta instansiya uchun yetarli; ko'p instansiyada Redis'ga ko'chiriladi.
 */
type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export function rateLimit(
  key: string,
  limit = 5,
  windowMs = 60_000,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true, retryAfter: 0 };
}

// Vaqti o'tgan yozuvlarni tozalab turish (xotira o'smasligi uchun)
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      if (now > entry.resetAt) buckets.delete(key);
    }
  }, 5 * 60_000);
  // Node jarayonini bu taymer tutib turmasin
  if (typeof timer === "object" && "unref" in timer) {
    (timer as { unref: () => void }).unref();
  }
}
