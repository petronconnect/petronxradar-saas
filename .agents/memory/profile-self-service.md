---
name: Client self-service profile
description: How clients edit their own login email / contact fields, and how to apply a client's prod data change safely.
---

# Client self-service "Meu Perfil"

Clients (CLIENTE_ADMIN / USUARIO_CLIENTE) edit their own account via `GET`/`PATCH /api/auth/profile`. Page: `/meu-perfil`.

- Editable: `nome`, `email` (login), `telefone`, `whatsapp`. Company legal fields (razão social, CNPJ, cidade/estado, segmento) are read-only — only the Petron team changes those via admin `PATCH /companies/:id`.
- **All ids come from the session, never the request body** — `nome`/`email` target the session user's `company_users` row; `telefone`/`whatsapp` target the session user's `company_id` in `company_accounts`. Body `role`/`companyId`/`ativo` are ignored (not in the whitelist).
- Email change requires `currentPassword` (verified with `bcrypt.compare`); case-insensitive uniqueness → 409.

## Two emails on the page — login vs cadastral (sync decision)
The profile page shows TWO emails: top editable "E-mail de acesso (login)" = `company_users.email`, and bottom read-only "E-mail cadastral da empresa" (in the "Dados da Empresa" card) = `company_accounts.email`. Originally the PATCH only updated the login email, so after a change the cadastral email looked stale → users reported "o sistema não muda o e-mail" (they were comparing top vs bottom).
**Decision:** when the login email changes, the PATCH now ALSO syncs `company_accounts.email` to the same value, so both reflect the change.
**Why:** these accounts are one-CNPJ / one-contact, so login email == company contact email; keeping them in sync removes the confusion and keeps Petron's record current.
**Caveat:** for a hypothetical multi-user company this would let one user overwrite the shared cadastral email — acceptable given the single-contact model; revisit if true multi-user companies appear.

## Gotcha: COALESCE can't blank a field
**telefone/whatsapp updates use `COALESCE(${value}, col)`, so an empty/whitespace input is coerced to NULL and the OLD value is kept — you cannot clear a phone back to empty through this route.** If a user ever needs to remove a phone, change the SQL to distinguish "omitted" from "explicitly empty".

## Applying a client's PROD data change (e.g. change a client's login email)
**Never write to the prod DB directly (it is read-only to the agent).** Apply it through the authenticated PROD API: log in as that client against the live `*.replit.app` URL, then `PATCH /api/auth/profile` with the new email + `currentPassword`. Equivalent to what the client can now self-serve. Requires the feature to be Published first (additive nullable `whatsapp` column reaches prod via Publish introspect-diff).
**Why:** prod DB writes are blocked and risky; the authenticated API enforces the same guardrails and keeps the session in sync.
