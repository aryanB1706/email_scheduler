import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../config/jwt";
import { prisma } from "../db/prisma";

export interface AuthRequest extends Omit<Request, "user"> {
  user?: {
    id: string;
    googleId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const cookieToken = (req as any).cookies?.token;
    let token: string | undefined;

    if (header?.startsWith("Bearer ")) token = header.slice(7);
    else if (cookieToken) token = cookieToken;

    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const payload = verifyJwt(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: "User not found" });

    (req as AuthRequest).user = {
      id: user.id,
      googleId: user.googleId,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
    next();
  } catch (err: any) {
    return res.status(401).json({ error: "Invalid or expired token", details: err.message });
  }
}

// Optional auth — populates req.user if token present, otherwise continues
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const cookieToken = (req as any).cookies?.token;
    let token: string | undefined;
    if (header?.startsWith("Bearer ")) token = header.slice(7);
    else if (cookieToken) token = cookieToken;
    if (!token) return next();
    const payload = verifyJwt(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user) {
      (req as AuthRequest).user = {
        id: user.id,
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      };
    }
  } catch {}
  next();
}
