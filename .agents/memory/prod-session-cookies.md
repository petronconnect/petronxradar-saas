---
name: Production session cookies behind Replit proxy
description: Why express-session secure cookies silently fail in prod without trust proxy, and the sameSite/CORS choice for a same-origin SPA+API.
---

# Production session cookies (Express + Replit proxy)

**Rule:** An Express app using `express-session` with `cookie.secure` truthy in production MUST call `app.set("trust proxy", 1)` BEFORE the session middleware.

**Why:** Replit serves production (and dev previews) over HTTPS through a reverse proxy; TLS terminates at the proxy and the request reaches the app as plain HTTP. Without trusting the proxy, `req.secure` is `false`, so express-session silently skips the `Set-Cookie` header for a `secure` cookie. Login still returns 200 (the user object is in the response body, so an SPA happily advances to the next screen), but the browser stores no session id → the very next authenticated request is 401 ("Não autenticado"). It reproduces ONLY in production, because dev runs with `secure:false`.

**How to apply:** When auth "succeeds on login but the next request is unauthenticated" and only in prod, suspect `trust proxy` FIRST — not the session store. The `session` table existing in both dev and prod does NOT rule this out (the store write succeeds; it's the cookie that never leaves).

**Cookie sameSite / CORS:** This product's SPA (served at `/`) and API (`/api`) are same-origin behind one proxy domain, so use `sameSite: "lax"`. Avoid `sameSite: "none"`: paired with credentialed wildcard CORS (`cors({ origin: true, credentials: true })`) it is a CSRF + data-exfiltration hole — any website could issue authenticated requests as a logged-in user and read the responses. A same-origin app needs no CORS middleware at all.
