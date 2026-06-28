# Multi-Tenant Wallet & Ledger API — Project Plan

**Author:** Adisa Oluwasegun Qasim  
**Start Date:** 6th April 2026  
**End Date:** 21st May 2026  
**Hours/Day:** 4–5 hrs · Mon–Fri  
**Stack:** NestJS (backend) · Next.js 15 (frontend) · PostgreSQL · Redis · RabbitMQ

---

## Progress Key

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete |
| 🔲 | Not started |
| 🔄 | In progress |

---

## Week 1 — Foundation & Auth
*Goal: Clean running scaffold with auth, tenant isolation, and full infrastructure in one command*

---

### Day 1 — Wednesday 19th March *(Off day — early start)*
**Theme: System Design & Project Scaffold**

- [x] Write problem statement
- [x] Define system components and responsibilities
- [x] Design auth flow (JWT + API key)
- [x] Trace transfer data flow end to end
- [x] Define architectural decisions and tradeoffs
- [x] Document cross-tenant transfer boundary
- [x] Agree minimal webhook scope
- [x] Generate SYSTEM_DESIGN.md
- [x] Create Docker Compose file (PostgreSQL + Redis + RabbitMQ)
- [x] Scaffold NestJS project and install dependencies

**Checkpoint:** `docker-compose up` runs entire infrastructure. NestJS app boots cleanly.

---

### Day 2 — Saturday 21st & Sunday 22nd March *(Ahead of schedule — extra time)*
**Theme: Database Schema & Prisma Setup**

**Saturday 21st March — Schema & Migration**
- [x] Initialise Prisma and connect to PostgreSQL
- [x] Write schema for: `Tenant`, `User`, `Wallet`, `Transfer`, `JournalEntry`, `OutboxEvent`
- [x] Add cross-tenant check constraint on Transfer table
- [x] Run initial migration

**Sunday 22nd March — Seed & Verify**
- [x] Seed script with one test tenant and user
- [x] Verify schema in Prisma Studio

**Checkpoint:** All tables exist in DB. Seed runs without errors. Relationships are correct.

---

### Day 3 — Sunday 22nd March *(Ahead of schedule — continuing same day)*
**Theme: Tenant Module**

- [x] Generate Tenant NestJS module, service, controller
- [x] Implement tenant registration endpoint `POST /tenants`
- [x] Implement tenant update endpoint `PATCH /tenants/:id`
- [x] Implement tenant deactivation endpoint `DELETE /tenants/:id`
- [x] Implement API key generation on tenant registration
- [x] Add API key hashing before storage (never store plain text)
- [x] Add row-level tenant scoping to Prisma client middleware
- [x] Write unit tests for Tenant service
- [x] Implement `POST /tenants/:id/rotate-api-key` — invalidates current key, returns new plaintext key once
- [x] Hash new API key before storage — plaintext never persisted after rotation

**Checkpoint:** Tenant can register. API key is returned once and never again. Rotation invalidates the old key immediately and returns the new key once. Tenant data is isolated.

---

### Day 4 — Wednesday 9th April
**Theme: Auth Module**

- [x] Install and configure Passport.js
- [x] Implement JWT strategy for user authentication
- [x] Implement API key strategy for tenant system authentication
- [x] Build `JwtAuthGuard` and `ApiKeyGuard`
- [x] Build `CurrentTenant` decorator to extract tenantId from request context
- [x] Implement `POST /auth/login` endpoint (returns JWT)
- [x] Protect all existing endpoints with appropriate guard
- [x] Write unit tests for Auth service

**Checkpoint:** Login returns JWT. API key validates correctly. Unauthenticated requests return 401. tenantId is available on every protected request.

---

### Day 5 — Monday 20th April

**Theme: Logging, Swagger & Week 1 Review**

- [x] Install and configure `nestjs-pino`
- [x] Write correlation ID middleware (generates UUID per request, attaches to logger context)
- [x] Ensure all log lines include: `correlationId`, `tenantId`, `level`, `timestamp`, `msg`
- [x] Set up Swagger with `@nestjs/swagger` — document all existing endpoints
- [x] Write README skeleton: project title, problem statement, getting started section
- [x] Review Week 1 — fix anything broken before moving on

**Checkpoint:** Every request produces structured JSON logs. Swagger UI accessible at `/api/docs`. README explains how to run the project locally.

---

