---
name: Google authentication boundaries
description: Product constraints for social login and paid registration.
---

Keep the existing company accounts, PostgreSQL sessions and payment activation model. Google must augment this identity model rather than replace it with another authentication system.

**Why:** The requested scope explicitly preserves paid clients, the administrator and existing Mercado Pago activation; filling a public registration form must not grant free product access.

**How to apply:** Existing users link Google only after authenticating their own account. Never merge accounts by matching e-mail or grant authority over an existing CNPJ merely because someone paid. New Google registrations require verified identity plus authorized activation before linking. Do not migrate production data or publish as part of authentication changes.

Paid onboarding must remain recoverable independently of the browser page and the current session.

**Why:** Pix approval may arrive after the short-lived Google proof expires, and session persistence can fail after provisioning. Consuming a claim before saving a usable session can strand a paying customer with an undelivered random password.

**How to apply:** Keep a bounded, secure server-verifiable recovery credential, reverify the original Google identity when needed, and save the authenticated session before consuming the one-time claim. Test both delayed approval and session-store failure.
