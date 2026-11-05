---
name: PWA & Onboarding Architecture
description: Key decisions for the PWA setup and the automated onboarding/provisioning flow in Petron Radar.
---

## PWA

- The petron-radar artifact is served at ROOT `/` (artifact.toml `BASE_PATH="/"`, `previewPath="/"`). So `manifest.webmanifest` start_url/scope/icons and `sw.js` PRECACHE/fallback must use `/`, NOT `/petron-radar/`. Any new shareable-URL code must use `window.location.origin + import.meta.env.BASE_URL`, never a hardcoded `/petron-radar/`.
- Icons are SVG (192, 512, maskable). Supported in Chrome/Edge/Android. iOS Safari needs PNG apple-touch-icon — acceptable gap for now.
- **Service worker must only register in production** (`import.meta.env.PROD` guard in `main.tsx`). In DEV the cache-first SW serves stale Vite modules → app looks "stuck" on old code. The dev branch actively unregisters any SW + clears all caches to recover a stuck browser.
- Bumping the SW cache name (`CACHE` const in `sw.js`) purges old caches on `activate` — required to unstick browsers AND whenever non-hashed public assets (icons/manifest) change, since they're pinned by cache name.
- `InstallButton` is invisible until `beforeinstallprompt` fires — only works on HTTPS (production). In dev it stays hidden. Don't add a fallback "always visible" button.
- `usePWAInstall` hook captures the `beforeinstallprompt` event; `install()` calls `prompt()` and awaits `userChoice`.

**Why:** A cache-first SW in dev serves stale module code (caused "dashboard still messy / buttons dead" even after the code was fixed). beforeinstallprompt only fires when PWA criteria are met (HTTPS, manifest, SW). Vite content-hashes JS/CSS so cache-first is safe in prod, but non-hashed public assets are pinned to the cache name.

## Onboarding Gate

- `AuthUser` has `mustSetPassword?: boolean` and `onboardingCompleted?: boolean` (from `/api/auth/me` which now queries DB).
- `showOnboarding` in App.tsx: client user + (mustSetPassword || !onboardingCompleted) + !isPublic → renders `<WelcomeOnboarding />` overlay.
- Existing users were backfilled: `onboarding_completed = true` so they never see the modal.
- `refreshUser()` in AuthContext re-fetches `/api/auth/me` and updates React state — called after set-password and complete-onboarding.

## Claim Flow

- Pix response includes `claimToken` (32-byte hex string). Stored as sha256 hash in `payments.claim_token_hash`.
- On approved: CheckoutPage calls `POST /api/payments/:id/claim {claimToken}`.
- Claim: timingSafeEqual vs hash, marks `claimed_at`, regenerates session, sets session.user.
- If `ok:true`: redirect `window.location.href = import.meta.env.BASE_URL` → app reloads → AuthContext picks up session → WelcomeOnboarding shows.
- If `alreadyExists:true`: toast message to login manually.