## Week 2 — Core Financial Logic
*Goal: Bulletproof transfer logic — the hard stuff that gets you hired*

---

### Day 6 — Tuesday 21st April

**Theme: Wallet Module**

- [x] Generate Wallet NestJS module, service, controller
- [x] Implement `POST /wallets` — create wallet (scoped to tenant + user)
- [x] Implement `GET /wallets/:id` — get wallet details
- [x] Implement `GET /wallets/:id/balance` — balance read via Redis cache first, DB on miss
- [x] Add Redis caching layer for balance reads with TTL
- [x] Enforce tenant scoping on all wallet queries
- [x] Write unit tests for Wallet service

**Checkpoint:** Wallets can be created per user per tenant. Balance endpoint returns correctly. Cache hit/miss logs are visible in structured logs.

---

### Day 7 — Wednesday 22nd April
**Theme: Double-Entry Ledger Engine**

- [x] Generate Ledger NestJS module, service, controller
- [x] Implement journal entry writer — always writes DEBIT + CREDIT pair atomically
- [x] Implement balance calculator — `SUM(credits) - SUM(debits)` derived from JournalEntry, never stored
- [x] Implement `GET /ledger/:walletId` — returns paginated journal entries for a wallet
- [x] Enforce append-only — no update or delete methods exposed on JournalEntry
- [x] Write unit tests for ledger engine — verify debit/credit pairs, balance calculation

**Checkpoint:** Journal entries are always written in pairs. Balance is always derived. No direct balance mutation exists anywhere in the codebase.

---

### Day 8 — Thursday 23rd April
**Theme: Transfer Service — Core**

- [x] Generate Transfer NestJS module, service, controller
- [x] Implement `POST /transfers` endpoint
- [x] Validate both wallets belong to requesting tenant (reject with 422 if cross-tenant)
- [x] Validate Wallet A has sufficient funds (call Wallet Service balance endpoint)
- [x] Write Transfer record + OutboxEvent atomically in single Postgres transaction
- [x] Implement Transfer status lifecycle: `INITIATED → PROCESSING → COMPLETED / FAILED`
- [x] Implement `GET /transfers/:id` — fetch transfer with status
- [x] Write unit tests for transfer validation logic

**Checkpoint:** Transfer record and OutboxEvent are always written together or not at all. Cross-tenant transfer returns 422. Insufficient funds returns 422.

---

### Day 9 — Friday 24th April
**Theme: Transfer Service — Pessimistic Locking & Idempotency**

- [x] Add `SELECT FOR UPDATE` pessimistic lock on Wallet A balance read inside transfer transaction
- [x] Write idempotency key middleware — reads `Idempotency-Key` header on all write endpoints
- [x] Store idempotency key + response in Redis with TTL
- [x] Return cached response on duplicate request — no second DB write
- [x] Add FX rate snapshot — store exchange rate at time of transfer for cross-currency transfers
- [x] Write concurrent transfer stress test — two simultaneous transfers from same wallet

**Checkpoint:** Concurrent transfers from same wallet never produce incorrect balance. Duplicate request with same idempotency key returns original response, no second journal entry written.

---

### Day 10 — Monday 27th April
**Theme: Week 2 Tests & Review**

- [x] Write edge case unit tests: insufficient funds, same wallet transfer, zero amount, negative amount
- [x] Write integration test: full transfer flow from HTTP request to journal entries written
- [x] Fix any issues surfaced by tests
- [x] Update README with Week 2 section — document transfer flow
- [x] Review Week 2 — confirm no race conditions, no balance mutations, no orphaned records

**Checkpoint:** All tests pass. No known race conditions. Transfer flow is solid end to end before moving to async layer.

---

## Week 3 — Event-Driven Layer & Observability
*Goal: Production-grade async communication and full system observability*

---

### Day 11 — Tuesday 28th April
**Theme: Outbox Pattern & RabbitMQ Publisher**

- [x] Install and configure `amqplib` for RabbitMQ connection
- [x] Set up RabbitMQ topic exchange and queues (transfer events, notification events)
- [x] Write outbox worker — polls for `PENDING` outbox records, publishes to RabbitMQ, marks as `PUBLISHED`
- [x] Add correlation ID to RabbitMQ message headers on every publish
- [x] Handle outbox worker failure gracefully — does not crash the main app
- [x] Write unit test — verify outbox record is always written in same transaction as Transfer record

