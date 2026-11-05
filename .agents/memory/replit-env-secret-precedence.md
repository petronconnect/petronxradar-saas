---
name: Replit shared env var vs secret precedence
description: A shared env var shadows a same-named secret; updating the secret has no effect until you delete the shared env var.
---

In this Replit project, a key can exist BOTH as a `shared` environment variable AND as
a Replit Secret at the same time. When both exist, the **shared env var value wins** in
`process.env` at runtime.

**Symptom seen:** updating a secret via `requestEnvVar` (e.g. swapping a test
`MP_ACCESS_TOKEN` for the production one) appeared to do nothing — `process.env` kept
returning the old value across multiple restarts — because a stale `shared` env var of
the same name was shadowing the freshly-set secret.

**Why:** `viewEnvVars({type:"env"})` and `viewEnvVars({type:"secret"})` can both list
the same key; they are not mutually exclusive. `setEnvVars` also refuses to write a key
that is already registered as a secret ("already set up as secrets ... may cause
conflicts"), so you cannot fix it by overwriting the env var.

**How to apply:** when a secret update "doesn't take", run `viewEnvVars({type:"env"})`.
If the key is present under `shared`, `deleteEnvVars({keys:[...], environment:"shared"})`
to remove the stale env var so the secret surfaces, then restart the workflow. Verify
from the actual runtime (`node -e` reading `process.env`, or the live endpoint), not
from the value you think you set. Sensitive values: set secrets only via
`requestEnvVar`, never `setEnvVars`.
