---
name: Pix payments (now LIVE via Mercado Pago)
description: State of the checkout Pix flow — dynamic Mercado Pago is now enabled with a production account.
---

The checkout `/checkout/:plano` Pix step runs the DYNAMIC Mercado Pago flow:
`POST /api/payments/pix` → real `qr_code` + `qr_code_base64` + copy-paste → browser
polls `GET /api/payments/:id/status` (re-checks MP) → on `approved`, claim-token
auto-login + `provisionAccessForPayment`. Gated by module const `PIX_STATIC` in
CheckoutPage.tsx (now `false`).

**Status:** LIVE. The configured `MP_ACCESS_TOKEN` is a PRODUCTION business account
(MLB/BR, tag `business`, `users/me` not `test_user`) with Pix `status=active`. The
endpoint returns `sandboxMode:false` with a real payable QR. The earlier "static
interim" (personal Pix key + manual WhatsApp confirmation) is retired.

**Why this was blocked before:** the old token was a Mercado Pago TEST USER
(`tags:["test_user"]`, Pix not available) despite the `APP_USR-` prefix — so live Pix
401'd and the route degraded to an unpayable `MOCK_PIX_KEY`. Always verify a token via
`GET users/me` (reject `test_user`) AND `GET /v1/payment_methods` (require `pix`
active) before trusting it.

**Robustness gap (follow-up):** `POST /api/payments/webhook` exists but
`validateWebhookSignature` returns `true` when `MP_WEBHOOK_SECRET` is unset (accepts
all). For a server-side confirmation backstop (buyer closes the tab), register the
webhook URL `https://<prod-domain>/api/payments/webhook` in the MP dashboard and set
`MP_WEBHOOK_SECRET`. Until then, confirmation relies on the browser polling staying
open. `simulate-paid` is dev-only.

**Server-side pricing (security):** `POST /api/payments/pix` must NEVER trust the
client-sent `amount` — once MP went live a client could pay R$1 for any plan and get
auto-provisioned. The charged value is now derived server-side from `planSlug` via
`PLAN_PRICE_BY_SLUG` (exported from `routes/plans.ts`); unknown slugs are rejected 400.
Keep `plans.ts` the single source of truth for prices.

**How to apply:** to fall back to manual Pix, flip `PIX_STATIC = true`. Boleto/cartão
options in the same checkout still only display "will be sent by email" with no backing
process.
