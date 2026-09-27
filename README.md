# Stone AIO — Enterprise AI CRM & Autonomous Automation Platform

Stone AIO is a unified, multi-tenant AI CRM, workflow automation engine, and communication hub designed for modern businesses, sales teams, and agencies.

---

## 🏛 Architecture Overview

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Motion, TanStack Query, React Flow.
- **Backend API**: Node.js & Express, TypeScript, Zod request validation, SSE streaming.
- **Data & Storage**: PostgreSQL (Primary Relational Store), Prisma ORM, Redis (Bull Job Queues & Rate Limiting).
- **Authentication & Security**: Clerk JWT Authentication, strict multi-tenant workspace isolation, AES-256-GCM encryption for integration credentials.
- **Integrations & Communication**:
  - **Billing**: Stripe (Subscriptions, Webhook Idempotency, Credit limits).
  - **Email**: Resend (Transactional, Drip campaigns, inbound delivery webhook tracking).
  - **SMS / Voice**: Twilio (Inbound/Outbound messaging, AI Voice dispatch).
  - **Social / Ads**: Meta Leads Webhook, Ad Management & attribution.
  - **AI Engine**: Google Gemini (AI Actions, Inbox Copilots, Autonomous SDR Agents).

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/jackstonemedia/StoneAIOMainSystem.git
cd StoneAIOMainSystem
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in the required keys:
```bash
cp .env.example .env
```

Key required variables:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@localhost:5432/stoneaio?schema=public"
REDIS_URL="redis://localhost:6379"
CLERK_SECRET_KEY="sk_test_..."
CLERK_PUBLISHABLE_KEY="pk_test_..."
CHANNEL_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
GEMINI_API_KEY="..."
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
```

### 3. Database Migration & Prisma Generation
```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Run Development Server
```bash
npm run dev
```
The app will be available at `http://localhost:5173` (Vite) and API server at `http://localhost:4000`.

---

## 🧪 Testing & Quality Assurance

- **Type Check**:
  ```bash
  npm run typecheck
  ```
- **Unit & Integration Tests (Vitest)**:
  ```bash
  npm test
  ```
- **Production Build**:
  ```bash
  npm run build
  ```

---

## 🚢 Production Deployment

### Docker Deployment
The included multi-stage `Dockerfile` handles Prisma generation, TypeScript compilation, asset bundling, and runtime database migrations:
```bash
docker build -t stone-aio:latest .
docker run -p 4000:4000 --env-file .env.production stone-aio:latest
```

### Railway / Render
1. Connect repository to Railway or Render.
2. Ensure `DATABASE_URL` (PostgreSQL) and `REDIS_URL` (Redis with TLS support) are provisioned.
3. Configure required environment secrets.
4. Set build command: `npm run build`
5. Set start command: `npm run start` (executes `npx prisma migrate deploy && tsx server.ts`)

---

## 🛡 Security & Reliability Highlights

- **Webhook Idempotency**: Stripe, Twilio, and Meta lead webhooks are automatically deduplicated via `ProcessedWebhookEvent` tracking to prevent duplicate billing or ghost records.
- **Production Guardrails**: In `production` mode, development auth bypasses are strictly disabled, PostgreSQL is enforced, and channel encryption requires 64-character hexadecimal keys.
- **Health Checks**:
  - `GET /api/health/live` — Basic server liveness probe.
  - `GET /api/health/ready` — Database & service connectivity readiness probe (returns `503` if DB is unavailable).
