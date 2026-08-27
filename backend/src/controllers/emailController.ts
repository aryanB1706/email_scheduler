import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  senderId: z.string().cuid().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

function parsePagination(req: Request) {
  return paginationSchema.safeParse(req.query);
}

export async function listScheduledHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = parsePagination(req);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    }
    const { page, limit, senderId, order } = parsed.data;
    const skip = (page - 1) * limit;
    const where: any = { status: { in: ["pending", "queued"] as const } };
    if (senderId) where.senderId = senderId;

    const [items, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: order },
        include: { sender: { select: { id: true, email: true, name: true } } },
      }),
      prisma.emailJob.count({ where }),
    ]);

    return res.json({
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function listSentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = parsePagination(req);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    }
    const { page, limit, senderId, order } = parsed.data;
    const skip = (page - 1) * limit;
    // sent = delivered, failed = attempts exhausted or SMTP error
    const where: any = { status: { in: ["sent", "failed"] as const } };
    if (senderId) where.senderId = senderId;

    const [items, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: order },
        include: { sender: { select: { id: true, email: true, name: true } } },
      }),
      prisma.emailJob.count({ where }),
    ]);

    return res.json({
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getEmailByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = (req.params as any).id as string;
    const job = await prisma.emailJob.findUnique({
      where: { id },
      include: { sender: { select: { id: true, email: true, name: true } } },
    });
    if (!job) return res.status(404).json({ error: "Email not found" });
    return res.json({ data: job });
  } catch (err) {
    next(err);
  }
}

export async function deleteEmailHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = (req.params as any).id as string;
    const job = await prisma.emailJob.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ error: "Email not found" });

    // Try to remove from BullMQ if still queued/delayed
    try {
      const { emailQueue } = await import("../queues/emailQueue");
      const bullId = job.bullJobId || job.id;
      const bullJob = await emailQueue.getJob(bullId);
      if (bullJob) await bullJob.remove();
      // also try with job.id as fallback
      if (!bullJob && bullId !== job.id) {
        const alt = await emailQueue.getJob(job.id);
        if (alt) await alt.remove();
      }
    } catch (e) {
      console.warn("[deleteEmail] bull remove failed", e);
    }

    await prisma.emailJob.delete({ where: { id } });
    return res.json({ message: "Email deleted", id });
  } catch (err) {
    next(err);
  }
}

export async function archiveEmailHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = (req.params as any).id as string;
    const job = await prisma.emailJob.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ error: "Email not found" });
    // For now archive = just a success response (could add archivedAt field later)
    // We keep the job but client will treat as archived via local state
    return res.json({ message: "Email archived", id });
  } catch (err) {
    next(err);
  }
}
