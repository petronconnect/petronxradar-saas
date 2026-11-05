import type { Request } from "express";

export function sessionSecret(environment = process.env): string {
  const secret = environment.SESSION_SECRET;
  if (environment.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("SESSION_SECRET forte é obrigatório em produção");
  }
  return secret || "petron-radar-secret-dev";
}

export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.regenerate(error => error ? reject(error) : resolve()));
}

export function persistSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.save(error => error ? reject(error) : resolve()));
}

export function safeDestination(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length > 2048 ||
      !value.startsWith("/") || value.startsWith("//") ||
      /[\\\u0000-\u0020%]/.test(value)) return fallback;
  const url = new URL(value, "https://internal.invalid");
  if (url.origin !== "https://internal.invalid" ||
      /^\/(?:api|login|cadastro)(?:\/|$)/.test(url.pathname)) return fallback;
  return value;
}
