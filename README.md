# Ledger API

A production-grade, multi-tenant wallet and ledger API built with NestJS, PostgreSQL, Redis, and RabbitMQ.

Designed to demonstrate financial-grade engineering: double-entry bookkeeping, pessimistic locking, idempotency, the transactional outbox pattern, and signed webhook delivery.

---

## What It Does

Each tenant (e.g. a fintech company) onboards via API key. Their users hold wallets in multiple currencies. Transfers between wallets are recorded as immutable double-entry journal entries — balances are always derived, never stored. Events are published reliably via the outbox pattern and delivered to tenants as signed webhook payloads.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | NestJS (TypeScript) |
| Database | PostgreSQL via Prisma ORM v7 |
| Cache | Redis |
| Message Broker | RabbitMQ |
| Auth | JWT + API Key (Argon2 hashing) |
| Encryption | AES-256-GCM (webhook secrets at rest) |

---

## Architecture Overview

```text
Client
  │
  ▼
[ API Gateway / NestJS ]
  ├── Tenant Module      — registration, API key issuance
  ├── Auth Module        — JWT + API key strategies
  ├── Wallet Module      — wallet creation, balance reads (Redis cache)
  ├── Transfer Module    — transfer initiation, pessimistic locking
  ├── Ledger Module      — double-entry journal engine
  └── Outbox Worker      — polls DB, publishes to RabbitMQ
          │
          ▼
    [ RabbitMQ ]
          │
    ┌─────┴──────┐
    ▼            ▼
 Ledger       Notification
 Consumer     Consumer
 (journals)   (webhooks → tenant)
```

---

## Key Design Decisions

**1. Balances are never stored — always derived**
`balance = SUM(credits) - SUM(debits)` from `JournalEntry`. Eliminates balance drift. Redis cache sits in front for read performance.

**2. Double-entry bookkeeping**
Every transfer writes a DEBIT on the source wallet and a CREDIT on the destination wallet atomically. The ledger is append-only — no updates or deletes.

**3. Pessimistic locking on transfers**
`SELECT FOR UPDATE` on the source wallet inside the transfer transaction prevents race conditions under concurrent load.

**4. Transactional outbox pattern**
The `Transfer` record and its `OutboxEvent` are written in the same Postgres transaction. The outbox worker publishes to RabbitMQ separately — guarantees at-least-once delivery even if the broker is down.

**5. Signed webhooks**
Tenant webhook secrets are encrypted at rest (AES-256-GCM). Outbound payloads are signed with HMAC-SHA256. Tenants verify the `X-Webhook-Signature` header — the secret never travels over the wire.

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- pnpm

### 1. Clone and install

```bash
git clone <repo-url>
cd ledger-api
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
PORT=8000

POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ledger
POSTGRES_PORT=5432
DB_URL=postgresql://postgres:postgres@localhost:5432/ledger

REDIS_PASSWORD=redis
REDIS_PORT=6379

RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=/
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672

# Generate with: openssl rand -hex 32
WEBHOOK_ENCRYPTION_KEY=
```

### 3. Start infrastructure

```bash
docker-compose up -d
```

Starts PostgreSQL, Redis, and RabbitMQ.

### 4. Run migrations and seed

```bash
npx prisma migrate dev
pnpm run seed
```

The seed script creates a test tenant, user, and GBP wallet. It outputs the raw API key and webhook secret — **save them, they are shown once**.

### 5. Start the API

```bash
pnpm run start:dev
```

| URL | Description |
| --- | --- |
| `http://localhost:8000/api/v1` | API base |
| `http://localhost:8000/api/docs` | Swagger UI |

---

## Security

| Concern | Approach |
| --- | --- |
| API keys | `crypto.randomBytes` generation, only Argon2 hash stored |
| API key format | Prefixed `lapi_...` for easy identification and masking in logs |
| API key expiry | Configurable `apiKeyExpiresAt` per tenant |
| Webhook secrets | Encrypted at rest with AES-256-GCM, never transmitted |
| Webhook delivery | Payload signed with HMAC-SHA256, verified by tenant via `X-Webhook-Signature` |
| Tenant isolation | All queries scoped to `tenantId` — no cross-tenant data access |
| Passwords | Hashed with Argon2 |

---

## Project Status

| Week | Theme | Status |
| --- | --- | --- |
| Week 1 | Foundation & Auth | In progress |
| Week 2 | Core Financial Logic | Not started |
| Week 3 | Event-Driven & Observability | Not started |
| Week 4 | Polish & Deploy | Not started |

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the full day-by-day breakdown.

---

## Author

Adisa Oluwasegun Qasim
