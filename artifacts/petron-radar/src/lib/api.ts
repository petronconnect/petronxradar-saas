const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const PETRONECT_URL =
  "https://www.petronect.com.br/irj/go/km/docs/pccshrcontent/Site%20Content%20(Legacy)/Portal2018/pt/lista_licitacoes_publicadas_ft.html";

const PETRONECT_NUMERO_RE = /\b(700\d{7})\b/;

/**
 * Resolve o número da licitação no Petronect. Usa o campo dedicado (petronectId)
 * quando existe; senão extrai o número (10 dígitos, prefixo 700) do título e, por
 * fim, da descrição — assim o cliente sempre vê o mesmo número da oportunidade,
 * mesmo quando o campo dedicado vem vazio do banco.
 */
export function resolvePetronectNumero(o: {
  petronectId?: string | null;
  title?: string | null;
  description?: string | null;
}): string {
  const direct = o.petronectId?.trim();
  if (direct) return direct;
  for (const candidate of [o.title, o.description]) {
    const match = candidate?.match(PETRONECT_NUMERO_RE);
    if (match) return match[1];
  }
  return "";
}
