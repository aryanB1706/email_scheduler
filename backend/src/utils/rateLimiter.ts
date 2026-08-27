import { redis } from "../config/redis";
import { env } from "../config/env";

/**
 * Redis-backed fixed hour window counter.
 * Key = `ratelimit:sender:{senderId}:hour:{hourWindow}` where hourWindow = floor(Date.now()/3600000)
 * Uses INCR + EXPIRE 3600 (1 hour) — safe across multiple worker instances (no in-memory counts).
 * Each window auto-expires, no manual cleanup needed.
 */

function hourWindow(now = Date.now()): number {
  return Math.floor(now / 3600000);
}

export function rateLimitKey(senderId: string, window: number): string {
  return `ratelimit:sender:${senderId}:hour:${window}`;
}

/** ms until next fixed hour window: (window+1)*3600000 - now */
export function msUntilNextHourWindow(now = Date.now()): number {
  const currentWindow = hourWindow(now);
  return (currentWindow + 1) * 3600000 - now;
}

/**
 * Try to consume 1 token for sender in current hour window.
 * Returns { allowed, count, remaining, resetMs }.
 * If allowed===false, caller should reschedule job instead of failing it.
 * Atomic via INCR + conditional EXPIRE; handles expiry race via TTL check.
 */
export async function consumeHourSlot(senderId: string): Promise<{
  allowed: boolean;
  count: number;
  remaining: number;
  resetMs: number;
  key: string;
}> {
  const window = hourWindow();
  const key = rateLimitKey(senderId, window);
  const max = env.maxEmailsPerHourPerSender;

  // INCR is atomic; first increment creates key with value 1
  const count = await redis.incr(key);
  if (count === 1) {
    // First write in this window — set 1h TTL. Use EXPIRE not SETEX so we don't overwrite count.
    await redis.expire(key, 3600);
  } else {
    // Ensure TTL exists (e.g. if key was created without EXPIRE due to crash)
    const ttl = await redis.ttl(key);
    if (ttl === -1) await redis.expire(key, 3600);
  }

  const resetMs = msUntilNextHourWindow();
  if (count > max) {
    // Over limit — undo the increment so next attempt still sees correct count (don't leak token)
    await redis.decr(key);
    return { allowed: false, count: max, remaining: 0, resetMs, key };
  }
  return { allowed: true, count, remaining: max - count, resetMs, key };
}

/**
 * Peek current count without consuming — useful for metrics.
 */
export async function peekHourUsage(senderId: string, now = Date.now()): Promise<number> {
  const window = hourWindow(now);
  const key = rateLimitKey(senderId, window);
  const val = await redis.get(key);
  return val ? parseInt(val, 10) : 0;
}
