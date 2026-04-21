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

- [ ] Install and configure `nestjs-pino`
- [ ] Write correlation ID middleware (generates UUID per request, attaches to logger context)
- [ ] Ensure all log lines include: `correlationId`, `tenantId`, `level`, `timestamp`, `msg`
- [ ] Set up Swagger with `@nestjs/swagger` — document all existing endpoints
- [ ] Write README skeleton: project title, problem statement, getting started section
- [ ] Review Week 1 — fix anything broken before moving on

**Checkpoint:** Every request produces structured JSON logs. Swagger UI accessible at `/api/docs`. README explains how to run the project locally.

---

## Week 2 — Core Financial Logic
*Goal: Bulletproof transfer logic — the hard stuff that gets you hired*

---

### Day 6 — Tuesday 21st April

**Theme: Wallet Module**

- [ ] Generate Wallet NestJS module, service, controller
- [ ] Implement `POST /wallets` — create wallet (scoped to tenant + user)
- [ ] Implement `GET /wallets/:id` — get wallet details
- [ ] Implement `GET /wallets/:id/balance` — balance read via Redis cache first, DB on miss
- [ ] Add Redis caching layer for balance reads with TTL
- [ ] Enforce tenant scoping on all wallet queries
- [ ] Write unit tests for Wallet service

**Checkpoint:** Wallets can be created per user per tenant. Balance endpoint returns correctly. Cache hit/miss logs are visible in structured logs.

---

### Day 7 — Wednesday 22nd April
**Theme: Double-Entry Ledger Engine**

- [ ] Generate Ledger NestJS module, service, controller
- [ ] Implement journal entry writer — always writes DEBIT + CREDIT pair atomically
- [ ] Implement balance calculator — `SUM(credits) - SUM(debits)` derived from JournalEntry, never stored
- [ ] Implement `GET /ledger/:walletId` — returns paginated journal entries for a wallet
- [ ] Enforce append-only — no update or delete methods exposed on JournalEntry
- [ ] Write unit tests for ledger engine — verify debit/credit pairs, balance calculation

**Checkpoint:** Journal entries are always written in pairs. Balance is always derived. No direct balance mutation exists anywhere in the codebase.

---

### Day 8 — Thursday 23rd April
**Theme: Transfer Service — Core**

- [ ] Generate Transfer NestJS module, service, controller
- [ ] Implement `POST /transfers` endpoint
- [ ] Validate both wallets belong to requesting tenant (reject with 422 if cross-tenant)
- [ ] Validate Wallet A has sufficient funds (call Wallet Service balance endpoint)
- [ ] Write Transfer record + OutboxEvent atomically in single Postgres transaction
- [ ] Implement Transfer status lifecycle: `INITIATED → PROCESSING → COMPLETED / FAILED`
- [ ] Implement `GET /transfers/:id` — fetch transfer with status
- [ ] Write unit tests for transfer validation logic

**Checkpoint:** Transfer record and OutboxEvent are always written together or not at all. Cross-tenant transfer returns 422. Insufficient funds returns 422.

---

### Day 9 — Friday 24th April
**Theme: Transfer Service — Pessimistic Locking & Idempotency**

- [ ] Add `SELECT FOR UPDATE` pessimistic lock on Wallet A balance read inside transfer transaction
- [ ] Write idempotency key middleware — reads `Idempotency-Key` header on all write endpoints
- [ ] Store idempotency key + response in Redis with TTL
- [ ] Return cached response on duplicate request — no second DB write
- [ ] Add FX rate snapshot — store exchange rate at time of transfer for cross-currency transfers
- [ ] Write concurrent transfer stress test — two simultaneous transfers from same wallet

**Checkpoint:** Concurrent transfers from same wallet never produce incorrect balance. Duplicate request with same idempotency key returns original response, no second journal entry written.

---

### Day 10 — Monday 27th April
**Theme: Week 2 Tests & Review**

- [ ] Write edge case unit tests: insufficient funds, same wallet transfer, zero amount, negative amount
- [ ] Write integration test: full transfer flow from HTTP request to journal entries written
- [ ] Fix any issues surfaced by tests
- [ ] Update README with Week 2 section — document transfer flow
- [ ] Review Week 2 — confirm no race conditions, no balance mutations, no orphaned records

**Checkpoint:** All tests pass. No known race conditions. Transfer flow is solid end to end before moving to async layer.

---

## Week 3 — Event-Driven Layer & Observability
*Goal: Production-grade async communication and full system observability*

---

### Day 11 — Tuesday 28th April
**Theme: Outbox Pattern & RabbitMQ Publisher**