**Checkpoint:** Outbox worker publishes pending events on recovery after simulated crash. Correlation ID is present in every RabbitMQ message header.

---

### Day 12 — Wednesday 29th April
**Theme: Ledger Service Consumer & Dead Letter Queue**

- [x] Implement RabbitMQ consumer in Ledger Service — listens for `TRANSFER_INITIATED` events
- [x] On consume: write DEBIT + CREDIT journal entries atomically, invalidate Redis cache for both wallets
- [x] Publish `TRANSFER_COMPLETED` event to RabbitMQ after successful journal write
- [x] Configure Dead Letter Queue — messages move to DLQ after 3 failed attempts
- [x] Implement exponential backoff on retry (1s → 2s → 4s)
- [x] Log all consumer activity with correlation ID from message headers

**Checkpoint:** Journal entries are written on RabbitMQ event. Failed messages retry 3 times then land in DLQ. Correlation ID is consistent from HTTP request through to consumer log.

---

### Day 13 — Thursday 30th April
**Theme: Transfer Service Consumer & Notification Webhook**

- [x] Implement Transfer Service consumer — listens for `TRANSFER_COMPLETED`, updates Transfer record status
- [x] Implement Notification Service consumer — listens for `TRANSFER_COMPLETED` and `TRANSFER_FAILED`
- [x] Build webhook payload: `{ transferId, status, amount, currency, timestamp }`
- [x] Sign payload with HMAC-SHA256 using tenant's webhook secret
- [x] Attach `X-Webhook-Signature` header to outbound POST request
- [x] Log delivery attempt, response status, and timestamp
- [x] Single retry on failure — second failure passes to DLQ
- [x] Enforce: tenant must have a registered webhook URL — skip silently if not configured

**Checkpoint:** Tenant receives signed webhook POST on transfer completion. Signature is verifiable with tenant's secret. Delivery attempt is logged regardless of success or failure.

---

### Day 14 — Friday 1st May
**Theme: Health Checks, Graceful Shutdown & Observability Polish**

- [x] Install `@nestjs/terminus` and implement `/health` endpoint
- [x] Add individual health indicators: `/health/db`, `/health/cache`, `/health/queue`
- [x] Implement graceful shutdown — stop accepting requests, finish in-flight transactions, flush outbox, close connections
- [x] Verify correlation ID flows correctly: HTTP → Transfer Service → RabbitMQ headers → Ledger Consumer → logs
- [x] Simulate crash mid-transfer — verify outbox picks up and completes correctly on restart
- [x] Update README with Week 3 section — document async flow and observability

**Checkpoint:** Health endpoints return dependency status correctly. Graceful shutdown completes without data loss. Single correlation ID traceable across all logs for any given transfer.

---

## Week 4 — Next.js Frontend Foundation

*Goal: Authenticated tenant dashboard that talks to the live backend API*

---

### Day 15 — Monday 4th May

#### Theme: Next.js Project Setup & Auth UI

- [x] Scaffold Next.js 16 app with TypeScript, App Router, Tailwind CSS, and shadcn/ui
- [x] Configure ESLint, Prettier, and path aliases
- [x] Set up TanStack Query for server state and Zod for form validation
- [x] Build `/login` page — email/password form, calls `POST /auth/login`, stores JWT in HTTP-only cookie
- [x] Implement Next.js middleware for protected route redirects
- [x] Build `ApiClient` service layer — wraps fetch, attaches Authorization header, handles 401 globally
- [x] Implement logout — clears cookie and redirects to login

**Checkpoint:** Login flow works end to end against live backend. Protected routes redirect unauthenticated users. JWT is never exposed to JavaScript.

---

### Day 16 — Tuesday 5th May

#### Theme: Tenant Dashboard & API Key Management *(`dashboard` app — tenant admin portal, port 3000)*

> **Note:** the original single-frontend plan has split into two Next.js apps in the monorepo: `dashboard` (tenant admin portal — tenants, users, API keys, webhooks, settings) and `frontend` (end-user wallet & transfer experience, port 3001). Day 16 work landed in `dashboard`; Days 17 onward land in `frontend` unless noted otherwise.

