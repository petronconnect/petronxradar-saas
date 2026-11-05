---
name: Orval code generation compatibility
description: Security-patched Orval version compatibility with generated TypeScript clients.
---

Use a security-patched Orval version that passes generated-library typechecking rather than automatically taking the newest release. Orval 8.46.0 generated `Headers.entries()` calls that failed the current TypeScript DOM typings; Orval 8.22.0 remained above the reported vulnerability fix threshold and passed code generation and library typechecking.

**Why:** A code-generator upgrade can alter generated source in ways that do not typecheck, even when its input schema is unchanged.

**How to apply:** When upgrading Orval, run code generation, `typecheck:libs`, and the dependency audit before adopting the new version.
