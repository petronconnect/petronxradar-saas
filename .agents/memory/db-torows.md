---
name: db.execute toRows pattern
description: db.execute() returns QueryResult not raw array — always unwrap with toRows()
---

## Rule
In `@workspace/api-server` route files, `db.execute(sql`...`)` returns a `QueryResult` object. To get the rows array, define and use this helper at the top of each route file:

```ts
function toRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}
```

**Why:** The Drizzle pg driver wraps results in a `QueryResult` with a `.rows` property. Direct array access on the result fails silently or throws.
