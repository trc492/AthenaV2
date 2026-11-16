import { NextRequest } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  limited: boolean;
  retryAfterSeconds: number;
  remaining: number;
  resetAtUnixSeconds: number;
};

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  maxRequests: number;
  /**
   * Who the attempt is for (e.g. the account being signed in to). Used only
   * when no trusted client IP is available, so one caller cannot exhaust a
   * bucket shared by every user of the deployment.
   */
  subject?: string;
};

const rateLimitStore = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL = 100;

let requestsSinceCleanup = 0;

function cleanupExpiredEntries(now: number): void {
  requestsSinceCleanup += 1;

  if (requestsSinceCleanup < CLEANUP_INTERVAL) {
    return;
  }

  requestsSinceCleanup = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function getClientIp(request: NextRequest, subject?: string): string {
  // Only trust a header explicitly selected by the deployment operator. The
  // reverse proxy must overwrite it and block direct access to the application.
  const header = process.env.RATE_LIMIT_IP_HEADER?.trim().toLowerCase();
  if (header) {
    const value = request.headers.get(header)?.split(",")[0].trim();
    if (value) return value;
  }
  // Client-controlled fingerprints would let callers bypass limits by changing
  // headers. Without a trusted proxy, limit per subject where the caller
  // names one, and otherwise use one conservative shared bucket.
  return subject ? `subject:${subject}` : "unverified-client";
}

export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const clientIp = getClientIp(request, options.subject);
  const key = `${options.keyPrefix}:${clientIp}`;
  const existingEntry = rateLimitStore.get(key);

  if (!existingEntry || existingEntry.resetAt <= now) {
    const resetAt = now + options.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      limited: false,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
      remaining: options.maxRequests - 1,
      resetAtUnixSeconds: Math.ceil(resetAt / 1000),
    };
  }

  if (existingEntry.count >= options.maxRequests) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existingEntry.resetAt - now) / 1000),
      ),
      remaining: 0,
      resetAtUnixSeconds: Math.ceil(existingEntry.resetAt / 1000),
    };
  }

  existingEntry.count += 1;
  rateLimitStore.set(key, existingEntry);

  return {
    limited: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((existingEntry.resetAt - now) / 1000),
    ),
    remaining: options.maxRequests - existingEntry.count,
    resetAtUnixSeconds: Math.ceil(existingEntry.resetAt / 1000),
  };
}

export function getRateLimitHeaders(
  rateLimit: RateLimitResult,
  maxRequests: number,
): Record<string, string> {
  return {
    "Retry-After": rateLimit.retryAfterSeconds.toString(),
    "X-RateLimit-Limit": maxRequests.toString(),
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
    "X-RateLimit-Reset": rateLimit.resetAtUnixSeconds.toString(),
  };
}
