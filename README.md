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
  ├── Tenant Module      — registration, API key issuance & rotation
  ├── Auth Module        — JWT + API key + admin key strategies
  ├── Wallet Module      — wallet creation, balance reads (Redis cache)
  ├── Transfer Module    — transfer initiation, pessimistic locking
  ├── Ledger Module      — double-entry journal engine
  ├── Health Module      — /health, /health/db, /health/cache, /health/queue
  └── Outbox Worker      — pg_notify-driven publisher to RabbitMQ
          │
          ▼
    [ RabbitMQ ]
          │
    ┌─────┴────────────┐
    ▼                  ▼
 Ledger            Notification
 Consumer          Consumer
 (writes journal   (signed webhook
  entries + DLQ)    → tenant + DLQ)
          │
          ▼
 Transfer Completed
 Consumer
 (updates transfer
  status + DLQ)
          │
          ▼
 DLQ Admin API
 (list & replay
  dead-lettered events)
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

**5. pg_notify-driven outbox worker**
Rather than polling on a fixed interval, the outbox worker listens on a Postgres `LISTEN/NOTIFY` channel. A DB trigger fires `pg_notify` on every new outbox row — the worker wakes immediately and flushes the batch. A 60-second fallback timer catches anything missed during a restart window.

**6. Signed webhooks**
Tenant webhook secrets are encrypted at rest (AES-256-GCM). Outbound payloads are signed with HMAC-SHA256. Tenants verify the `X-Webhook-Signature` header — the secret never travels over the wire.

**7. Dead Letter Queue with DB persistence**
Failed messages retry up to 3 times with exponential backoff (1s → 2s → 4s). After exhausting retries, messages land in a DLQ and are also persisted to the `DlqEvent` table. A SYSTEM_ADMIN-only API (`GET /admin/dlq/events`, `POST /admin/dlq/events/:id/replay`) allows inspection and replay without RabbitMQ management UI access.

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
| `http://localhost:8000/api/v1/health` | Health check (all deps) |

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
| Admin endpoints | Protected by separate `x-admin-key` guard and `SYSTEM_ADMIN` role |

---

## Week 2 — Core Financial Logic

### Transfer Flow

A transfer moves value between two tenant-owned wallets. The flow is intentionally split into two phases so a broker outage can never lose a committed transfer.

```text
POST /transfers
  │
  ├── Guard: amount > 0, walletFrom ≠ walletTo
  ├── Resolve walletFrom & walletTo (tenant-scoped)
  ├── Snapshot FX rate (FxRateService)
  │
  └── DB transaction (TransferRepository.createWithOutbox)
        ├── SELECT … FOR UPDATE on walletFrom  ← pessimistic lock
        ├── SUM(credits) − SUM(debits) ≥ fromAmount?  ← balance check
        ├── INSERT Transfer (status = INITIATED)
        └── INSERT OutboxEvent (TRANSFER_INITIATED, PENDING)
```

### Invariants enforced

| Invariant | Where |
| --- | --- |
| Balance never stored, always derived | `LedgerRepository.computeBalance` — `SUM(credits) − SUM(debits)` |
| No overdraft possible | `SELECT FOR UPDATE` + balance check inside the same transaction |
| No duplicate transfer on retry | Unique `idempotencyKey` column; Prisma P2002 → 422 |
| Journal entries always come in pairs | `writeEntryPair` wraps both INSERTs in a single `$transaction` |
| No cross-tenant data access | Every query passes through `BaseRepository.withTenant` |
| Transfer and outbox event are atomic | Both written in the same Postgres transaction |

### FX rate handling

`FxRateService.getRate(from, to)` returns a snapshot string rate at initiation time. The rate is stored on the `Transfer` record — so the ledger always reflects the rate that was locked in, regardless of later market moves. Same-currency transfers return `"1"` and skip the rate table entirely.

### Race condition protection

The `SELECT … FOR UPDATE` on `walletFrom` serialises concurrent transfers from the same source wallet. The stress test in `transfer.concurrent.spec.ts` fires two 75 USD transfers against a 100 USD wallet simultaneously and asserts exactly one succeeds and the final balance is 25 USD.

