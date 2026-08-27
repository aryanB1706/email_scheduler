import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import multer from "multer";

// Central error handler — must be last middleware
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error("[error]", err);

  // Multer file errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large", details: `Max 2MB` });
    }
    return res.status(400).json({ error: "Upload error", details: err.message });
  }

  // File filter / unsupported type (thrown as generic Error from multer fileFilter)
  if (err && typeof err.message === "string" && err.message.includes("Unsupported file type")) {
    return res.status(400).json({ error: err.message });
  }

  // Zod validation
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", details: err.flatten() });
  }

  // Prisma known errors (e.g. P2002 unique violation)
  if (err?.code?.startsWith?.("P2")) {
    return res.status(400).json({ error: "Database error", code: err.code, details: err.message });
  }

  // Fallback — don't leak stack in production unless needed
  const status = err?.status || err?.statusCode || 500;
  const message = err?.message || "Internal server error";
  return res.status(status).json({ error: message, ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}) });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}
