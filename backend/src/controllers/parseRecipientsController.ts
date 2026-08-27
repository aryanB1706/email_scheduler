import { Request, Response, NextFunction } from "express";

// Simple RFC-5322-ish regex — good enough for CSV ingestion validation
// For final scheduling we still use z.string().email() (stricter).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractEmailsFromText(text: string): string[] {
  // Split on comma, semicolon, newline, whitespace — handles CSV with "a@b.com, c@d.com" or one-per-line
  // Also handles quoted CSV fields by stripping quotes first.
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
    .filter(Boolean);
}

export async function parseRecipientsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Field name must be 'file'." });
    }

    // Multer memoryStorage gives Buffer
    const text = req.file.buffer.toString("utf-8");
    if (!text.trim()) {
      return res.status(400).json({ error: "Uploaded file is empty" });
    }

    const raw = extractEmailsFromText(text);
    const seen = new Set<string>();
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const token of raw) {
      const lower = token.toLowerCase();
      if (seen.has(lower)) continue; // dedupe case-insensitive
      seen.add(lower);
      if (EMAIL_REGEX.test(token)) valid.push(lower);
      else invalid.push(token);
    }

    return res.json({
      count: valid.length,
      totalTokens: raw.length,
      validEmails: valid,
      invalidCount: invalid.length,
      invalidSamples: invalid.slice(0, 20), // don't flood response
    });
  } catch (err) {
    next(err);
  }
}
