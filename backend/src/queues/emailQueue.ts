import { Queue, QueueEvents } from "bullmq";
import { redis } from "../config/redis";

export const EMAIL_QUEUE_NAME = "email-queue";

/**
 * BullMQ hourly rate-limit logic (comments):
 *
 * 1) Queue-wide throttling via BullMQ built-in limiter — replaces custom sleep/delayBetweenEmailsMs.
 *    `limiter: { max, duration }` is token-bucket in Redis (Lua) shared across all workers.
 *    Configured on Worker (not Queue) in BullMQ v5. It smoothly spaces jobs instead of manual stagger.
 *    We set max = MAX_EMAILS_PER_HOUR_PER_SENDER, duration = 1 hour. This is queue-wide;
 *    per-sender precise hour-window is additionally enforced in the worker via Redis INCR+EXPIRE
 *    (see utils/rateLimiter.ts) — not in-memory counts, so safe across instances.
 *
 * 2) Per-sender fixed hour window counters (Redis INCR + EXPIRE 3600) in worker:
 *    key = `ratelimit:sender:{senderId}:hour:{floor(now/3600000)}`
 *    Before sending, worker calls consumeHourSlot(senderId). If allowed===false,
 *    job is NOT failed — instead `await job.moveToDelayed(nextHourStart, token)` + throw DelayedError
 *    which BullMQ treats as rescheduled (not failed). DB stays `queued`.
 *    `msUntilNextHourWindow` preserves order: all overflow jobs get same next-window timestamp,
 *    BullMQ delayed ZSET keeps FIFO tie-break by jobId insertion order.
 *
 * 3) Jobs live in Redis hashes/ZSETs, so worker restart just re-attaches — delayed jobs stay.
 */
export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
  // Note: limiter is on Worker in BullMQ v5, not Queue — see emailWorker.ts
});

// Optional queue events for observability (no side-effects)
export const queueEvents = new QueueEvents(EMAIL_QUEUE_NAME, { connection: redis });

queueEvents.on("completed", ({ jobId }) => console.log(`[queue:${EMAIL_QUEUE_NAME}] completed ${jobId}`));
queueEvents.on("failed", ({ jobId, failedReason }) =>
  console.warn(`[queue:${EMAIL_QUEUE_NAME}] failed ${jobId}: ${failedReason}`)
);
queueEvents.on("error", (err) => console.error(`[queueEvents] error:`, err));

console.log(`[bullmq] Queue "${EMAIL_QUEUE_NAME}" initialized`);
