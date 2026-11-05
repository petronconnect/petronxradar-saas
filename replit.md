# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- DB schema (source of truth): `lib/db/src/schema/index.ts` (Drizzle). Must mirror the live Postgres tables.
- API contract: `lib/api-spec/openapi.yaml` → run codegen to regenerate hooks/Zod.
- API routes: `artifacts/api-server/src/routes/` (registered in `routes/index.ts`).
- Frontend (Petron Radar): `artifacts/petron-radar/src/` — pages in `pages/`, shared helpers in `lib/` (`api.ts`, `opportunityAnalysis.ts`), shadcn/ui in `components/ui/`.

## Architecture decisions

- **No Petronect write-back or document fetch.** We cannot submit/register bids or pull official documents (edital, planilha de orçamento, anexos) from a client's Petronect account (no public API; requires the supplier's authenticated session + e-CNPJ certificate). Opportunity actions are our-side only: deep-link to the public portal, our deterministic analysis + próximos passos, team-curated document links, and portfolio tracking.
- **Opportunity documents are team-curated links, not copied uploads.** PETRON staff attach each link to one opportunity, open it and record a manual test; marking the official documents reviewed requires a tested Petronect source and all listed links tested. Adding or removing a link resets the review. Clients see the link and the current review status plus an honest Petronect-portal fallback.
- **"Análise Petron Radar" is deterministic, not AI.** Score + próximos passos derived from value/sector/deadline/region, explicitly labeled as data-based — no fake-AI claims.
- **Portfolio & document routes use raw `sql` templates** (parameterized). Portfolio scoping is always derived from the session, never the request body; `stage`/`kind` are whitelisted; document URLs validated to http(s). Document writes are `requireAdmin`.
- Opportunity deadlines are stored as Brazilian `dd/mm/yyyy` strings, not ISO.
- **Client self-service profile.** Clients edit their own `nome` / `email` (login) / `telefone` / `whatsapp` at `/meu-perfil` via `GET`/`PATCH /api/auth/profile` (ids derived from the session only; email change requires `currentPassword`). Company legal fields (razão social, CNPJ, cidade/estado, segmento) stay admin-only. To change a client's data in **prod**, log in as them against the live URL and call the authenticated API — never write the prod DB directly.
- **Initialize an empty account database safely.** Configure `BOOTSTRAP_AUTH_TOKEN` as a Replit Secret for the API server (at least 32 random bytes; generate with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`). When there are no users, an operator without an existing login must call `POST $API_BASE_URL/api/admin/seed-companies` with `Authorization: Bearer $BOOTSTRAP_AUTH_TOKEN`; this is the only way to initialize a truly empty database because the Empresas screen requires an admin session. Keep the JSON response private: it contains one-time temporary passwords. With an existing admin session, the same token can be entered on the Empresas screen. The server refuses requests if the secret is missing/weak, rejects mismatches before database access, and the route disables itself once any user exists.

## Product

Petron Radar Premium — B2B SaaS delivering Oil & Gas tender intelligence for Brazilian CNPJ companies. Clients browse Petronect opportunities, open a detail view with a Petron Radar recommendation score + "próximos passos" guide, habilitação document checklist, team-curated documents & downloads (with a Petronect-portal fallback for official files), and the opportunity number (copy + "Abrir no Petronect" deep-link); they track the ones they intend to bid on in "Meu Portfólio" (stages: avaliando, vou_licitar, orçando, enviada, descartada) with notes. The Petron team (admin) curates document links per opportunity.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Mirror raw-SQL tables in the Drizzle schema.** Some tables (`opportunity_portfolio`, `opportunity_documents`) are created via raw `psql` and queried with raw `sql` templates, but must ALSO be defined in `lib/db/src/schema/index.ts` — otherwise `drizzle-kit push` can drop them. Run `pnpm run typecheck:libs` after editing the schema.
- **Restart the api-server workflow to test route changes** — it does not reliably hot-reload route logic.
- **The PWA service worker only runs in production.** `main.tsx` guards SW registration behind `import.meta.env.PROD`; in dev it unregisters any SW + clears caches (a cache-first SW serves stale Vite modules and makes the app look stuck on old code). The app is served at root `/`, so `public/manifest.webmanifest` and `public/sw.js` must use `/` paths (NOT `/petron-radar/`), and shareable-URL code must use `window.location.origin + import.meta.env.BASE_URL`. Bump `CACHE` in `sw.js` whenever icons/manifest (non-hashed public assets) change — they're pinned by cache name.
- **Pre-existing gap:** `GET/POST /api/opportunities` have no auth middleware (anyone can create opportunities). Add `requireAdmin` if you touch those routes.
- **`telefone`/`whatsapp` can't be blanked back to empty** via `PATCH /api/auth/profile` or admin `PATCH /companies/:id` — both use `COALESCE(${value}, col)`, so an empty/whitespace input is coerced to NULL and the old value is kept. To support clearing a phone, distinguish "omitted" from "explicitly empty" in the SQL.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
