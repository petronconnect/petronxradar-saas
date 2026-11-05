---
name: Petron Radar opportunities & portfolio
description: Durable product/data constraints for the Petron Radar opportunity-tracking feature (Brazilian Oil & Gas tenders).
---

# Petron Radar — opportunities & portfolio

## Petronect write-back is impossible (product constraint)
We CANNOT programmatically submit/register a bid OR fetch documents (edital, planilha de orçamento, anexos) from a client's Petronect account.
- **Why:** Petronect has no public API; bidding/downloads require the supplier's own authenticated session plus an e-CNPJ digital certificate. There is no honest way to automate this from our side. (Business goal: pursue an official Petrobras integration partnership to eventually get API access — until then, deep-link only.)
- **How to apply:** Opportunity actions stay on our side only — deep-link to the public tenders URL ("Abrir no Petronect"), our deterministic analysis, próximos passos, habilitação checklist, and portfolio tracking. Never imply or build auto-bidding or auto-document-fetch. The "Análise Petron Radar" score is deterministic (value/sector/deadline/region), explicitly labeled as data-based, NOT AI scraping — keep it honest.

## Opportunity documents = team-curated links, NOT scraped
`opportunity_documents` holds links the Petron team manually curates per opportunity (kinds: edital/orcamento/anexo/esclarecimento/outro). The modal shows these as download buttons PLUS an honest dashed fallback link to the Petronect portal for official docs.
- **How to apply:** Writes (POST/DELETE) are ADMIN_PETRON-only (`requireAdmin`); reads are any authed user (opportunities are global, not company-scoped — intentional, no IDOR). URLs are validated to http(s) before insert. Don't fabricate document URLs; the team populates real ones obtained manually from Petronect.

## Pre-existing security gap: POST /opportunities is unauthenticated
`GET/POST /api/opportunities` carry NO auth middleware — anyone can create opportunities. Predates the documents work; left as-is to respect scope.
- **How to apply:** If touching opportunities routes, add `requireAdmin` to POST (and consider GET auth) as a follow-up. Don't assume the opportunities CRUD is protected.

## Opportunity deadlines are stored as dd/mm/yyyy (Brazilian)
Seed/DB opportunity deadlines use Brazilian `dd/mm/yyyy` strings (e.g. "25/06/2026"), not ISO.
- **How to apply:** Any deadline parsing must handle both ISO and dd/mm/yyyy (see `parseDeadline` in `lib/opportunityAnalysis.ts`). Treating these as ISO silently yields Invalid Date.

## DB tables must be mirrored in the Drizzle schema or push drops them
Some tables here were created via raw `psql` (DDL), and routes use raw `sql` templates — so a table can exist in Postgres but be absent from `lib/db/src/schema/index.ts`.
- **Why:** `pnpm --filter @workspace/db run push` (drizzle-kit) reconciles to the schema file; an unknown live table can be flagged/dropped, destroying data.
- **How to apply:** Whenever you create a table by raw SQL, ALSO add its definition to `schema/index.ts` mirroring the live shape (cols, defaults, composite unique). Run `pnpm run typecheck:libs` after editing the schema. This repo's convention is plain `integer` FK-less columns (no `.references()`), matching existing tables.

## Operational notes
- `db.execute()` returns a QueryResult — wrap in `toRows()` to get rows.
- The api-server workflow does NOT reliably hot-reload route logic changes; restart `artifacts/api-server: API Server` before testing new/edited route behavior.
