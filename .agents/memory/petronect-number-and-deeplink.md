---
name: Petronect opportunity number & "Abrir no Petronect"
description: Why the opportunity number is derived (not just petronectId) and why the portal link can't deep-link to a single proposal.
---

# Petronect opportunity number & deep-link

## Number display
The opportunity's Petronect number may NOT be in `opportunities.petronect_id` — in prod some rows
have `petronect_id` NULL while the 10-digit number (always prefix `700`, e.g. `7004607371`) sits in
the `title` (and sometimes `description`). So the UI must derive it, not read the column blindly.

`resolvePetronectNumero()` (in `artifacts/petron-radar/src/lib/api.ts`, shared by the opportunity
modal and the portfolio page) returns `petronectId.trim()` if present, else extracts `/\b(700\d{7})\b/`
from title then description. Display-only — no DB write (prod DB is read-only from the workspace).

**Why:** client asked the "Número da oportunidade (Petronect)" field to show the same number visible
at the top, instead of "Não informado". The number IS the proposal number; it was just in a different column.

## "Abrir no Petronect" can't deep-link to one proposal
The public portal (`PETRONECT_URL` = legacy SAP/KM `lista_licitacoes_publicadas_ft.html`) is a
client-side **search** page; there is no URL param / per-proposal deep link. So "Abrir no Petronect"
opens the list AND copies the number to the clipboard (+ toast + a persistent hint by the number box)
so the user pastes it into the portal search. Honest bridge, not a fake direct link.

**Why:** consistent with the replit.md rule "No Petronect write-back or document fetch" (no public API;
needs the supplier's authenticated session + e-CNPJ cert). We cannot pull edital/anexos/itens either —
the in-platform path for official docs is the team-curated `opportunity_documents` links.

**How to apply:** any new Petronect "open"/link surface should reuse `resolvePetronectNumero` + the
copy-number assist; never promise a direct proposal URL or claim to fetch Petronect content.
