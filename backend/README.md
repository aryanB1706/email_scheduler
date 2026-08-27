# Backend — Email Scheduler

Node.js + TypeScript + Express + BullMQ + Redis + Prisma + Nodemailer (Ethereal)

## Setup

```bash
cp .env.example .env
docker-compose up -d   # from repo root — starts Postgres + Redis
npm install
npx prisma migrate dev --name init
npm run dev            # http://localhost:4000/api/health
```