- [x] Build dashboard layout — sidebar navigation, header with tenant name, responsive shell
- [x] Build dashboard overview page — tenant stats (wallet count, transfer count, status summary)
- [x] Build API key management page — display masked current key, copy button for initial key
- [x] Implement rotate API key flow — confirm modal, calls `POST /tenants/:id/rotate-api-key`, displays new key once with copy prompt
- [x] Show clear warning that the new key is displayed once and cannot be retrieved again
- [x] Build webhooks page — view webhook config and rotate webhook secret (confirm modal, reveal-once)
- [x] Build tenant settings page — update tenant details via `PATCH /tenants/:id`
- [x] Scaffold tenants list/detail pages and users page placeholder for future admin management

**Checkpoint:** Tenant admin can see dashboard stats, manage webhook secret and settings, and rotate their API key from the `dashboard` app. Rotation confirmation modal prevents accidental key invalidation. Admin portal (`dashboard`) is now structurally separate from the end-user app (`frontend`).

---

### Day 17 — Wednesday 6th May

#### Theme: Wallet Management UI *(`frontend` app — end-user portal, port 3001)*

- [x] **Backend (`api`):** add `accountNumber` column to the `Wallet` model (Prisma migration) — auto-generated on wallet creation, 1:1 mapped to `walletId`, with a `@@unique` index so lookups are fast and collisions are impossible
- [x] **Backend (`api`):** generate the account number using a collision-safe scheme (e.g. tenant prefix + random/sequential digits), retrying on the rare unique-constraint conflict
- [x] **Backend (`api`):** include `accountNumber` in wallet responses (`POST /wallets`, `GET /wallets`, `GET /wallets/:id`) so the UI never needs to expose the raw `walletId`
- [x] Build wallet list page — table/cards of all wallets with account number, currency, masked balance, created date
- [x] Build create wallet form — currency selector, submit via `POST /wallets`, optimistic update
- [x] Build wallet detail page — full balance, currency, account number (with copy button), owner info
- [x] Build balance card — fetches `GET /wallets/:id/balance`, shows cache-hit indicator in dev mode
- [x] Handle empty states and loading skeletons throughout

**Checkpoint:** Wallets can be created and viewed, each with a unique, indexed account number that maps 1:1 to its `walletId`. Balance card updates correctly. Empty state guides the user to create their first wallet.

---

### Day 18 — Thursday 7th May

#### Theme: Transfer Flow UI *(`frontend` app — end-user portal, port 3001)*

- [x] **Backend (`api`):** add a tenant-scoped lookup (e.g. `GET /wallets/resolve?accountNumber=...`) that resolves an `accountNumber` to its `walletId` — returns 404 for unknown/cross-tenant numbers so destination resolution never leaks other tenants' wallets
- [x] Build initiate transfer form — source wallet selector (own wallets), destination entered as **account number** (resolved to `walletId` via the lookup before `POST /transfers`), amount, currency, idempotency key auto-generated
- [x] Implement transfer submission — calls `POST /transfers` with the resolved wallet IDs, shows status badge, polls `GET /transfers/:id` until terminal state
- [x] Build transfer detail page — full transfer info with status lifecycle timeline, showing both parties by account number rather than raw wallet id
- [x] Handle error states — 422 (cross-tenant, insufficient funds) and unresolvable account number surfaced as inline form errors
- [x] Display correlation ID on error responses for support traceability

**Checkpoint:** Transfer can be initiated end to end from the UI using the recipient's account number — never a raw wallet id. Unknown/cross-tenant account numbers are rejected with a clear inline error. Status updates in real time. Error states are user-friendly, not raw API errors.

---

### Day 19 — Friday 8th May

#### Theme: Week 4 Review & Integration *(across `dashboard` + `frontend` apps)*

- [x] Write end-to-end tests for auth flow (both apps) and wallet/transfer flow (`frontend`) using Playwright
- [x] Fix any integration issues between either frontend app (`dashboard`, `frontend`) and the backend (`api`) discovered during testing
- [x] Verify all forms have correct validation, loading states, and error handling — across both apps
- [x] Review accessibility — keyboard navigation, focus management, ARIA labels on interactive elements
- [x] Review Week 4 — no hardcoded values, no raw API errors shown to users
- [x] Build a minimal webhook listener (small standalone script/server, e.g. `tools/webhook-listener`) — exposes an HTTP endpoint that receives the tenant's webhook POST, verifies the `X-Webhook-Signature` header by recomputing the HMAC-SHA256 over the raw payload with the tenant's webhook secret, and logs the verified payload (`transferId`, `status`, `amount`, `currency`, `timestamp`)
- [x] Reject and log any payload whose signature doesn't match — proves tampered/forged requests are detected, not just valid ones
- [x] Register the listener's URL as the tenant's webhook URL (via `dashboard` → Webhooks page) and trigger a real transfer to confirm delivery end to end

