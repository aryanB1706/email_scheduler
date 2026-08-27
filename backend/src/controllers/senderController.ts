import { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma";

export async function listSendersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const senders = await prisma.sender.findMany({ orderBy: { createdAt: "desc" } });
    return res.json({ data: senders });
  } catch (err) {
    next(err);
  }
}

export async function createSenderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, name } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    const sender = await prisma.sender.create({ data: { email: email.toLowerCase(), name } });
    return res.status(201).json({ data: sender });
  } catch (err: any) {
    if (err?.code === "P2002") return res.status(409).json({ error: "Sender email already exists" });
    next(err);
  }
}
