import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export async function connectDb(): Promise<void> {
  await prisma.$connect();
  console.log("[prisma] connected to Postgres");
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  console.log("[prisma] disconnected");
}
