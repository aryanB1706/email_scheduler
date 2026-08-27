import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "./config/passport";
import { env } from "./config/env";
import { connectDb, disconnectDb } from "./db/prisma";
import { redis } from "./config/redis";
import { verifySmtp } from "./config/nodemailer";
import router from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

// Import to initialize queue & worker (side-effect)
import "./queues/emailQueue";
import "./workers/emailWorker";

const app = express();

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(passport.initialize());
app.use(express.json());
// For CSV file upload routes we use multer memoryStorage — no extra body parser needed there
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Root convenience redirect
app.get("/", (_req, res) => res.redirect("/api"));

// 404 for unknown routes
app.use(notFoundHandler);
// Global error handler (must be last)
app.use(errorHandler);

const PORT = env.port;

async function bootstrap() {
  try {
    await connectDb();
  } catch (err: any) {
    console.error("[bootstrap] Postgres connection failed:", err.message);
    console.error("  -> Ensure docker-compose is running and DATABASE_URL is correct");
  }

  try {
    // redis pings on ready; we explicitly ping to confirm
    const pong = await redis.ping();
    console.log(`[bootstrap] Redis ping: ${pong}`);
  } catch (err: any) {
    console.error("[bootstrap] Redis connection failed:", err.message);
  }

  // Don't block server startup on SMTP - Ethereal can be slow on Render
  verifySmtp().catch(() => {});

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] listening on http://0.0.0.0:${PORT}`);
    console.log(`[server] health check: http://0.0.0.0:${PORT}/api/health`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[server] ❌ Port ${PORT} already in use!`);
      console.error(`  → Find killer: lsof -i :${PORT}  or  ss -tulpn | grep ${PORT}  or  fuser ${PORT}/tcp`);
      console.error(`  → Kill: kill $(lsof -t -i :${PORT})  or  fuser -k ${PORT}/tcp`);
      console.error(`  → Or use another port: PORT=4001 npm run dev`);
      process.exit(1);
    }
    throw err;
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[shutdown] received ${signal}`);
    server.close(async () => {
      try {
        const { emailWorker } = await import("./workers/emailWorker");
        await emailWorker.close();
        console.log("[shutdown] worker closed");
      } catch {}
      try {
        const { emailQueue, queueEvents } = await import("./queues/emailQueue");
        await queueEvents.close();
        await emailQueue.close();
      } catch {}
      redis.disconnect();
      await disconnectDb().catch(() => {});
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap();
