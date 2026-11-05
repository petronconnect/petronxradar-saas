---
name: Onboarding Provisioning Flow
description: How automated account provisioning works after Pix payment approval.
---

## Full Chain

1. `POST /api/payments/pix` → creates payment row, generates 32-byte `claimToken`, stores `sha256(token)` in `claim_token_hash`, returns `claimToken` to frontend.
2. Pix approved (webhook or `simulate-paid` or status poll) → calls `provisionAccessForPayment(paymentId)`.
3. `provisionAccessForPayment`: SELECT FOR UPDATE (race-safe), idempotent (skips if `provisioned_at` set).
   - Sources company/contact from `inquiries` via `inquiry_id` (nullable; falls back to `payer_cnpj/email/name` on payments).
   - CNPJ normalized (strip non-digits), upsert `company_accounts`.
   - `company_users` by email: if exists for DIFFERENT company → `alreadyExists:true` (no touch). If new → insert with `must_set_password=true`, random bcrypt hash.
   - Upsert `subscriptions`.
   - Creates personalized "Primeiro boletim" (company_id set, deterministic from segment + top 3 opportunities).
   - Sets `provisioned_at=NOW()`.
4. `POST /api/payments/:id/claim` → verify token, ensure provisioned, `req.session.regenerate()`, set `session.user` with `mustSetPassword/onboardingCompleted` flags, mark `claimed_at`.
5. Frontend redirects to BASE_URL → AuthContext fetches `/auth/me` → WelcomeOnboarding modal renders.
6. User sets password (`POST /auth/set-password`) → clears `must_set_password`.
7. User completes tour (`POST /auth/complete-onboarding`) → sets `onboarding_completed=true` → modal dismissed → navigate to `/boletins`.

## Hard Rules

- NEVER drizzle-kit push — use raw psql + mirror in `lib/db/src/schema/index.ts`.
- Restart api-server after route changes (no hot-reload on route files).
- Portfolio scoping always from session, not request body.
