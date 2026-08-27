import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6380", 10),
    url: process.env.REDIS_URL || "redis://localhost:6380",
  },
  smtp: {
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "Email Scheduler <no-reply@example.com>",
  },
  concurrency: parseInt(process.env.CONCURRENCY || "5", 10),
  // Hourly per-sender limit — Redis window counters keyed by senderId:hourWindow
  maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || "100", 10),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/api/auth/google/callback",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "change_me_to_a_long_random_string",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  allowDevLogin: process.env.ALLOW_DEV_LOGIN === "true",
};