- [ ] Install and configure `amqplib` for RabbitMQ connection
- [ ] Set up RabbitMQ topic exchange and queues (transfer events, notification events)
- [ ] Write outbox worker — polls for `PENDING` outbox records, publishes to RabbitMQ, marks as `PUBLISHED`
- [ ] Add correlation ID to RabbitMQ message headers on every publish
- [ ] Handle outbox worker failure gracefully — does not crash the main app
- [ ] Write unit test — verify outbox record is always written in same transaction as Transfer record

**Checkpoint:** Outbox worker publishes pending events on recovery after simulated crash. Correlation ID is present in every RabbitMQ message header.

---

### Day 12 — Wednesday 29th April
**Theme: Ledger Service Consumer & Dead Letter Queue**

- [ ] Implement RabbitMQ consumer in Ledger Service — listens for `TRANSFER_INITIATED` events
- [ ] On consume: write DEBIT + CREDIT journal entries atomically, invalidate Redis cache for both wallets
- [ ] Publish `TRANSFER_COMPLETED` event to RabbitMQ after successful journal write
- [ ] Configure Dead Letter Queue — messages move to DLQ after 3 failed attempts
- [ ] Implement exponential backoff on retry (1s → 2s → 4s)
- [ ] Log all consumer activity with correlation ID from message headers

**Checkpoint:** Journal entries are written on RabbitMQ event. Failed messages retry 3 times then land in DLQ. Correlation ID is consistent from HTTP request through to consumer log.

---

### Day 13 — Thursday 30th April
**Theme: Transfer Service Consumer & Notification Webhook**

- [ ] Implement Transfer Service consumer — listens for `TRANSFER_COMPLETED`, updates Transfer record status
- [ ] Implement Notification Service consumer — listens for `TRANSFER_COMPLETED` and `TRANSFER_FAILED`
- [ ] Build webhook payload: `{ transferId, status, amount, currency, timestamp }`
- [ ] Sign payload with HMAC-SHA256 using tenant's webhook secret
- [ ] Attach `X-Webhook-Signature` header to outbound POST request
- [ ] Log delivery attempt, response status, and timestamp
- [ ] Single retry on failure — second failure passes to DLQ
- [ ] Enforce: tenant must have a registered webhook URL — skip silently if not configured

**Checkpoint:** Tenant receives signed webhook POST on transfer completion. Signature is verifiable with tenant's secret. Delivery attempt is logged regardless of success or failure.

---

### Day 14 — Friday 1st May
**Theme: Health Checks, Graceful Shutdown & Observability Polish**

- [ ] Install `@nestjs/terminus` and implement `/health` endpoint
- [ ] Add individual health indicators: `/health/db`, `/health/cache`, `/health/queue`
- [ ] Implement graceful shutdown — stop accepting requests, finish in-flight transactions, flush outbox, close connections
- [ ] Verify correlation ID flows correctly: HTTP → Transfer Service → RabbitMQ headers → Ledger Consumer → logs
- [ ] Simulate crash mid-transfer — verify outbox picks up and completes correctly on restart
- [ ] Update README with Week 3 section — document async flow and observability

**Checkpoint:** Health endpoints return dependency status correctly. Graceful shutdown completes without data loss. Single correlation ID traceable across all logs for any given transfer.

---

## Week 4 — Next.js Frontend Foundation

*Goal: Authenticated tenant dashboard that talks to the live backend API*

---

### Day 15 — Monday 4th May

#### Theme: Next.js Project Setup & Auth UI

- [ ] Scaffold Next.js 15 app with TypeScript, App Router, Tailwind CSS, and shadcn/ui
- [ ] Configure ESLint, Prettier, and path aliases
- [ ] Set up TanStack Query for server state and Zod for form validation
- [ ] Build `/login` page — email/password form, calls `POST /auth/login`, stores JWT in HTTP-only cookie
- [ ] Implement Next.js middleware for protected route redirects
- [ ] Build `ApiClient` service layer — wraps fetch, attaches Authorization header, handles 401 globally
- [ ] Implement logout — clears cookie and redirects to login

**Checkpoint:** Login flow works end to end against live backend. Protected routes redirect unauthenticated users. JWT is never exposed to JavaScript.

---

### Day 16 — Tuesday 5th May

#### Theme: Tenant Dashboard & API Key Management

- [ ] Build dashboard layout — sidebar navigation, header with tenant name, responsive shell
- [ ] Build dashboard overview page — tenant stats (wallet count, transfer count, status summary)
- [ ] Build API key management page — display masked current key, copy button for initial key
- [ ] Implement rotate API key flow — confirm modal, calls `POST /tenants/:id/rotate-api-key`, displays new key once with copy prompt
- [ ] Show clear warning that the new key is displayed once and cannot be retrieved again

