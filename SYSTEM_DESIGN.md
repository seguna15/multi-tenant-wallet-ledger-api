# Multi-Tenant Wallet & Ledger API — System Design Document

**Author:** Adisa Oluwasegun Qasim  
**Version:** 1.0.0  
**Date:** March 2026  
**Status:** In Progress

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [System Components](#2-system-components)
3. [Architecture Overview](#3-architecture-overview)
4. [Data Flow — Transfer Lifecycle](#4-data-flow--transfer-lifecycle)
5. [Data Model](#5-data-model)
6. [Architectural Decisions](#6-architectural-decisions)
7. [Observability Strategy](#7-observability-strategy)
8. [Failure Scenarios & Mitigations](#8-failure-scenarios--mitigations)
9. [Tech Stack](#9-tech-stack)
10. [Future Improvements](#10-future-improvements)

---

## 1. Problem Statement

### What it is
A multi-tenant API that serves as the financial source of truth for organisations managing client money. Built on double-entry bookkeeping principles where every debit has a corresponding credit.

### Who uses it
Fintech companies, neobanks, and payment processors who need a reliable, auditable record of client transactions across multiple currencies.

### The core problem it solves
Three specific problems:

1. **Failed transaction disputes** — when a client claims money left their account but never arrived elsewhere, the ledger provides an immutable record of exactly what happened and at what stage it failed
2. **Charge disputes** — every debit entry has a corresponding credit entry; any disparity is immediately identifiable by evaluating the journal entries rather than relying on a single balance number
3. **Regulatory audits** — financial regulators (central banks, FCA, etc.) require a complete, tamper-evident audit trail of all client transactions; a ledger provides this by design

### Why a ledger and not just a balance

A balance is a single number with no history. A ledger is an immutable, append-only record of every debit and credit entry.

- If -100 leaves Wallet A, +100 must arrive in Wallet B — the ledger enforces this as a hard constraint
- Reversals do not edit existing entries; they create new entries in the opposite direction
- If a transfer is initiated and fails before completing, the database transaction rolls back and no entries are written — the ledger remains clean
- If a transfer completes but needs to be reversed later (e.g. fraud confirmed), new opposing entries are written while the originals remain untouched
- This makes the entire transaction history tamper-evident and fully auditable

---

## 2. System Components

### Tenant Service
Manages all tenant lifecycle operations. A tenant is a financial organisation (fintech, neobank, payment processor) that uses this API to manage their own clients' wallets.

**Responsibilities:**
- Tenant registration, update, and deactivation
- API key generation and rotation
- Tenant-level configuration management

### User Service
Manages end users who belong to a tenant. A user cannot exist without a tenant — this is enforced at the database level via foreign key constraint.

**Responsibilities:**
- User CRUD operations, scoped to a tenant
- User profile management
- Enforces tenant-level data isolation

### Auth Service
Handles two distinct authentication flows depending on the caller type.

**Responsibilities:**
- JWT token issuance and validation for human users (browser/Postman)
- API key validation for tenant systems (B2B, machine-to-machine)
- Attaches `tenantId` to every authenticated request context
- All downstream services use this `tenantId` to scope their queries

```
Browser / Postman users  →  JWT tokens
Tenant systems (B2B)     →  API keys in request header
Both                     →  Validated by Auth Service guards
```

### Wallet Service
Manages client wallets. Each wallet is scoped to a user and a tenant, and supports multiple currencies.

**Responsibilities:**
- Wallet creation and management
- Multi-currency wallet support (NGN, USD, GBP, etc.)
- Balance reads via Redis cache first, HTTP to Ledger Service on cache miss
- Cache invalidation whenever a new journal entry is written to that wallet

```
Balance Read Flow:
Client requests balance
        ↓
Wallet Service checks Redis cache
        ↓
Cache hit  →  return immediately
Cache miss →  HTTP call to Ledger Service
           →  Ledger calculates: SUM(credits) - SUM(debits)
           →  Cache result with TTL
           →  Return balance
```

### Transfer Service
Initiates and tracks the lifecycle of all transfers between wallets. Owns the Transfer record exclusively.

**Responsibilities:**
- Validates transfer request (sufficient funds, valid wallets, tenant scoping)
- Writes Transfer record and Outbox record atomically in a single DB transaction
- Manages Transfer status lifecycle (INITIATED → PROCESSING → COMPLETED / FAILED)
- Consumes `TRANSFER_COMPLETED` events to update its own Transfer record status

### Ledger Service
The financial source of truth. Consumes transfer events and writes immutable journal entries.

**Responsibilities:**
- Consumes `TRANSFER_INITIATED` events from RabbitMQ
- Writes DEBIT and CREDIT journal entries atomically in a single Postgres transaction
- Calculates wallet balances by summing journal entries (never stores balance directly)
- Publishes `TRANSFER_COMPLETED` event upon successful journal entry writes
- Invalidates Redis cache for affected wallets after writing entries
- The Ledger Service is write-protected — nothing writes to the ledger except through validated transfer events

### Notification Service
Delivers signed webhook payloads to tenant-registered URLs on transfer events. Fully decoupled from the transfer flow — the Transfer Service has no knowledge of or dependency on this service.

**Responsibilities:**
- Consumes `TRANSFER_COMPLETED` and `TRANSFER_FAILED` events from RabbitMQ
- Looks up the tenant's registered webhook URL from the database
- Builds a signed payload using HMAC-SHA256 — tenant uses the signature to verify the request genuinely came from this platform
- POSTs the signed payload to the tenant's webhook URL
- Logs the delivery attempt, response status, and timestamp
- Retries once on failure — if the second attempt fails, the event is passed to the DLQ for manual review

**What is intentionally out of scope for v1:**
- Multiple retries with exponential backoff
- Per-event webhook filtering
- Webhook delivery history API
- Tenant-facing webhook management dashboard
- Re-delivery on demand

### Dead Letter Queue (DLQ)
Catches messages that fail after maximum retry attempts.

**Responsibilities:**
- Receives messages that have exhausted retry attempts from all consumer queues
- Triggers alerts for manual review by the operations team
- Preserves the full message payload and correlation ID for investigation
- Transfers stuck in `PROCESSING` state are detectable via the DLQ

---

## 3. Architecture Overview

```
                        ┌─────────────────┐
                        │   API Gateway   │
                        │  (NestJS App)   │
                        └────────┬────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      Auth Service       │
                    │  JWT + API Key Guards   │
                    │  Attaches tenantId      │
                    └────────────┬────────────┘
                                 │ tenantId in every request
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
┌─────────▼────────┐  ┌─────────▼────────┐  ┌─────────▼────────┐
│  Tenant Service  │  │   User Service   │  │  Wallet Service  │
│  CRUD + API Keys │  │  CRUD (scoped)   │  │  Balance reads   │
└──────────────────┘  └──────────────────┘  └────────┬─────────┘
                                                      │ HTTP (cache miss)
                                            ┌─────────▼─────────┐
                                            │   Redis Cache     │
                                            │  Balance + Rate   │
                                            │    Limiting       │
                                            └───────────────────┘
                                                      │
┌─────────────────────────────────────────────────────▼──────────┐
│                      Transfer Service                           │
│  Validates → Writes Transfer + Outbox (atomic) → Publishes     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Outbox Worker
                           ▼
                    ┌──────────────┐
                    │   RabbitMQ   │
                    │Topic Exchange│
                    └──────┬───────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
  ┌────────────────┐  ┌──────────┐  ┌─────────────────┐
  │ Ledger Service │  │ Transfer │  │  Notification   │
  │ Writes journal │  │ Service  │  │    Service      │
  │ entries        │  │ Updates  │  │ Sends alerts    │
  │ Publishes      │  │ status   │  │                 │
  │ COMPLETED event│  └──────────┘  └─────────────────┘
  └────────┬───────┘
           │ on failure after max retries
           ▼
  ┌─────────────────┐
  │  Dead Letter    │
  │     Queue       │
  │ Manual review   │
  └─────────────────┘
```

---

## 4. Data Flow — Transfer Lifecycle

### Happy Path — $100 Transfer from Wallet A to Wallet B

```
Step 1 — Request arrives
  Tenant system sends POST /transfers
  API key in Authorization header

Step 2 — Authentication & scoping
  Auth Service validates API key
  Identifies tenant from key
  Attaches tenantId to request context
  All downstream queries are scoped to this tenantId

Step 3 — Validation (Transfer Service)
  Confirms Wallet A belongs to the requesting tenant
  Confirms Wallet B belongs to the requesting tenant
    → If Wallet B belongs to a different tenant:
       Reject immediately with 422 Unprocessable Entity
       "Cross-tenant transfers are not supported.
        Both wallets must belong to the same tenant."
  Calls Wallet Service for Wallet A balance
    → Wallet Service checks Redis cache
    → Cache hit: returns cached balance
    → Cache miss: HTTP call to Ledger Service
                  Ledger calculates SUM(credits) - SUM(debits)
                  Result cached in Redis with TTL
  Confirms Wallet A has sufficient funds

Step 4 — Atomic DB write (Transfer Service)
  Opens Postgres transaction
  Writes Transfer record          { status: PROCESSING }
  Writes Outbox record            { status: PENDING, event: TRANSFER_INITIATED }
  Commits — both writes succeed or both roll back

Step 5 — Outbox Worker publishes
  Background worker polls for PENDING outbox records
  Publishes TRANSFER_INITIATED event to RabbitMQ
  Updates Outbox record           { status: PUBLISHED }

Step 6 — Ledger Service consumes event
  Receives TRANSFER_INITIATED from RabbitMQ
  Opens Postgres transaction
  Writes DEBIT journal entry      { walletId: A, amount: 100, type: DEBIT }
  Writes CREDIT journal entry     { walletId: B, amount: 100, type: CREDIT }
  Invalidates Redis cache for Wallet A and Wallet B
  Commits transaction
  Publishes TRANSFER_COMPLETED event to RabbitMQ topic exchange

Step 7 — Transfer Service consumes TRANSFER_COMPLETED
  Updates its own Transfer record { status: COMPLETED }

Step 8 — Notification Service consumes TRANSFER_COMPLETED
  Looks up tenant's registered webhook URL
  Builds payload:  { transferId, status, amount, currency, timestamp }
  Signs payload:   HMAC-SHA256 signature using tenant's webhook secret
  Attaches header: X-Webhook-Signature: <hmac_signature>
  POSTs signed payload to tenant's webhook URL
  Logs delivery attempt and response status
  On failure: retries once
    → Second failure: message moves to DLQ
  (Transfer Service has no knowledge this happened)
```

### Transfer State Machine

```
INITIATED ──► PROCESSING ──► COMPLETED
                         └──► FAILED ──► RETRYING ──► DEAD (DLQ)
```

---

## 5. Data Model

### Core Principles

- **Tenants** own Users, Wallets, and Transfers — all queries are scoped by `tenantId`
- **Balance is never stored** on the Wallet — it is always derived: `SUM(credits) - SUM(debits)` from JournalEntry
- **JournalEntry is append-only** — entries are never updated or deleted
- **Amount is always positive** on JournalEntry — direction is carried by `EntryType` (DEBIT / CREDIT)
- **Decimal(19,4)** is used for all monetary values — never Float (floating point arithmetic causes rounding errors on large amounts)
- **Transfers own their status** — only the Transfer Service updates the Transfer record

### Entity Relationships

```
Tenant
  └── Users         (tenantId FK)
  └── Wallets       (tenantId FK, userId FK)
  └── Transfers     (tenantId FK, fromWalletId FK, toWalletId FK)
        └── JournalEntries  (transferId FK, walletId FK)
        └── OutboxEvents    (transferId FK)
```

### Key Design Decisions on Schema

**Why `Decimal(19,4)` not `Float`?**
Float is a binary approximation. `100.10 * 3` in float arithmetic can produce `300.29999999`. In a financial system that discrepancy compounds across millions of transactions. Decimal stores the exact value.

**Why is balance never stored on Wallet?**
A stored balance is a single number with no history or auditability. If a transfer fails halfway through, the balance could be incorrect with no way to explain why. A ledger-derived balance is always provably correct — you can trace every cent.

**Why is JournalEntry append-only?**
Immutability is what makes a ledger tamper-evident. Regulators and auditors need to trust that historical records have not been altered. Reversals create new entries; they never modify old ones.

**Why are cross-tenant transfers prohibited?**
Both `fromWalletId` and `toWalletId` must share the same `tenantId`. Each tenant is an isolated financial environment — allowing transfers across tenant boundaries would require a platform-level settlement layer and explicit trust configuration between tenants. This is enforced at two levels: the Transfer Service validates both wallets against the requesting tenant's ID before opening any DB transaction, and a database-level check constraint provides a second line of defence. A mismatch results in a `422 Unprocessable Entity` before any write occurs.

---

## 6. Architectural Decisions

### Decision 1 — Event Choreography over Direct Service Calls

**What:** Services communicate state changes by publishing events to RabbitMQ. No service updates another service's database directly.

**Why:** The Transfer Service owns the Transfer record. It would violate data ownership boundaries for the Ledger Service to update the Transfer status directly. Instead, the Ledger Service publishes a `TRANSFER_COMPLETED` event and the Transfer Service updates its own record upon consuming it.

**Tradeoff:** Eventual consistency — there is a small window where journal entries are written but the Transfer record still shows `PROCESSING`. This is acceptable because the ledger (the source of truth) is already correct. The Transfer status is a convenience view, not the authoritative record.

---

### Decision 2 — Outbox Pattern for Atomic DB Write + Message Publish

**What:** The Transfer record and Outbox record are written in the same Postgres transaction. A background worker handles the RabbitMQ publish separately.

**Why:** Without this pattern, a service crash between a successful DB write and a RabbitMQ publish creates a silent failure — journal entries are never written, but the system has no way to detect or recover this. The outbox pattern guarantees that a committed DB write will always eventually result in a published message.

**Tradeoff:** Slight latency introduced by the outbox worker polling interval. Acceptable for this use case as near-real-time (not real-time) settlement is standard in financial systems.

---

### Decision 3 — HTTP for Balance Reads, Not RabbitMQ

**What:** Wallet Service calls Ledger Service via HTTP for balance reads on cache miss, rather than using RabbitMQ request/reply.

**Why:** RabbitMQ is designed for fire-and-forget async messaging. Balance reads are synchronous — the client is waiting for an immediate response. Using RabbitMQ's request/reply pattern for this adds complexity and latency without benefit. HTTP is simpler, easier to debug, and sufficient for this use case.

**Tradeoff:** At very high scale (millions of requests/second), HTTP overhead becomes measurable and gRPC would be preferable. At the scale this system targets, HTTP + Redis cache is production-grade and the right tradeoff.

---

### Decision 4 — Redis Cache for Balance Reads

**What:** Balance reads are served from Redis cache first. Cache is invalidated when a new journal entry is written to that wallet.

**Why:** Balance calculation requires summing all journal entries for a wallet — a potentially expensive query as transaction history grows. Caching eliminates repeated calculation for the same wallet between transactions.

**Tradeoff:** Cache invalidation complexity. The Ledger Service must reliably invalidate the cache after every journal write. A missed invalidation would serve a stale balance. This is mitigated by keeping the TTL short as a safety net.

---

### Decision 5 — Ledger Service is Write-Protected

**What:** Nothing writes to the ledger except through validated transfer events consumed from RabbitMQ.

**Why:** The ledger is the financial source of truth. Direct writes from multiple services would make it impossible to guarantee consistency and auditability. All writes go through a single controlled, validated path.

**Tradeoff:** The Ledger Service becomes a potential bottleneck. Mitigated by horizontal scaling of consumers and Kafka partitioning if volume demands it in future.

---

## 7. Observability Strategy

### Structured Logging (Pino)

Every log line is JSON — not a plain string. This is how every production financial system logs.

```json
{
  "level": "info",
  "time": "2026-04-06T10:00:00.000Z",
  "correlationId": "txn_abc123",
  "tenantId": "tenant_xyz",
  "msg": "Transfer initiated",
  "fromWallet": "wallet_001",
  "toWallet": "wallet_002",
  "amount": 5000,
  "currency": "USD"
}
```

### Correlation IDs

A single ID generated at the HTTP layer that travels through every stage of the transfer lifecycle:

```
HTTP Request arrives    →  correlationId generated
Transfer Service logs  →  correlationId attached
Outbox publishes       →  correlationId in RabbitMQ message headers
Ledger Service logs    →  same correlationId
DLQ message            →  correlationId + failure reason
```

This means any failed transfer can be fully traced by grepping a single ID across all logs.

### Health Checks (@nestjs/terminus)

```
GET /health        →  overall system status
GET /health/db     →  PostgreSQL reachable?
GET /health/cache  →  Redis reachable?
GET /health/queue  →  RabbitMQ reachable?
```

Used by Railway for deployment health routing and readiness probes.

### Graceful Shutdown

On `SIGTERM` (e.g. during a deployment):
1. Stop accepting new HTTP requests
2. Finish all in-flight DB transactions
3. Flush pending outbox messages
4. Close DB and queue connections cleanly

Without this, a deployment mid-transfer could leave journal entries in an inconsistent state.

---

## 8. Failure Scenarios & Mitigations

| Scenario | What happens | Mitigation |
|----------|-------------|------------|
| Crash before DB write | Nothing written, client retries | Idempotency keys prevent duplicate processing on retry |
| Crash during DB write | Postgres rolls back automatically, both entries gone | ACID transaction, client sees original balance |
| Crash after DB write, before RabbitMQ publish | Outbox record is PENDING | Outbox worker picks it up on recovery and publishes |
| Ledger Service fails to process event | RabbitMQ retries with exponential backoff | After max retries, message moves to DLQ, alert fires |
| Balance cache serves stale data | Client sees slightly outdated balance briefly | Short TTL as safety net, cache invalidated on every journal write |
| Duplicate transfer request | Second request hits same idempotency key | Returns original response, no second journal entry written |
| Webhook delivery fails | Tenant's URL is unreachable or returns non-2xx | Single retry attempt — on second failure message moves to DLQ, delivery attempt logged with response status |

---

## 9. Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | NestJS + TypeScript | First-class module system, built-in DI, native Passport/Swagger support |
| ORM | Prisma | Version-controlled migrations, auto-generated types, clean schema file |
| Primary Database | PostgreSQL | ACID compliance, row-level security for tenant isolation, Decimal type support |
| Cache | Redis | Sub-millisecond balance reads, sliding window rate limiting |
| Message Broker | RabbitMQ | Topic exchanges for fanout events, DLQ support, sufficient for this scale |
| Auth | Passport.js + JWT | First-class NestJS integration, supports both JWT and API key strategies |
| Logging | nestjs-pino | Structured JSON logs, low overhead, correlation ID support |
| Health Checks | @nestjs/terminus | Built-in NestJS support, Railway-compatible |
| API Docs | Swagger (@nestjs/swagger) | Auto-generated from decorators, explorable UI |
| Testing | Jest | Built into NestJS, supports unit and e2e |
| Containerisation | Docker + Docker Compose | Full local stack in one command |
| Deployment | Railway (free tier) | Simple deployment, managed Postgres, free SSL |

---

## 10. Future Improvements

These are intentionally out of scope for v1.0 but worth noting to demonstrate production thinking:

**Reconciliation Job**
A scheduled task that runs every few minutes checking for transfers stuck in `PROCESSING` state older than a configurable threshold. Flags them for investigation. Essential in production to catch the edge case where `TRANSFER_COMPLETED` event is lost after journal entries are written.

**Metrics & Dashboards (Prometheus + Grafana)**
The 4th observability pillar. Track transfer volume, error rates, queue depth, cache hit/miss ratio, and balance calculation latency over time.

**gRPC for Internal Service Communication**
At very high throughput, replacing HTTP with gRPC for balance reads would reduce overhead and provide strongly-typed service contracts via protobuf schemas.

**Kafka for High-Volume Event Streaming**
RabbitMQ is sufficient for moderate volume. At millions of transactions per second, Kafka's partitioned log model, consumer group scaling, and message replay capability would be preferable.

**Full Webhook Management System**
v1 implements a minimal webhook — signed payload delivery to a single registered URL with one retry. A full webhook system would add: configurable retry schedules with exponential backoff, per-event type filtering (tenant chooses which events trigger a webhook), a delivery history API so tenants can inspect past deliveries, re-delivery on demand for failed events, and a tenant-facing management dashboard for URL rotation and secret regeneration.

**Cross-Tenant Transfers**
v1 intentionally prohibits transfers between wallets belonging to different tenants. A future settlement layer would introduce a platform-owned settlement wallet as an intermediary, with explicit tenant-to-tenant trust configuration required before cross-tenant transfers are permitted. This maps to how correspondent banking works in traditional finance.

**Multi-Region Deployment**
Active-passive or active-active database replication across regions for disaster recovery and reduced latency for geographically distributed tenants.

---

*This document reflects all architectural decisions made prior to implementation. It will be updated as tradeoffs are revisited during development.*
