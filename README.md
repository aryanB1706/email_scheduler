# Email Scheduler — Monorepo

Full-stack **delayed email scheduler** with BullMQ-backed staggered delivery, per-sender hourly rate limiting, Google OAuth (JWT), and a React dashboard.

> Stack: **Backend** Node 20 + TypeScript + Express + BullMQ 5 + IORedis + Prisma 5 + PostgreSQL 16 + Nodemailer (Ethereal) + Passport + JWT
> **Frontend** React 18 + TypeScript + Vite 6 + Tailwind 3 + React Router 6 + Axios
> **Infra** Docker Compose (Postgres 16-alpine + Redis 7-alpine)

---

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [Ethereal Email Setup](#ethereal-email-setup)
- [Architecture Overview](#architecture-overview)
- [Persistence & Restart Behavior](#persistence--restart-behavior)
- [Rate Limiting — Approach & Trade-offs](#rate-limiting--approach--trade-offs)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [Features Checklist (Assignment Mapping)](#features-checklist-assignment-mapping)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites
- Node.js ≥ 20, npm ≥ 10
- Docker & Docker Compose (or `docker compose` v2)
- A Google Cloud OAuth 2.0 Client ID (for `/api/auth/google`) — or use `dummy` for local dev without real login

Check:
```bash
node -v && npm -v && docker --version && docker-compose --version
```

---

## Quick Start
```bash
git clone <repo> && cd email_scheduler

# 1. Infra (host ports 5435 → 5432, 6380 → 6379 to avoid system Postgres/Redis on 5432/6379)
docker-compose up -d
docker-compose ps        # both (healthy)
docker-compose logs -f   # optional

# 2. Backend
cd backend
cp .env.example .env     # fill SMTP_USER/PASS (see Ethereal) + GOOGLE_* / JWT_SECRET
npm install
npx prisma migrate deploy  # or: npx prisma migrate dev --name init
npm run dev              # http://localhost:4000/api/health  → {postgres:"up",redis:"up"}

# 3. Frontend (new terminal, from repo root)
cd ../frontend
# create .env if you want to override API URL (defaults to /api via Vite proxy)
echo 'VITE_API_URL=/api' > .env
npm install
npm run dev              # http://localhost:5173
```

Root `npm run dev` runs both via `concurrently` (backend `tsx watch`, frontend `vite`).

Production:
```bash
cd backend && npm run build && npm start   # dist/index.js
cd frontend && npm run build && npm run preview
```

---

## Backend Setup

### 1. Docker services
`docker-compose.yml` (version 3.9) exposes:
- `postgres:16-alpine` → `5435:5432` (`PGDATA=pgdata`), healthcheck `pg_isready -U postgres`
- `redis:7-alpine` → `6380:6379` (`redisdata`), healthcheck `redis-cli ping`

Why `5435`/`6380`? Hosts often already run system Postgres (5432) / Redis (6379) / Supabase (54322). Mapping avoids `EADDRINUSE`. If you freed those ports, change `docker-compose.yml` back to `5432:5432`/`6379:6379` and update `DATABASE_URL`/`REDIS_URL`.

```bash
docker-compose up -d postgres redis
redis-cli -p 6380 ping                    # PONG
PGPASSWORD=postgres psql -h localhost -p 5435 -U postgres -d email_scheduler -c "select 1"
```

### 2. Env vars (`backend/.env`)
Copy from `.env.example` — see [Environment Variables](#environment-variables). Minimum for local:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/email_scheduler?schema=public"
REDIS_URL=redis://localhost:6380
SMTP_HOST=smtp.ethereal.email  SMTP_PORT=587  SMTP_USER=...  SMTP_PASS=...
GOOGLE_CLIENT_ID=dummy  GOOGLE_CLIENT_SECRET=dummy  GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
JWT_SECRET=change_me  FRONTEND_URL=http://localhost:5173  CONCURRENCY=5  MAX_EMAILS_PER_HOUR_PER_SENDER=100
```

### 3. Prisma
```bash
npx prisma generate          # after schema change
npx prisma migrate dev --name <name>  # dev (creates + applies)
npx prisma migrate deploy    # prod (applies existing)
npx prisma studio            # GUI at http://localhost:5555
```
Schema at `backend/prisma/schema.prisma` (enum `EmailJobStatus`, models `User`, `Sender`, `EmailJob` with `bullJobId @unique`, indexes on `senderId/status/scheduledAt`).

### 4. Run
```bash
npm run dev   # tsx watch src/index.ts → http://localhost:4000/api  → redirects to /api, /api/health checks pg + redis
```

---

## Frontend Setup

```bash
cd frontend
npm install
# .env (optional)
cat > .env <<'EOF'
VITE_API_URL=/api
EOF
npm run dev      # Vite 5173 proxies /api → http://localhost:4000 (vite.config.ts)
npm run build    # tsc + vite build → dist/
```

- Tailwind: `tailwind.config.js` `content: ["./index.html","./src/**/*.{ts,tsx}"]`, `postcss.config.js` autoprefixer
- Axios `src/api/client.ts` attaches `Authorization: Bearer <localStorage token>` + `withCredentials:true`
- Auth flow: `GET /api/auth/google` → Google → `GET /api/auth/google/callback` sets `httpOnly` cookie + redirects to `FRONTEND_URL/auth/callback?token=JWT` → frontend stores in `localStorage` + `GET /api/auth/me`

---

## Environment Variables

### Backend (`backend/.env.example`)
| Key | Default | Notes |
|-----|---------|-------|
| `PORT` | `4000` | Express listen |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5435/email_scheduler?...` | Prisma; host 5435 via compose |
| `REDIS_URL` / `REDIS_HOST` / `REDIS_PORT` | `redis://localhost:6380` | IORedis; BullMQ requires `maxRetriesPerRequest:null` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | `smtp.ethereal.email:587` | `nodemailer.createTestAccount()` generates user/pass |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | `http://localhost:4000/api/auth/google/callback` | Create at console.cloud.google.com → Credentials |
| `CONCURRENCY` | `5` | BullMQ `Worker` concurrency |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Per-sender fixed window + Worker `limiter` (see Rate Limiting) |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | `7d` | HS256; keep long & random in prod |
| `FRONTEND_URL` | `http://localhost:5173` | CORS `origin` + OAuth redirect |

### Frontend (`frontend/.env`)
| Key | Default | Notes |
|-----|---------|-------|
| `VITE_API_URL` | `/api` | Proxied to `4000` in dev; set to `https://api.example.com/api` in prod |

---

## Ethereal Email Setup

Ethereal is a fake SMTP that captures mail and gives a preview URL — no real delivery.

**Option A — manual:**
1. https://ethereal.email/create → copy `user`/`pass` → paste into `.env` `SMTP_USER`/`SMTP_PASS`
2. Send via `backend/src/services/emailService.ts` → logs `https://ethereal.email/message/...`

**Option B — code:**
```ts
import nodemailer from "nodemailer";
const acc = await nodemailer.createTestAccount();
console.log(acc.user, acc.pass); // → .env
// Worker logs preview automatically: nodemailer.getTestMessageUrl(info)
```

Verify: `POST /api/schedule` with `scheduledAt` = now + 10s → watch `worker` logs → open preview URL in browser.

---

## Architecture Overview

### Tech & Data

```
Frontend (Vite)  ──Axios + Bearer JWT──>  Backend (Express + Passport + JWT)
  Login, Dashboard, Compose modal             │  Prisma (Postgres)  User/Sender/EmailJob
  useFetch, useAuth (call /auth/me)         ├── BullMQ Queue "email-queue" (Redis)
                                             │     limiter: {max:1, duration:1s} (min gap)
                                             └── Worker (concurrency=CONCURRENCY)
                                                     Redis INCR + EXPIRE per sender hour window
                                                     Nodemailer (Ethereal SMTP)
```

### Scheduling Flow (text diagram)

```
Client                     Backend                              Redis/Postgres                Worker / SMTP
  │                           │                                     │                            │
  │ POST /api/schedule        │                                     │                            │
  │ {subject, body,           │─ zod validate ─┐                   │                            │
  │  recipients[],             │─ find Sender   │                   │                            │
  │  scheduledAt,             │                                     │                            │
  │  delayBetweenMs,          │  baseDelay = max(0, scheduledAt-now) │                            │
  │  maxPerHour, senderId} ──>│  staggerMs = max(delayBetween, 3600000/maxPerHour) │            │
  │                           │                                     │                            │
  │                           │ for i in recipients:                │                            │
  │                           │  effectiveDelay = baseDelay + i*staggerMs │                     │
  │                           │  effectiveScheduledAt = baseAt + i*staggerMs │                  │
  │                           │  prisma.EmailJob.create({status:"pending"}) ──> Postgres        │
  │                           │  bullQueue.add("send-email",       ──────────> Redis delayed ZSET│
  │                           │    {emailJobId, recipient, ...},   │  jobId = EmailJob.id (deterministic) │
  │                           │    {jobId: EmailJob.id, delay: effectiveDelay}) │               │
  │                           │  prisma.update({bullJobId: job.id, status:"queued"})           │
  │<─ 201 {jobs:[{recipient, emailJobId, bullJobId, delayMs}]} ───┘                            │
  │                           │                                     │                            │
  │                           │                                     │   ── when delay expires ──>│ (BRPOP)
  │                           │                                     │   job → wait → active     │ consumeHourSlot(senderId)
  │                           │                                     │                           │ INCR ratelimit:sender:{id}:hour:{floor(now/3600)}
  │                           │                                     │                           │ EXPIRE 3600 (first INCR)
  │                           │                                     │                           │ if count>MAX → moveToDelayed(nextHour) + DelayedError (not failed)
  │                           │                                     │                           │ else → transporter.sendMail(...)
  │                           │                                     │                           │      → prisma.update status:"sent" (or "failed" + throw for retry)
  │                           │                                     │                           │      → queueEvents completed/failed
  │                           │                                     │                            │
  │ GET /api/emails/scheduled │─ prisma.findMany where status in [pending,queued] paginated      │
  │ GET /api/emails/sent      │─ prisma.findMany where status in [sent,failed] paginated        │
  │ POST /api/parse-recipients│─ multer memoryStorage (2MB) → split /[\n,;]+ → EMAIL_REGEX → {valid,invalid} │
```

Key files: `backend/src/controllers/scheduleController.ts:16`, `backend/src/queues/emailQueue.ts:3`, `backend/src/workers/emailWorker.ts:18`, `backend/src/utils/rateLimiter.ts:7`, `backend/prisma/schema.prisma:10`.

---

## Persistence & Restart Behavior

**Jobs live in Redis, not Node memory.**
- BullMQ stores queue meta + jobs as Redis hashes (`bull:email-queue:*`), `delayed` ZSET (score = timestamp), `wait` list, `completed`/`failed` sets. `Queue` + `Worker` are thin clients that `BRPOP`/`BZPOPMIN` those keys.
- **Restart:** Creating a new `new Worker("email-queue", ...)` or `new Queue` simply reconnects with `IORedis(env.redis.url, {maxRetriesPerRequest:null})`. `delayed` jobs stay in ZSET until their timestamp; they are auto-promoted to `wait` → `active`. No code needs to re-enqueue.
- **Proof:** `docker-compose` `redis` volume `redisdata`; killing `tsx src/index.ts` while 2 jobs are `delayed` and restarting still shows `[worker] active` → `sent` without duplicate.
- **Idempotency:** `await emailQueue.add(..., {jobId: EmailJob.id})` — deterministic. Re-adding same DB row (e.g., via `backend/src/scripts/recoverQueuedJobs.ts`) returns existing job (`JobId already exists`) instead of duplicate. DB `bullJobId @unique` prevents second row, worker checks `if (status==="sent") skip` for duplicate deliveries.
- **Recovery script:** `DATABASE_URL=... REDIS_URL=... npx tsx src/scripts/recoverQueuedJobs.ts` re-adds `pending/queued` rows with same `jobId`; safe to run on every boot.

Trade-off: Redis is **ephemeral** if volume not persisted or `FLUSHDB`; `EmailJob` in Postgres is source-of-truth, but `bullJobId` links them for reconciliation.

---

## Rate Limiting — Approach & Trade-offs

### Implemented
**Two layers:**

1. **Queue-wide smooth spacing via BullMQ `limiter` (Worker `limiter: {max:1, duration:1000}`)** — token-bucket Lua in Redis, shared across all workers. Replaces custom `setTimeout`/`sleep` `delayBetweenEmailsMs` stagger. Auto-moves excess jobs to `delayed` (not failed). Cheap, atomic, no extra code. *Limitation:* queue-wide, not per-sender; tuning `max/duration` to `MAX/hour` (e.g., `100/hour → 1/36s`) can over-throttle single sender if many senders share queue.

2. **Per-sender fixed hour window (Redis `INCR` + `EXPIRE`) in `backend/src/utils/rateLimiter.ts:15` / `backend/src/workers/emailWorker.ts:60`**
   - `key = ratelimit:sender:{senderId}:hour:{floor(Date.now()/3600000)}`
   - `INCR` (atomic), first `1` → `EXPIRE 3600`, `TTL -1` guard. If `count > MAX` → `DECR` undo + `msUntilNextHourWindow = (window+1)*3600*1000 - now` + `job.moveToDelayed(now+resetMs, token)` + `throw new DelayedError()` (BullMQ's `handleFailed` treats `DelayedError` as not-failed, just fetches next job). DB stays `queued`, order preserved (all overflow jobs get same next-window timestamp; ZSET FIFO tie-break by `jobId`).

   ```ts
   // backend/src/workers/emailWorker.ts
   const rate = await consumeHourSlot(senderId); // INCR+EXPIRE
   if (!rate.allowed) {
     await job.moveToDelayed(Date.now()+rate.resetMs, token);
     throw new DelayedError();
   }
   ```

### Why fixed window vs alternatives?

| Approach | How | Pros | Cons |
|---|---|---|---|
| **Fixed window (chosen)** | `INCR` per hour bucket, `EXPIRE` | Simple, O(1), atomic, multi-instance safe (no in-memory map), `EXPIRE` auto-cleanup | Burst at window edge (e.g., 100 at 00:59 + 100 at 01:00 → 200 in 2min). Acceptable for email; mitigate with `limiter` spacing. |
| Sliding window (not chosen) | `ZADD` timestamps, `ZREMRANGEBYSCORE` 1h, `ZCARD` | True sliding, no edge burst | More Redis ops, needs Lua for atomicity, higher memory |
| Token bucket (BullMQ limiter) | `limiter: {max, duration}` | Built-in, smooth, no code | Queue-wide only; per-sender needs separate queues or custom key (we use Redis counter for per-sender) |
| In-memory counter | `Map<sender, count>` | Zero Redis | **Unsafe** across 2+ worker instances (each has own counter → over-send) |

**Tuning `MAX_EMAILS_PER_HOUR_PER_SENDER`:**
- Set via `env.maxEmailsPerHourPerSender` (default `100`). For `2/hour`, `delayed` jobs wait `msUntilNextHour` (~30-60min) — verify by `GET /api/emails/scheduled` + `redis-cli -p 6380 GET ratelimit:sender:<id>:hour:<window>`; don't wait full hour in tests — inspect `job.getState() === "delayed"` + `delay` field.
- **Throughput vs latency trade-off:** Low `MAX` (e.g., 2) protects reputation but starves burst campaigns; high `MAX` (100) allows burst but risks provider throttling. Combine with `limiter` (1/sec) for even spacing.

---

## API Endpoints

| Method | Path | Auth | Body/Query | Description |
|--------|------|------|------------|-------------|
| `GET` | `/api` | — | — | Hello `{message,version}` |
| `GET` | `/api/health` | — | — | `{status, checks:{postgres:"up",redis:"up"}}` |
| `POST` | `/api/schedule` | — | `{subject, body, recipients: string[1..1000], scheduledAt: ISO, delayBetweenEmailsMs?:0, maxEmailsPerHour?:, senderId: cuid}` | Zod validate, create `EmailJob` per recipient staggered (`baseDelay + i*staggerMs`), `add({jobId:id})`, return `{jobs,errors}` 201/207 |
| `GET` | `/api/emails/scheduled?page&limit&senderId&order` | — | query `page`/`limit`/`senderId`/`order` | `pending|queued`, paginated `{data, pagination}` |
| `GET` | `/api/emails/sent?page&limit&senderId&order` | — | query | `sent|failed`, paginated |
| `GET` | `/api/senders` | — | — | List `Sender` |
| `POST` | `/api/senders` | — | `{email, name?}` | Create sender (`P2002` → 409) |
| `POST` | `/api/parse-recipients` | — | `multipart/form-data file=@.csv|.txt (2MB)` | `EMAIL_REGEX` dedupe, returns `{count, validEmails, invalidCount}` |
| `GET` | `/api/auth/google` | — | — | 302 to Google OAuth |
| `GET` | `/api/auth/google/callback` | Google | `?token & cookie` | Issues `JWT` (cookie `httpOnly` + redirect `FRONTEND_URL/auth/callback?token=`) |
| `GET` | `/api/auth/me` | Bearer/`token` cookie | header `Authorization: Bearer` | `{user}` or 401 |
| `POST` | `/api/auth/logout` | — | — | `clearCookie("token")` |

All routes use `zod` validation + `backend/src/middlewares/errorHandler.ts:6` (Multer 413, Zod 400, Prisma P2 400, `DelayedError` ignored, 404 handler).

---

## Project Structure

```
.
├── docker-compose.yml          # postgres:5435→5432, redis:6380→6379, volumes pgdata/redisdata
├── package.json                # workspaces [backend,frontend], concurrently dev
├── backend/
│   ├── prisma/schema.prisma    # User (googleId), Sender, EmailJob (bullJobId @unique, indexes)
│   ├── prisma/migrations/20260825093026_init_email_scheduler/migration.sql
│   ├── src/
│   │   ├── config/{env,redis,nodemailer,jwt,passport}
│   │   ├── db/prisma.ts
│   │   ├── queues/emailQueue.ts        # Queue "email-queue" (defaultJobOptions, QueueEvents)
│   │   ├── workers/emailWorker.ts      # Worker concurrency, limiter, DelayedError rate limit, Ethereal send
│   │   ├── utils/rateLimiter.ts        # INCR+EXPIRE fixed window
│   │   ├── services/emailService.ts
│   │   ├── controllers/{health,schedule,email,parseRecipients,sender}
│   │   ├── middlewares/{auth,errorHandler}
│   │   ├── routes/{index,schedule,emails,auth,senders}
│   │   ├── scripts/recoverQueuedJobs.ts
│   │   └── index.ts                    # express, cors(credentials), cookieParser, passport, graceful shutdown
│   └── .env.example
└── frontend/
    ├── vite.config.ts          # proxy /api → 4000
    ├── tailwind.config.js + postcss
    ├── src/
    │   ├── api/{client (JWT+withCredentials), auth, emails, parse, health}
    │   ├── hooks/{useAuth (Context), useFetch, useHealth}
    │   ├── components/{Button, Input, Modal, Table, Badge, ProtectedRoute, Layout, ComposeModal}
    │   ├── pages/{Home, Login, AuthCallback, Dashboard (tabs Scheduled/Sent)}
    │   ├── types/index.ts      # EmailJob, User, PaginatedResponse, SchedulePayload, etc.
    │   └── App.tsx             # BrowserRouter /login /auth/callback /dashboard (protected) /*
    └── .env.example (VITE_API_URL=/api)
```

---

## Scripts

| Location | Command | What |
|----------|---------|------|
| root | `npm run dev` | `concurrently` backend `tsx watch` + frontend `vite` |
| backend | `npm run dev` | `tsx watch src/index.ts` |
| backend | `npm run build && npm start` | `tsc` → `node dist/index.js` |
| backend | `npx prisma migrate dev` / `deploy` / `generate` / `studio` | Prisma |
| backend | `DATABASE_URL=... npx tsx src/scripts/recoverQueuedJobs.ts` | Idempotent re-add `pending/queued` |
| frontend | `npm run dev` | Vite 5173 |
| frontend | `npm run build` | `tsc && vite build` |
| frontend | `npm run preview` | Preview dist |

---

## Features Checklist (Assignment Mapping)

| Requirement | Status | Where |
|-------------|--------|-------|
| **Monorepo** `/backend` + `/frontend` | ✅ | Root `package.json` workspaces, `docker-compose.yml` |
| **Backend** Node+TS+Express, BullMQ+Redis, Postgres+Prisma, Nodemailer Ethereal | ✅ | `backend/package.json`, `src/config/*`, `prisma/schema.prisma` |
| **Frontend** React+TS+Vite+Tailwind+Router+Axios | ✅ | `frontend/package.json`, `vite.config.ts`, `tailwind.config.js` |
| **Folder structure** `backend src/{routes,controllers,services,queues,workers,config,db}` + `frontend src/{pages,components,hooks,api,types}` | ✅ | `ls -R` |
| **docker-compose** Redis + Postgres | ✅ | `docker-compose.yml` healthchecks, volumes |
| **.env.example** both | ✅ | `backend/.env.example`, `frontend/.env` (VITE_API_URL) |
| **Hello world server connecting Redis+Postgres** | ✅ | `src/index.ts:33` `connectDb()` + `redis.ping()` + `GET /api/health` |
| **Prisma schema** `EmailJob {id,subject,body,recipientEmail,senderId,scheduledAt,status(pending/queued/sent/failed),bullJobId,createdAt,updatedAt}`, `Sender {id,email,name}`, `User {id,googleId,email,name,avatarUrl}` | ✅ | `prisma/schema.prisma:10` enum + indexes |
| **Migration + `bullJobId` duplicate prevention** | ✅ | `prisma/migrations/.../migration.sql`, `bullJobId @unique` + `jobId=id` explains restart dedupe |
| **BullMQ queue `email-queue` (Redis)** | ✅ | `src/queues/emailQueue.ts:3` |
| **POST /api/schedule** `{subject,body,recipients[],scheduledAt,delayBetweenMs,maxPerHour,senderId}` → staggered `delay = baseDelay + i*max(delayBetween,3600000/maxPerHour)` per recipient, `status queued` + `bullJobId` | ✅ | `src/controllers/scheduleController.ts:16` |
| **Worker concurrency via `CONCURRENCY` env, Ethereal send, `sent`/`failed` update** | ✅ | `src/workers/emailWorker.ts:42` `concurrency: env.concurrency`, `transporter.sendMail` + `nodemailer.getTestMessageUrl` |
| **Persistence — no loss on restart (Redis, not memory), `DelayedError` + `moveToDelayed`** | ✅ | `src/workers/emailWorker.ts:19` comments, `src/queues/emailQueue.ts:3` |
| **Deterministic `jobId = EmailJob.id` idempotency** | ✅ | `emailQueue.add(...,{jobId:id})` + `recoverQueuedJobs.ts` |
| **Hourly rate limiting — Redis `INCR`+`EXPIRE` `senderId:hourWindow`, `MAX_EMAILS_PER_HOUR_PER_SENDER`, `moveToDelayed` next window, `limiter:{max,duration}`** | ✅ | `src/utils/rateLimiter.ts:15`, `src/workers/emailWorker.ts:60`, `src/queues/emailQueue.ts` comments + `limiter: {max:1,duration:1000}` |
| **GET /api/emails/scheduled (pending/queued) paginated** | ✅ | `src/controllers/emailController.ts:16` `page/limit/senderId/order` zod |
| **GET /api/emails/sent (sent/failed) paginated** | ✅ | `src/controllers/emailController.ts:47` |
| **POST /api/parse-recipients CSV (multer + regex)** | ✅ | `src/controllers/parseRecipientsController.ts:5`, `src/routes/emails.ts:11` `multer.memoryStorage` 2MB, `EMAIL_REGEX`, dedupe |
| **Error handling + zod validation** | ✅ | `src/middlewares/errorHandler.ts:6` (Multer, Zod, Prisma P2, 404), `src/index.ts:26` |
| **Google OAuth `passport-google-oauth20` + JWT, `/api/auth/google`, `/callback`, `/me`, `/logout`, User upsert** | ✅ | `src/config/passport.ts:6`, `src/config/jwt.ts`, `src/middlewares/auth.ts`, `src/routes/auth.ts` |
| **Frontend Login + Google button → backend OAuth, callback JWT localStorage → /dashboard** | ✅ | `frontend/src/pages/Login.tsx`, `AuthCallback.tsx`, `api/auth.ts` |
| **React Router `/login`, `/dashboard`, `ProtectedRoute` (`/auth/me`)** | ✅ | `frontend/src/App.tsx:8`, `components/ProtectedRoute.tsx` |
| **Dashboard header (avatar/name/email/logout) + tabs Scheduled/Sent** | ✅ | `frontend/src/components/Layout.tsx`, `frontend/src/pages/Dashboard.tsx:9` |
| **Compose modal (subject, body, CSV upload via /parse-recipients, start time, delay, hourly limit, Schedule → POST /schedule)** | ✅ | `frontend/src/components/ComposeModal.tsx` |
| **Tables via `useFetch`, skeletons, empty states** | ✅ | `frontend/src/hooks/useFetch.ts`, `components/Table.tsx` `SkeletonRows`/`EmptyState` |
| **Reusable `Button, Table, Modal, Input, Badge` typed in `/types`** | ✅ | `frontend/src/components/*`, `frontend/src/types/index.ts:30` |

---

## Troubleshooting

- **`EADDRINUSE 4000/5432/6379/5435/6380`** — Host already runs Postgres/Redis. Use `lsof -i :5432` or `docker ps`, change `docker-compose.yml` host ports back to `5432:5432` if free, or keep `5435`/`6380` and update `DATABASE_URL`/`REDIS_URL`.
- **`Prisma P1000 Authentication failed`** — `DATABASE_URL` password mismatch; ensure `POSTGRES_PASSWORD=postgres` matches URL and `docker-compose` env.
- **`535 Authentication failed` (Ethereal)** — Regenerate at https://ethereal.email/create or `await nodemailer.createTestAccount()` and update `.env` `SMTP_USER`/`SMTP_PASS`.
- **`JobId already exists`** — Expected on re-add after restart due to `jobId=id` idempotency; worker will `getJob(id)` and treat as success.
- **`/api/auth/google` 500** — Set real `GOOGLE_CLIENT_ID`/`SECRET` from Google Cloud Console; keep `GOOGLE_CALLBACK_URL` exactly as registered.
- **CORS `credentials`** — Frontend must send `withCredentials:true` (already in `api/client.ts`); backend `cors({origin:FRONTEND_URL, credentials:true})`.

