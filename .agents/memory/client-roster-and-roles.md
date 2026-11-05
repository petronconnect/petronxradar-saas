---
name: Client roster & role model
description: How Petron Radar clients vs the master operator admin are modeled, and how offline (Pix) clients are onboarded by hand.
---

# Role / company model

- **One master admin only.** `ADMIN_PETRON` = platform operator with global visibility (sees every client). It must be a single person (the business owner) living in their OWN operator company — NEVER inside a client company.
  - **Why:** a client carrying `ADMIN_PETRON` can see every other client's data — a cross-tenant leak. This actually happened: a client owner had been seeded as `ADMIN_PETRON` inside their own client company, which was also (wrongly) hosting the operator login.
  - **How to apply:** the operator (brand "Petron Radar", legal entity Plustech) has its own `company_accounts` row with no subscription; the master user sits there. Every paying client is `CLIENTE_ADMIN` scoped to its own `company_accounts` row. The login query only JOINs `company_accounts` (not subscriptions), so an operator company without a subscription still logs in fine.

# Manual onboarding of offline (Pix) clients

- Until in-app billing is live, clients who paid via Pix are registered by hand: create `company_accounts` (from the cartão CNPJ — razão social, nome fantasia, CNPJ, município/UF, CNAE→segmento) + a `CLIENTE_ADMIN` `company_users` row + a `subscriptions` row.
- First access has no email/magic-link infra (login is email + bcrypt password). So set a **temporary password + `must_set_password=true`** (and `onboarding_completed=false`): the client logs in with the temp creds, is forced to set their own password, then sees the welcome/tour. Login is NOT blocked by `must_set_password`.
- **Plan:** only `radar-lancamento` is active (the older tiers were removed). Default new clients to it.
- **Prod is separate and empty** until a re-publish with "Overwrite data". Relay temp credentials to clients only AFTER that publish — otherwise they hit a login with no account yet.
- `company_accounts` NOT-NULL columns: `razao_social, nome_fantasia, cnpj (unique), email, segmento, cidade, estado` (status defaults `ativa`). Provide all of them on insert.
