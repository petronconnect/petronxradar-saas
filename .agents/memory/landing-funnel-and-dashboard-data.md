---
name: Public funnel + dashboard data honesty
description: Hard constraints for the public sales funnel (no auth-gated CTAs) and what the dashboard summary actually measures.
---

# Public funnel — no auth-gated CTAs

Public landing CTAs must NEVER link to auth-gated routes. `/planos` and `/inquiries`
(and everything else not in `App.tsx` `PUBLIC_PATHS`) are wrapped in `LayoutRoute` and
redirect logged-out visitors to `/login` — a dead-end for prospects.

**Rule:** route public-facing landing CTAs to the in-page `#planos` anchor (the pricing
section, `scroll-mt-20` to clear the sticky header) or directly to a public
`/checkout/:plano`. `PUBLIC_PATHS` matches `location === p || startsWith(p + "/")`.

**Why:** the landing previously sent "Conhecer Planos"/"Ver Todos os Planos"/"Contratar
Agora" to `/planos` or `/inquiries`, dumping inbound demand at the login wall.
`/planos` stays auth-gated on purpose (internal/post-login view) — only the *public*
CTAs were the bug.

# Dashboard summary is GLOBAL, not per-client

`GET /api/dashboard/summary` counts ALL opportunities/bulletins/clients in the system —
it is NOT scoped to the logged-in client. `AuthUser` has only `id, email, role,
companyName` — **no plan field**, and there is no per-client usage/limit tracking.

**Rule:** do not render per-client "plan" or "usage X/Y" as if real. Dashboard totals
are global platform counts. `radarScore` is a deterministic 0–100 index, not an
AI/quality prediction: up to 40 points for volume, 30 for monthly activity, and
30 for sector diversity weighted by the share of opportunities with a classified
sector. Empty or placeholder sector labels do not count as classified.

**Why:** the previous score could reach 100 while most opportunities had no useful
sector label. The user approved weighting diversity by classification coverage so
the score does not hide missing sector data.

**How to apply:** keep score and sector chart based on the same global opportunity
population; group chart categories only for display, never infer missing sectors.
The summary still returns hardcoded `planName`/`planLimit`/`usagePercent` only for
Zod-schema compatibility — nothing in the UI displays them.
