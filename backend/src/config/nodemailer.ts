import nodemailer from "nodemailer";
import { env } from "./env";

export const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: false, // Ethereal uses STARTTLS on 587
  auth: env.smtp.user && env.smtp.pass ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
});

export async function verifySmtp(): Promise<void> {
  try {
    await transporter.verify();
    console.log("[smtp] Ethereal transporter ready");
  } catch (err: any) {
    console.warn("[smtp] verify failed (expected if .env not configured yet):", err.message);
  }
}
