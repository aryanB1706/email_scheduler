import IORedis from "ioredis";
import { env } from "./env";

export const redis = new IORedis(env.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("connect", () => console.log("[redis] connecting..."));
redis.on("ready", () => console.log("[redis] ready"));
redis.on("error", (err) => console.error("[redis] error:", err.message));
redis.on("close", () => console.log("[redis] connection closed"));
