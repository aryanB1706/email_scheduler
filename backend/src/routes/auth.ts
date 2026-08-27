import { Router, Request, Response } from "express";
import passport from "passport";
import { signJwt } from "../config/jwt";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { env } from "../config/env";
import { prisma } from "../db/prisma";

const router = Router();

// GET /api/auth/google — redirect to Google
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

// GET /api/auth/google/callback — Google redirects here, we issue JWT
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${env.frontendUrl}/login?error=google` }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    const token = signJwt({ userId: user.id, googleId: user.googleId, email: user.email });

    // Set httpOnly cookie (for browser) + also support token in URL for SPA
    res.cookie("token", token, {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
      path: "/",
    });

    // If client requested JSON (e.g. ?format=json or Accept: application/json), return JSON
    const wantsJson = req.query.format === "json" || req.headers.accept?.includes("application/json");
    if (wantsJson) {
      return res.json({ token, user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl } });
    }

    // Otherwise redirect to frontend with token in query (frontend can store in localStorage)
    const redirectUrl = new URL(env.frontendUrl);
    // If frontend has /auth/callback route, use it; otherwise root
    redirectUrl.pathname = "/auth/callback";
    redirectUrl.searchParams.set("token", token);
    return res.redirect(redirectUrl.toString());
  }
);

// GET /api/auth/me — current user from JWT (Bearer or cookie)
router.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  return res.json({ user: (req as AuthRequest).user });
});

// POST /api/auth/logout — clear cookie
router.post("/auth/logout", (req: Request, res: Response) => {
  res.clearCookie("token", { path: "/", httpOnly: true, sameSite: "lax", secure: env.nodeEnv === "production" });
  return res.json({ message: "Logged out" });
});

// GET also allowed for logout (convenience)
router.get("/auth/logout", (req: Request, res: Response) => {
  res.clearCookie("token", { path: "/", httpOnly: true, sameSite: "lax", secure: env.nodeEnv === "production" });
  // If browser, redirect to frontend
  if (req.headers.accept?.includes("text/html")) return res.redirect(env.frontendUrl);
  return res.json({ message: "Logged out" });
});

// ── DEV-ONLY BYPASS ──
// POST /api/auth/dev-login → {email?, name?, avatarUrl?} → JWT
// Only enabled when ALLOW_DEV_LOGIN=true and NOT production. Real Google flow remains untouched.
if (env.allowDevLogin && env.nodeEnv !== "production") {
  router.post("/auth/dev-login", async (req: Request, res: Response) => {
    const email = (req.body?.email as string)?.toLowerCase() || "dev@example.com";
    const name = (req.body?.name as string) || "Dev User";
    const avatarUrl = (req.body?.avatarUrl as string) || null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }

    // Find or create dev user — reuse same googleId for idempotency
    const googleId = `dev-${email}`;
    let user = await prisma.user.findUnique({ where: { googleId } });
    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.user.update({ where: { id: byEmail.id }, data: { googleId, name, avatarUrl } });
      } else {
        user = await prisma.user.create({ data: { googleId, email, name, avatarUrl } });
      }
    }

    const token = signJwt({ userId: user.id, googleId: user.googleId, email: user.email });
    res.cookie("token", token, {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl } });
  });
}

export default router;
