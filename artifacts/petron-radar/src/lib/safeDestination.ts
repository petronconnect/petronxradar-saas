const BLOCKED_PREFIXES = ["/api", "/login", "/cadastro"];

/**
 * Returns a safe, app-internal path (relative to the router base) or null.
 * Rejects protocol-relative URLs, backslashes, control characters, encoded
 * escapes and auth/API routes.
 */
export function safeDestination(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 512) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  // Encoded slashes, backslashes, dots, control chars or double-encoding.
  if (/%(2f|5c|2e|25|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  const pathOnly = value.split(/[?#]/)[0].toLowerCase();
  if (pathOnly.split("/").some((seg) => seg === "..")) return null;
  for (const p of BLOCKED_PREFIXES) {
    if (pathOnly === p || pathOnly.startsWith(p + "/")) return null;
  }
  return value;
}

/** Builds /login?next=... for a path (only when it is safe and not "/"). */
export function loginPathFor(destination: string | null | undefined): string {
  const safe = safeDestination(destination);
  if (!safe || safe === "/") return "/login";
  return `/login?next=${encodeURIComponent(safe)}`;
}

export function apiBase(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export function googleStartUrl(purpose: "login" | "register" | "link" | "reauth", next?: string | null): string {
  const params = new URLSearchParams({ purpose });
  const safe = safeDestination(next);
  if (safe) params.set("next", safe);
  return `${apiBase()}/api/auth/google/start?${params.toString()}`;
}

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_unavailable: "O login com Google não está disponível no momento.",
  recent_login_required: "Por segurança, confirme sua identidade novamente antes de continuar.",
  google_cancelled: "A autenticação com Google foi cancelada.",
  existing_account: "Já existe uma conta com este e-mail. Entre com sua senha e vincule o Google no seu perfil.",
  google_not_linked: "Esta conta Google não tem um acesso ativo vinculado ao Petron Radar. Entre com e-mail e senha para vincular sua conta, faça seu cadastro ou contate o suporte se o acesso estiver inativo.",
  google_conflict: "Esta conta Google já está vinculada a outro acesso.",
  google_invalid: "Não foi possível validar a autenticação com Google. Tente novamente.",
};

export function authErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code] ?? "Não foi possível concluir a autenticação. Tente novamente.";
}
