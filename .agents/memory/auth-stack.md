---
name: Auth stack choices
description: bcryptjs, express-session, connect-pg-simple setup decisions
---

## Rule
Use `bcryptjs` (pure JS) instead of `bcrypt` (native). `bcrypt` requires native build scripts that cannot be approved non-interactively in this Replit environment (`pnpm approve-builds` is interactive).

**Why:** `bcrypt@6` triggered "Ignored build scripts" and the pnpm approve-builds prompt is not automatable from bash. `bcryptjs@3` is API-compatible and pure JS.

**How to apply:** Any route that needs password hashing: `import bcrypt from "bcryptjs"`. Types: `@types/bcryptjs`.

## Session store
`connect-pg-simple` with `{ pool, tableName: "session", createTableIfMissing: false }`. The `session` table must be pre-created via raw SQL (see db-push-workaround.md).

## Session cookie
- dev: `sameSite: "lax"`, `secure: false`
- prod: `sameSite: "lax"`, `secure: true` (same-origin routing; HTTPS at reverse proxy).

## Frontend fetch
All authenticated API calls need `credentials: "include"` to send session cookies through the Vite/Replit proxy.