**Checkpoint:** Tenant can see their dashboard stats and rotate their API key. Rotation confirmation modal prevents accidental key invalidation.

---

### Day 17 — Wednesday 6th May

#### Theme: Wallet Management UI

- [ ] Build wallet list page — table of all wallets with currency, masked balance, created date
- [ ] Build create wallet form — currency selector, submit via `POST /wallets`, optimistic update
- [ ] Build wallet detail page — full balance, currency, owner info
- [ ] Build balance card — fetches `GET /wallets/:id/balance`, shows cache-hit indicator in dev mode
- [ ] Handle empty states and loading skeletons throughout

**Checkpoint:** Wallets can be created and viewed. Balance card updates correctly. Empty state guides the user to create their first wallet.

---

### Day 18 — Thursday 7th May

#### Theme: Transfer Flow UI

- [ ] Build initiate transfer form — source wallet selector, destination wallet selector, amount, currency, idempotency key auto-generated
- [ ] Implement transfer submission — calls `POST /transfers`, shows status badge, polls `GET /transfers/:id` until terminal state
- [ ] Build transfer detail page — full transfer info with status lifecycle timeline
- [ ] Handle error states — 422 (cross-tenant, insufficient funds) surfaced as inline form errors
- [ ] Display correlation ID on error responses for support traceability

**Checkpoint:** Transfer can be initiated end to end from the UI. Status updates in real time. Error states are user-friendly, not raw API errors.

---

### Day 19 — Friday 8th May

#### Theme: Week 4 Review & Integration

- [ ] Write end-to-end tests for auth flow and transfer flow using Playwright
- [ ] Fix any integration issues between frontend and backend discovered during testing
- [ ] Verify all forms have correct validation, loading states, and error handling
- [ ] Review accessibility — keyboard navigation, focus management, ARIA labels on interactive elements
- [ ] Review Week 4 — no hardcoded values, no raw API errors shown to users

**Checkpoint:** Full auth → dashboard → wallet → transfer flow works end to end. Playwright tests pass. No raw backend errors visible to the user.

---

## Week 5 — Frontend Advanced Features & Polish

*Goal: Transaction history, real-time updates, and a UI you are proud to demo*

---

### Day 20 — Monday 11th May

#### Theme: Transaction History

- [ ] Build transaction history page — paginated table of transfers, filterable by date range and status
- [ ] Implement cursor-based pagination controls (next / previous, no offset)
- [ ] Add status filter (All / Initiated / Processing / Completed / Failed) and date range picker
- [ ] Scope all queries to tenantId — tenant never sees another tenant's data (enforced backend + verified frontend)
- [ ] Add CSV export button for filtered results

**Checkpoint:** Transaction history is paginated, filterable, and tenant-scoped. Cursor pagination handles large datasets without performance degradation.

---

### Day 21 — Tuesday 12th May

#### Theme: Real-Time Transfer Status

- [ ] Implement SSE (Server-Sent Events) endpoint on backend — streams transfer status updates per tenantId
- [ ] Connect frontend to SSE stream — update transfer status badge without polling
- [ ] Add live activity feed on dashboard — last 5 transfer events, updates in real time
- [ ] Gracefully handle SSE disconnection — fall back to polling with exponential backoff

**Checkpoint:** Transfer status updates appear in the UI without page refresh. Dashboard feed updates live. SSE disconnection is handled without UI breakage.

---

### Day 22 — Wednesday 13th May

#### Theme: Error Handling, Loading States & Responsive Design

- [ ] Add React error boundaries around all major page sections — unexpected errors show friendly fallback, not blank page
- [ ] Audit all pages for missing loading skeletons — every async section has a skeleton state
- [ ] Implement toast notification system for success/error feedback (transfer submitted, key rotated, etc.)
- [ ] Make all pages fully responsive — mobile, tablet, desktop layouts tested
- [ ] Add dark mode support via Tailwind and shadcn/ui theme tokens

**Checkpoint:** No blank pages on error. Every data-fetching section has a loading state. All pages render correctly on mobile. Dark mode toggles correctly.

---

### Day 23 — Thursday 14th May

#### Theme: Week 5 Review & Frontend Test Coverage

- [ ] Add unit tests for critical UI logic — transfer form validation, API key masking, pagination state
- [ ] Write Playwright test for API key rotation flow — confirm modal, key displayed once, masked after refresh
- [ ] Audit all forms — ensure Zod schemas match backend validation exactly
- [ ] Remove any hardcoded strings — move all UI copy to constants
- [ ] Review Week 5 — UI is demo-ready

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
