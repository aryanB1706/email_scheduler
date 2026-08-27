import { transporter } from "../config/nodemailer";
import { env } from "../config/env";
import { prisma } from "../db/prisma";

export interface SendEmailArgs {
  to: string;
  subject: string;
  body: string; // plain text or HTML
}

/**
 * Sends a single email via Ethereal SMTP and returns the Nodemailer info.
 * Preview URL is available via nodemailer.getTestMessageUrl(info).
 */
export async function sendEmail({ to, subject, body }: SendEmailArgs) {
  const info = await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text: body,
    html: body,
  });
  return info;
}

/**
 * Helper for tests/scripts: fetch EmailJob and mark status.
 * Worker uses inline prisma updates to keep the processor lean.
 */
export async function markEmailJobStatus(id: string, status: "queued" | "sent" | "failed") {
  return prisma.emailJob.update({ where: { id }, data: { status } });
}
