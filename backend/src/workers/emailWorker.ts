import { Worker, Job } from "bullmq";
import { redis } from "../config/redis";
import { env } from "../config/env";
import { EMAIL_QUEUE_NAME } from "../queues/emailQueue";
import { prisma } from "../db/prisma";
import { transporter } from "../config/nodemailer";
import nodemailer from "nodemailer";
import { DelayedError } from "bullmq";
import { consumeHourSlot, msUntilNextHourWindow } from "../utils/rateLimiter";

type EmailJobData = {
  emailJobId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  senderId: string;
};

/**
 * BullMQ persistence note:
 *  - Queue + Jobs live in Redis (hashes `bull:email-queue:*`), NOT in Node memory.
 *  - When the worker process restarts it just creates a new Worker() that BRPOPs /
 *    polls the same Redis keys. Delayed jobs remain in the `delayed` ZSET until
 *    their timestamp, then moved to `wait`. No code needs to re-enqueue.
 *  - `jobId = EmailJob.id` makes re-adding after a crash idempotent — BullMQ
 *    returns the existing job instead of duplicating.
 *
 * Hourly rate limiting (Redis-backed, multi-instance safe):
 *  - Fixed hour window: key = `ratelimit:sender:{senderId}:hour:{floor(now/3600000)}`
 *  - Counter via Redis INCR + EXPIRE 3600 (no in-memory map, so 2 workers share same count).
 *  - Before sending, worker calls consumeHourSlot(senderId). If allowed===false,
 *    we DO NOT fail the job — instead `await job.moveToDelayed(nextHourStart, token)` and
 *    throw `DelayedError` (BullMQ treats this as not-failed, just rescheduled). DB stays `queued`.
 *  - `msUntilNextHourWindow` preserves order: all overflow jobs get same next-window timestamp,
 *    BullMQ delayed ZSET keeps FIFO tie-break by jobId insertion order.
 *
 * Minimum delay between sends:
 *  - Queue `limiter: { max, duration }` (see emailQueue.ts) is token-bucket in Redis Lua,
 *    auto-delays excess jobs without custom sleep. We keep per-sender hard cap via Redis counter.
 */

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>, token?: string) => {
    const { emailJobId, recipientEmail, subject, body, senderId } = job.data;
    console.log(`[worker] processing ${job.id} -> EmailJob ${emailJobId} to ${recipientEmail}`);

    // Fetch latest DB state — if already sent, skip (idempotent)
    const emailJob = await prisma.emailJob.findUnique({ where: { id: emailJobId } });
    if (!emailJob) {
      throw new Error(`EmailJob ${emailJobId} not found`);
    }
    if (emailJob.status === "sent") {
      console.log(`[worker] ${emailJobId} already sent, skipping`);
      return { skipped: true };
    }

    // ---- Hourly per-sender rate limit (Redis INCR + EXPIRE) ----
    // Must be safe across multiple worker instances, so no in-memory counter.
    try {
      const rate = await consumeHourSlot(senderId);
      if (!rate.allowed) {
        const delayMs = rate.resetMs + Math.floor(Math.random() * 500); // tiny jitter to avoid thundering herd
        const nextWindowAt = new Date(Date.now() + delayMs).toISOString();
        console.warn(
          `[rate-limit] sender ${senderId} hit ${env.maxEmailsPerHourPerSender}/hour (key ${rate.key}), rescheduling ${job.id} -> delayed until ${nextWindowAt} (${delayMs}ms)`
        );
        // Keep DB as queued (not failed) — job will retry next window in same order
        // moveToDelayed requires token in BullMQ v5 when inside worker
        await job.moveToDelayed(Date.now() + delayMs, token);
        // Throw DelayedError so worker does NOT move job to failed/completed — just fetches next job
        throw new DelayedError();
      }
      console.log(`[rate-limit] sender ${senderId} slot ${rate.count}/${env.maxEmailsPerHourPerSender} remaining ${rate.remaining}`);
    } catch (err: any) {
      // If it's already a DelayedError, re-throw as-is (don't log as failure)
      if (err instanceof DelayedError || err?.name === "DelayedError") throw err;
      // Redis errors should not block sending entirely — log and allow send (fail open) to avoid stuck queue
      console.error(`[rate-limit] redis error for ${senderId}:`, err.message);
    }

    try {
      const info = await transporter.sendMail({
        from: env.smtp.from,
        to: recipientEmail,
        subject,
        text: body,
        html: body,
      });

      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log(`[worker] Ethereal preview: ${preview}`);
      console.log(`[worker] sent ${emailJobId} messageId=${info.messageId}`);

      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: "sent" },
      });

      return { messageId: info.messageId, preview };
    } catch (err: any) {
      // Don't mark rate-limit reschedules as failed — only real send errors
      if (err instanceof DelayedError || err?.name === "DelayedError") throw err;
      console.error(`[worker] send failed for ${emailJobId}:`, err.message);
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: "failed" },
      });
      throw err; // let BullMQ handle retry/backoff
    }
  },
  {
    connection: redis,
    concurrency: env.concurrency,
    autorun: true,
    // BullMQ built-in limiter — token bucket in Redis Lua, shared across workers
    // Replaces custom delayBetweenEmailsMs sleep logic for minimum gap between sends.
    // We keep it as 1 job per second (queue-wide) for smooth spacing; per-sender hourly cap
    // is enforced separately via Redis INCR+EXPIRE in the processor above.
    limiter: {
      max: 1,
      duration: 1000,
    },
  }
);

emailWorker.on("active", (job) => console.log(`[worker] active ${job.id}`));
emailWorker.on("completed", (job) => console.log(`[worker] completed ${job.id}`));
emailWorker.on("failed", (job, err) => {
  // DelayedError is not a real failure — already handled in handleFailed, ignore log
  if (err?.name === "DelayedError") return;
  console.error(`[worker] failed ${job?.id}:`, err.message);
});
emailWorker.on("error", (err) => console.error("[worker] error:", err));
emailWorker.on("ready", () => console.log(`[worker] ready concurrency=${env.concurrency} limit=${env.maxEmailsPerHourPerSender}/hour`));

console.log(`[worker] "${EMAIL_QUEUE_NAME}" initialized concurrency=${env.concurrency} rateLimit=${env.maxEmailsPerHourPerSender}/hour`);