**Checkpoint:** Full auth → wallet → transfer flow works end to end in `frontend`, and tenant admin flows work end to end in `dashboard`. Playwright tests pass. No raw backend errors visible to the user. The minimal webhook listener receives a live `TRANSFER_COMPLETED` webhook, verifies its HMAC-SHA256 signature against the tenant's secret, and logs the decoded payload — proving the signed-webhook flow works end to end and that forged payloads are rejected.

---

## Week 5 — Frontend Advanced Features & Polish

*Goal: Transaction history, real-time updates, and a UI you are proud to demo*

---

### Day 20 — Monday 11th May

#### Theme: Transaction History *(`api` + `frontend` + `dashboard` apps)*

- [x] Build transaction history page — paginated table of transfers, filterable by date range and status (`frontend`: own transfers; `dashboard`: tenant-wide admin view with account-number search)
- [x] Implement cursor-based pagination controls (next / previous, no offset)
- [x] Add status filter (All / Initiated / Processing / Completed / Failed) and date range picker
- [x] Scope all queries to tenantId — tenant never sees another tenant's data (enforced backend + verified frontend); admin-wide listing gated to `TENANT_ADMIN` role via `dashboard`
- [x] Add CSV export button for filtered results

**Checkpoint:** Transaction history is paginated, filterable, and tenant-scoped, with both the end-user (`frontend`) and tenant-admin (`dashboard`) views live. Cursor pagination handles large datasets without performance degradation.

---

### Day 21 — Tuesday 12th May

#### Theme: Real-Time Transfer Status *(`api` + `frontend` apps)*

- [x] Implement SSE (Server-Sent Events) endpoint on backend (`api`) — streams transfer status updates per tenantId
- [x] Connect `frontend` to SSE stream — update transfer status badge without polling
- [x] Add live activity feed on `frontend` overview — last 5 transfer events, updates in real time
- [x] Gracefully handle SSE disconnection — fall back to polling with exponential backoff

**Checkpoint:** Transfer status updates appear in the `frontend` UI without page refresh. Activity feed updates live. SSE disconnection is handled without UI breakage.

---

### Day 22 — Wednesday 13th May

#### Theme: Error Handling, Loading States & Responsive Design *(across `dashboard` + `frontend` apps, sharing `shared/ui`)*

- [x] Add React error boundaries around all major page sections in both apps — unexpected errors show friendly fallback, not blank page
- [x] Audit all pages in both apps for missing loading skeletons — every async section has a skeleton state
- [x] Implement toast notification system in `shared/ui` for success/error feedback (transfer submitted, key rotated, etc.) — consumed by both apps
- [x] Make all pages in both apps fully responsive — mobile, tablet, desktop layouts tested
- [x] Add dark mode support via Tailwind and shadcn/ui theme tokens in `shared/ui`, applied across both apps

**Checkpoint:** No blank pages on error in either app. Every data-fetching section has a loading state. All pages render correctly on mobile. Dark mode toggles correctly across `dashboard` and `frontend`.

---

### Day 23 — Thursday 14th May

#### Theme: Week 5 Review & Frontend Test Coverage *(across `dashboard` + `frontend` apps)*

- [x] Add unit tests for critical UI logic — transfer form validation & pagination state (`frontend`), API key masking & rotation (`dashboard`)
- [x] Write Playwright test for API key rotation flow (`dashboard`) — confirm modal, key displayed once, masked after refresh
- [x] Audit all forms in both apps — ensure Zod schemas match backend (`api`) validation exactly
- [x] Remove any hardcoded strings — move all UI copy to constants in both apps
- [x] Review Week 5 — `dashboard` and `frontend` are both demo-ready

**Checkpoint:** Frontend test suite passes. UI handles all known edge cases gracefully. No hardcoded values or console errors in production build.

---

## Week 6 — Backend Polish, Deploy & Document

*Goal: Something you're proud to paste into any job application*

---

### Day 24 — Friday 15th May

#### Theme: Redis Rate Limiting & Backend Error Handling

