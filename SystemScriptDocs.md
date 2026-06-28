# SYSTEM MANAGEMENT SCRIPTS

## top up scrips

```
# pnpm
pnpm topup --walletId= --amount=

# npm
npm run topup --walletId= --amount=

# example — credit 500 NGN to a wallet
pnpm topup --walletId= 6351c36d-95a6-4c5e-bd9e-f34958a69fe2 --amount=500

# example — credit 1000.50 USD
pnpm topup --walletId= 301dae85-321a-4f69-8e22-e4eb4460e037 --amount=1000.50
```

## create user

```
# From the api/ directory
pnpm create-user \
  --tenantid=<tenant-uuid> \
  --email=admin@acme.com \
  --password=Secret123! \
  --role=TENANT_ADMIN

  SYSTEM_ADMIN, TENANT_ADMIN, CUSTOMER
```

## rotate api key

```
pnpm rotate-api-key --tenantid=<uuid>
```

## running app

```
pnpm dev          # starts api + frontend + dashboard in parallel
pnpm build        # builds shared/* first, then api/frontend/dashboard
pnpm lint         # lints all workspaces
pnpm test         # tests all workspaces (with build cache)
```

## Or target a single workspace

```
pnpm turbo dev --filter=frontend
pnpm turbo dev --filter=dashboard
pnpm turbo build --filter=ledger-api
```

## Test Scripts

```
pnpm --filter dashboard test →✅
pnpm --filter frontend test → 
pnpm --filter @ledger/ui test → 
cd api && npx jest

```
