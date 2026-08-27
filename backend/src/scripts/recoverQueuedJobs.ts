/**
 * Idempotent recovery script — safe to run on every restart.
 * Re-adds BullMQ jobs for EmailJobs with status `queued`/`pending` that may have
 * been lost only if Redis was flushed (normally BullMQ persistence makes this unnecessary).
 * Because jobId = EmailJob.id is deterministic, re-adding is deduplicated by BullMQ.
 *
 * Usage:
 *   DATABASE_URL=... REDIS_URL=... npx tsx src/scripts/recoverQueuedJobs.ts
 */
import { prisma } from "../db/prisma";
import { emailQueue } from "../queues/emailQueue";

async function main() {
  const jobs = await prisma.emailJob.findMany({
    where: { status: { in: ["pending", "queued"] } },
    orderBy: { scheduledAt: "asc" },
  });
  console.log(`[recover] found ${jobs.length} pending/queued jobs`);
  for (const j of jobs) {
    const delay = Math.max(0, j.scheduledAt.getTime() - Date.now());
    try {
      const bullJob = await emailQueue.add(
        "send-email",
        {
          emailJobId: j.id,
          recipientEmail: j.recipientEmail,
          subject: j.subject,
          body: j.body,
          senderId: j.senderId,
        },
        { jobId: j.id, delay, attempts: 3, backoff: { type: "exponential", delay: 5000 } }
      );
      // ensure bullJobId/status are consistent (no-op if already correct)
      if (j.bullJobId !== bullJob.id) {
        await prisma.emailJob.update({
          where: { id: j.id },
          data: { bullJobId: bullJob.id as string, status: "queued" },
        });
      }
      console.log(`[recover] re-added ${j.id} delay=${delay}ms bullJobId=${bullJob.id}`);
    } catch (e: any) {
      if (String(e.message).includes("already exists")) {
        console.log(`[recover] ${j.id} already in Redis — skipping`);
      } else {
        console.error(`[recover] failed ${j.id}:`, e.message);
      }
    }
  }
  await prisma.$disconnect();
  process.exit(0);
}

main();