### Test coverage

| File | Type | What it covers |
| --- | --- | --- |
| `transfer.service.spec.ts` | Unit | All service guards: zero amount, negative amount, same wallet, wallet not found, insufficient funds (bubbled from repo), duplicate idempotency key, unexpected DB error |
| `transfer.integration.spec.ts` | Integration (real DB) | createTransfer → Transfer + OutboxEvent written; consumer simulation → DEBIT + CREDIT journal entries; final balance correctness; overdraft, self-transfer, zero amount, idempotency deduplication |
| `transfer.concurrent.spec.ts` | Stress / integration (real DB) | Pessimistic lock prevents double-spend under concurrent load |

---

## Week 3 — Event-Driven Layer & Observability

### Full Async Flow

```text
[pg_notify trigger fires on OutboxEvent INSERT]
          │
          ▼
    OutboxWorker.flush()
          │
          ▼
    RabbitMQ (transfer.* topic exchange)
          │
    ┌─────┴──────────────┐──────────────────────┐
    ▼                    ▼                       ▼
 Ledger Consumer   Transfer Completed       Notification Consumer
 (TRANSFER_INITIATED)  Consumer             (TRANSFER_COMPLETED /
    │              (TRANSFER_COMPLETED)      TRANSFER_FAILED)
    │                    │                       │
    ▼                    ▼                       ▼
 Write DEBIT +      Update Transfer          Deliver signed
 CREDIT journal     status →                 webhook POST
 entries            COMPLETED                to tenant URL
    │
    ▼
 Invalidate Redis
 cache for both
 wallets
```

### Outbox Worker

The worker uses Postgres `LISTEN/NOTIFY` to react immediately when a new outbox row is inserted — no polling latency. A 60-second fallback interval catches any events missed during a restart window. The worker is crash-safe: if it goes down mid-publish, the outbox row remains `PENDING` and is re-published on the next flush.

### Dead Letter Queue

All three consumers (Ledger, TransferCompleted, Notification) share a consistent DLQ strategy:

| Attempt | Delay |
| --- | --- |
| Retry 1 | 1 second |
| Retry 2 | 2 seconds |
| Retry 3 | 4 seconds |
| After retry 3 | Written to DLQ + persisted to `DlqEvent` table |

Failed messages are persisted to the `DlqEvent` Postgres table, allowing inspection and replay without requiring access to the RabbitMQ management UI.

### DLQ Admin API

Protected by `x-admin-key` header and `SYSTEM_ADMIN` role.

| Endpoint | Description |
| --- | --- |
| `GET /admin/dlq/events` | List DLQ events, filterable by queue and resolved status |
| `POST /admin/dlq/events/:id/replay` | Replay a dead-lettered event |

### Health Checks

| Endpoint | Checks |
| --- | --- |
| `GET /health` | PostgreSQL + Redis + RabbitMQ |
| `GET /health/db` | PostgreSQL only |
| `GET /health/cache` | Redis only |
| `GET /health/queue` | RabbitMQ only |

### Observability

- Every HTTP request generates a UUID `correlationId` that flows through: request logs → outbox event payload → RabbitMQ message headers → consumer logs.
- All log lines include `correlationId`, `tenantId`, `level`, and `timestamp`.
- A single correlation ID is traceable end-to-end across all services for any given transfer.
- Graceful shutdown: `app.enableShutdownHooks()` ensures in-flight consumers finish and connections are closed cleanly before the process exits.

---

## Project Status

| Week | Theme | Status |
| --- | --- | --- |
| Week 1 | Foundation & Auth | Complete |
| Week 2 | Core Financial Logic | Complete |
| Week 3 | Event-Driven & Observability | Complete |
| Week 4 | Frontend Foundation | Not started |
| Week 5 | Frontend Advanced Features | Not started |
| Week 6 | Polish & Deploy | Not started |

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the full day-by-day breakdown.

---

## Author

Adisa Oluwasegun Qasim
