---
name: Session cookie cross-origin config
description: How to configure session cookies to work through Replit's proxy/iframe
---

## Rule
The Replit preview pane is a proxied iframe. For cookies to work:

1. **CORS:** `cors({ origin: true, credentials: true })` in Express.
2. **Cookie:** `sameSite: "lax"` in development, `sameSite: "none"` + `secure: true` in production.
3. **Frontend fetch:** All `fetch()` calls to the API must include `credentials: "include"`.
4. **BASE_URL prefix:** Use `import.meta.env.BASE_URL.replace(/\/$/, "")` as prefix for all API fetch calls in the frontend (not just `/api/...`).

**Why:** Without `credentials: "include"`, session cookies are not sent, and `/api/auth/me` returns 401 even after login.
