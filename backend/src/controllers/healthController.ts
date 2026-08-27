import { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { redis } from "../config/redis";

export async function healthHandler(_req: Request, res: Response) {
  const checks: Record<string, string> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = "up";
  } catch (e: any) {
    checks.postgres = `down: ${e.message}`;
  }

  try {
    const pong = await redis.ping();
    checks.redis = pong === "PONG" ? "up" : `unexpected: ${pong}`;
  } catch (e: any) {
    checks.redis = `down: ${e.message}`;
  }

  const allUp = checks.postgres === "up" && checks.redis === "up";
  res.status(allUp ? 200 : 503).json({
    status: allUp ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  });
}

export function helloHandler(_req: Request, res: Response) {
  res.json({ message: "Hello from Email Scheduler API", version: "0.1.0" });
}
