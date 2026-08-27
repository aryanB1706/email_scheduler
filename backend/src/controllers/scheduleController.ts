import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { emailQueue } from "../queues/emailQueue";

const scheduleSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1).max(1000),
  scheduledAt: z.string().datetime().or(z.date()),
  delayBetweenEmailsMs: z.number().int().min(0).max(86_400_000).default(0),
  maxEmailsPerHour: z.number().int().min(1).max(10000).optional(),
  senderId: z.string().cuid(),
});

export async function scheduleHandler(req: Request, res: Response) {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const { subject, body, recipients, scheduledAt, delayBetweenEmailsMs, maxEmailsPerHour, senderId } = parsed.data;

  // Validate sender exists
  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender) return res.status(404).json({ error: `Sender ${senderId} not found` });

  const baseScheduledAt = new Date(scheduledAt);
  if (isNaN(baseScheduledAt.getTime())) return res.status(400).json({ error: "Invalid scheduledAt" });

  const now = Date.now();
  const baseDelay = Math.max(0, baseScheduledAt.getTime() - now); // 0 if in past => send ASAP staggered

  // Effective stagger respects both params: if maxEmailsPerHour given, enforce min gap = 3600000 / maxPerHour
  let staggerMs = delayBetweenEmailsMs;
  if (maxEmailsPerHour) {
    const minGapFromRate = Math.ceil(3600000 / maxEmailsPerHour);
    staggerMs = Math.max(staggerMs, minGapFromRate);
  }

  const results: Array<{ recipient: string; emailJobId: string; bullJobId: string; delayMs: number; scheduledAt: string }> = [];
  const errors: Array<{ recipient: string; error: string }> = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipientEmail = recipients[i];
    const effectiveDelay = baseDelay + i * staggerMs;
    const effectiveScheduledAt = new Date(baseScheduledAt.getTime() + i * staggerMs);

    // 1) Create DB row as pending (unique per recipient+batch)
    let emailJob;
    try {
      emailJob = await prisma.emailJob.create({
        data: {
          subject,
          body,
          recipientEmail,
          senderId,
          scheduledAt: effectiveScheduledAt,
          status: "pending",
        },
      });
    } catch (e: any) {
      errors.push({ recipient: recipientEmail, error: e.message });
      continue;
    }

    // 2) Add BullMQ delayed job with deterministic jobId = emailJob.id (idempotency)
    //    If a restart script re-adds the same row, BullMQ will dedupe on jobId.
    try {
      const job = await emailQueue.add(
        "send-email",
        {
          emailJobId: emailJob.id,
          recipientEmail,
          subject,
          body,
          senderId,
        },
        {
          jobId: emailJob.id, // deterministic -> idempotent
          delay: effectiveDelay,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        }
      );

      // 3) Persist BullMQ id and mark queued
      const updated = await prisma.emailJob.update({
        where: { id: emailJob.id },
        data: { bullJobId: job.id as string, status: "queued" },
      });

      results.push({
        recipient: recipientEmail,
        emailJobId: updated.id,
        bullJobId: updated.bullJobId!,
        delayMs: effectiveDelay,
        scheduledAt: updated.scheduledAt.toISOString(),
      });
    } catch (e: any) {
      // BullMQ duplicate jobId (e.g. re-add after restart) — fetch existing and treat as success
      const msg = e?.message || String(e);
      if (msg.includes("JobId") || msg.includes("already exists") || msg.includes("JobId")) {
        try {
          const existing = await emailQueue.getJob(emailJob.id);
          if (existing) {
            await prisma.emailJob.update({
              where: { id: emailJob.id },
              data: { bullJobId: existing.id as string, status: "queued" },
            });
            results.push({
              recipient: recipientEmail,
              emailJobId: emailJob.id,
              bullJobId: existing.id as string,
              delayMs: effectiveDelay,
              scheduledAt: effectiveScheduledAt.toISOString(),
            });
            continue;
          }
        } catch {}
      }
      // Otherwise mark failed
      await prisma.emailJob.update({ where: { id: emailJob.id }, data: { status: "failed" } }).catch(() => {});
      errors.push({ recipient: recipientEmail, error: msg });
    }
  }

  // 207 Multi-Status if partial failure; 201 if all ok; 400 if none created
  if (results.length === 0 && errors.length > 0) {
    return res.status(500).json({ error: "All jobs failed", errors });
  }
  const statusCode = errors.length > 0 ? 207 : 201;
  return res.status(statusCode).json({
    message: `Scheduled ${results.length}/${recipients.length} emails`,
    staggerMs,
    baseDelayMs: baseDelay,
    jobs: results,
    ...(errors.length ? { errors } : {}),
  });
}
