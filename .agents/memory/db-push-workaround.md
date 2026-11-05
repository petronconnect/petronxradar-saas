---
name: drizzle-kit push workaround
description: drizzle-kit push is interactive — use raw SQL for new tables
---

## Rule
`pnpm --filter @workspace/db run push` prompts for confirmation when tables are new or look like renames. It **cannot** be automated from bash in this environment.

**Why:** The CLI interactive prompt hangs forever in a non-TTY bash context.

**How to apply:** When adding new tables, always create them via:
```bash
psql "$DATABASE_URL" << 'SQL'
CREATE TABLE IF NOT EXISTS ...;
SQL
```

Still update `lib/db/src/schema/index.ts` for TypeScript types and future reference, but the physical migration is done via psql.