- [ ] Implement sliding window rate limiting on write endpoints using Redis
- [ ] Return `429 Too Many Requests` with `Retry-After` header when limit exceeded
- [ ] Add global exception filter — consistent error response shape across all endpoints
- [ ] Ensure all 4xx and 5xx responses include: `statusCode`, `message`, `correlationId`, `timestamp`
- [ ] Add request validation pipes — reject malformed payloads with clear error messages

**Checkpoint:** Rate limiting blocks excessive requests correctly. All error responses have consistent shape. CorrelationId is always present in error responses.

---

### Day 25 — Monday 18th May

#### Theme: Swagger Polish

- [ ] Document every backend endpoint in Swagger — request body, response schema, error codes
- [ ] Document webhook payload schema and signature verification
- [ ] Document API key rotation endpoint and security considerations
- [ ] Ensure Swagger reflects the correct auth strategy (JWT vs API key) per endpoint

**Checkpoint:** Every endpoint is documented in Swagger. Auth requirements are clear per endpoint. Swagger is useful as a standalone API reference.

---

### Day 26 — Tuesday 19th May

#### Theme: Deployment

- [ ] Deploy backend to Railway — configure environment variables (DATABASE_URL, REDIS_URL, RABBITMQ_URL, JWT_SECRET, etc.)
- [ ] Deploy frontend to Vercel — configure `NEXT_PUBLIC_API_URL` pointing to Railway backend
- [ ] Configure CORS on backend to allow requests from Vercel domain
- [ ] Verify all health check endpoints return healthy on live backend URL
- [ ] Test full transfer flow end to end on live deployment (browser → Vercel → Railway → PostgreSQL)
- [ ] Fix any deployment-specific issues

**Checkpoint:** Live backend URL accessible. Live frontend URL accessible. Full transfer flow works on deployed environment.

---

### Day 27 — Wednesday 20th May

#### Theme: README & Architecture Diagram

- [ ] Draw architecture diagram in Excalidraw — include backend, frontend, PostgreSQL, Redis, RabbitMQ, and Vercel/Railway — export as PNG to `/docs`
- [ ] Write final README sections: architecture overview, key design decisions, how to run locally, environment variables reference
- [ ] Add tradeoffs section — summarise the 5 architectural decisions from SYSTEM_DESIGN.md in plain English
- [ ] Add links to live demo (Vercel), backend Swagger docs (Railway), and SYSTEM_DESIGN.md from README header

**Checkpoint:** README tells the full story in under 5 minutes. Architecture diagram shows both backend and frontend. Someone unfamiliar with the project can run it locally using only the README.

---

### Day 28 — Thursday 21st May

#### Theme: Final Review & Release

- [ ] Read through entire backend codebase — remove dead code, TODO comments, console.logs
- [ ] Read through entire frontend codebase — remove dead code, unused components, console.logs
- [ ] Verify all tests pass on clean install (`npm ci && npm test` in both repos)
- [ ] Verify `docker-compose up` still works cleanly from scratch
- [ ] Verify live deployment is stable — frontend and backend
- [ ] Tag release `v1.0.0` on GitHub
- [ ] Pin repository with description and topic tags (`nestjs`, `nextjs`, `fintech`, `ledger`, `typescript`, `postgresql`)
- [ ] Update GitHub profile README to feature this project

**Checkpoint:** Clean repo. All tests pass. Live URL works. `v1.0.0` tagged. Project is pinned and visible on GitHub profile.

---

## Summary

| Week | Theme | Key Deliverable |
|------|-------|----------------|
| Week 1 | Foundation & Auth | Running scaffold, tenant isolation, API key rotation, structured logging |
| Week 2 | Core Financial Logic | Bulletproof double-entry ledger, pessimistic locking, idempotency |
| Week 3 | Event-Driven & Observability | Outbox pattern, DLQ, signed webhooks, full traceability |
| Week 4 | Frontend Foundation | Auth UI, tenant dashboard, wallet management, transfer flow |
| Week 5 | Frontend Advanced Features | Transaction history, real-time updates, error handling, responsive design |
| Week 6 | Polish & Ship | Rate limiting, Swagger, live deployment (Vercel + Railway), `v1.0.0` tagged |

---

## Two Rules For The Whole Project

**Rule 1 — Don't skip the system design doc.**
Already done. Refer back to it when you're unsure about a decision.

**Rule 2 — Don't add scope.**
If you finish a day early, write better tests or improve the README. The temptation to add features will kill your timeline.

---

*Last updated: 20th April 2026*
