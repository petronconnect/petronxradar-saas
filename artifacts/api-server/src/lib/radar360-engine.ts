import { createHash } from "node:crypto";
import type {
  Radar360ImportRow,
  Radar360Profile,
  Radar360ScoreLine,
} from "@workspace/db";

export type Radar360Candidate = {
  sourceKey: string;
  sourceName: string;
  processNumber: string | null;
  object: string;
  contractor: string | null;
  deadlineText: string | null;
  timeZone: string | null;
  sourceUrl: string | null;
  sourceCheckedAt: string | null;
  sourceTimeKnown: boolean;
  sector: string | null;
  region: string | null;
  value: number | null;
  status: string | null;
  conflicts?: string[];
};

export type EvaluatedRadar360Item = Radar360Candidate & {
  justification: string;
  pendingFields: string[];
  action: string;
  urgency: "expired" | "today" | "urgent" | "soon" | "future" | "pending";
  fitScore: number | null;
  scoreBreakdown: Radar360ScoreLine[];
  category: "gold" | "complementary" | "discarded";
  expired: boolean;
  sortOrder: number;
};

export const RADAR360_SCORE_VERSION = "radar360-fit-v1";
export const RADAR360_SCORE_WEIGHTS = {
  sector: 25,
  keywords: 35,
  regions: 15,
  verifiedCapabilities: 20,
  dataQuality: 5,
} as const;

const HISTORICAL_PROFILES = [
  {
    referenceKey: "pavanelli-tech",
    displayName: "Pavanelli Tech",
    aliases: ["Pavanelli Tech"],
    focusAreas: ["TI", "software", "infraestrutura digital", "telecomunicações", "dados", "automação", "saneamento"],
    declaredCapabilities: ["TI", "software", "infraestrutura digital", "telecomunicações", "dados", "automação", "saneamento"],
    keywords: ["TI", "software", "infraestrutura digital", "telecomunicações", "dados", "automação", "saneamento"],
    exclusions: [],
  },
  {
    referenceKey: "ep-gobi",
    displayName: "EP GOBI / EPGOBI",
    aliases: ["EP GOBI", "EPGOBI"],
    focusAreas: ["serviços técnicos", "suporte", "monitoramento", "infraestrutura", "jardinagem", "andaimes", "válvulas", "manutenção geral"],
    declaredCapabilities: ["serviços técnicos", "suporte", "monitoramento", "infraestrutura", "jardinagem", "andaimes", "válvulas", "manutenção geral"],
    keywords: ["serviços técnicos", "suporte", "monitoramento", "infraestrutura", "jardinagem", "andaimes", "válvulas", "manutenção geral"],
    exclusions: ["manutenção marítima"],
  },
  {
    referenceKey: "ehp-novae",
    displayName: "EHP Engenharia / NOVAE",
    aliases: ["EHP Engenharia", "NOVAE"],
    focusAreas: ["engenharia", "projetos", "planejamento", "gestão", "serviços técnicos"],
    declaredCapabilities: ["engenharia", "projetos", "planejamento", "gestão", "serviços técnicos"],
    keywords: ["engenharia", "projetos", "planejamento", "gestão", "serviços técnicos"],
    exclusions: [],
  },
  {
    referenceKey: "mr-construcoes",
    displayName: "MR Construções / MR Produções e Projetos",
    aliases: ["MR Construções", "MR Produções e Projetos"],
    focusAreas: ["engenharia executiva", "construção", "montagem", "obras", "retrofit", "manutenção industrial"],
    declaredCapabilities: ["engenharia executiva", "construção", "montagem", "obras", "retrofit", "manutenção industrial"],
    keywords: ["engenharia executiva", "construção", "montagem", "obras", "retrofit", "manutenção industrial"],
    exclusions: [],
  },
  {
    referenceKey: "thera-consultoria",
    displayName: "THERA Consultoria",
    aliases: ["THERA Consultoria"],
    focusAreas: ["tecnologia", "sistemas", "consultoria", "integração", "licenciamento"],
    declaredCapabilities: ["tecnologia", "sistemas", "consultoria", "integração", "licenciamento"],
    keywords: ["tecnologia", "sistemas", "consultoria", "integração", "licenciamento"],
    exclusions: [],
  },
  {
    referenceKey: "construtora-veneza",
    displayName: "Construtora Veneza",
    aliases: ["Construtora Veneza"],
    focusAreas: ["construção civil", "engenharia", "manutenção", "infraestrutura", "montagem", "implantação", "serviços técnicos"],
    declaredCapabilities: ["construção civil", "engenharia", "manutenção", "infraestrutura", "montagem", "implantação", "serviços técnicos"],
    keywords: ["construção civil", "engenharia", "manutenção", "infraestrutura", "montagem", "implantação", "serviços técnicos"],
    exclusions: [],
  },
  {
    referenceKey: "plz-potenza",
    displayName: "PLZ / Potenza",
    aliases: ["PLZ", "Potenza"],
    focusAreas: ["engenharia", "facilities", "serviços prediais", "manutenção", "monitoramento", "gestão de edifícios"],
    declaredCapabilities: ["engenharia", "facilities", "serviços prediais", "manutenção", "monitoramento", "gestão de edifícios"],
    keywords: ["engenharia", "facilities", "serviços prediais", "manutenção", "monitoramento", "gestão de edifícios"],
    exclusions: [],
  },
] as const;

export function getHistoricalRadar360Profiles() {
  return HISTORICAL_PROFILES;
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function profileMissingFields(profile: Radar360Profile, isLinked: boolean): string[] {
  const missing: string[] = [];
  if (!isLinked) missing.push("conciliação com empresa ativa");
  if (!profile.focusAreas.length) missing.push("segmento/áreas de atuação");
  if (!profile.verifiedCapabilities.length) missing.push("capacidades comprovadas por documento revisado");
  if (!profile.regions.length) missing.push("regiões atendidas");
  if (!profile.keywords.length) missing.push("palavras-chave");
  if (!profile.exclusionsReviewed) missing.push("revisão das exclusões");
  return missing;
}

function parseDate(value: string | null): { date: string | null; hasTime: boolean } {
  if (!value?.trim()) return { date: null, hasTime: false };
  const trimmed = value.trim();
  const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoPrefix) return { date: isoPrefix[1], hasTime: /\b\d{1,2}:\d{2}\b/.test(trimmed) };
  const brPrefix = trimmed.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (brPrefix) {
    const day = brPrefix[1].padStart(2, "0");
    const month = brPrefix[2].padStart(2, "0");
    return { date: `${brPrefix[3]}-${month}-${day}`, hasTime: /\b\d{1,2}:\d{2}\b/.test(trimmed) };
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return { date: null, hasTime: false };
  return { date: new Date(parsed).toISOString().slice(0, 10), hasTime: /\b\d{1,2}:\d{2}\b/.test(trimmed) };
}

function urgencyFor(deadlineText: string | null, baseDate: string): {
  urgency: EvaluatedRadar360Item["urgency"];
  expired: boolean;
} {
  const { date } = parseDate(deadlineText);
  if (!date) return { urgency: "pending", expired: false };
  const remaining = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${baseDate}T00:00:00Z`)) / 86_400_000);
  if (remaining < 0) return { urgency: "expired", expired: true };
  if (remaining === 0) return { urgency: "today", expired: false };
  if (remaining <= 3) return { urgency: "urgent", expired: false };
  if (remaining <= 7) return { urgency: "soon", expired: false };
  return { urgency: "future", expired: false };
}

function textMatches(terms: string[], haystack: string): string[] {
  const normalized = normalizeText(haystack);
  return terms.filter((term) => {
    const normalizedTerm = normalizeText(term);
    return normalizedTerm.length >= 2 && normalized.includes(normalizedTerm);
  });
}

export function evaluateRadar360Candidate(
  profile: Radar360Profile,
  candidate: Radar360Candidate,
  baseDate: string,
): EvaluatedRadar360Item {
  const pendingFields = new Set<string>();
  if (!candidate.processNumber) pendingFields.add("número do processo");
  if (!candidate.contractor) pendingFields.add("contratante");
  if (!candidate.deadlineText) pendingFields.add("prazo");
  if (!candidate.timeZone) pendingFields.add("fuso horário");
  if (candidate.value == null) pendingFields.add("valor");
  if (!candidate.sector) pendingFields.add("setor");
  if (!candidate.region) pendingFields.add("região");
  if (!candidate.sourceUrl) pendingFields.add("link/documento da fonte");
  if (!candidate.sourceTimeKnown) pendingFields.add("momento de consulta na fonte");
  for (const conflict of candidate.conflicts ?? []) pendingFields.add(conflict);

  const allText = [
    candidate.object,
    candidate.contractor ?? "",
    candidate.sector ?? "",
    candidate.region ?? "",
    candidate.status ?? "",
  ].join(" ");
  const excluded = textMatches(profile.exclusions, allText);
  const areaTerms = [...profile.focusAreas, ...(candidate.sector ? [candidate.sector] : [])];
  const areaMatches = textMatches(areaTerms, allText);
  const keywordMatches = textMatches(profile.keywords, allText);
  const regionMatches = candidate.region
    ? textMatches(profile.regions, candidate.region)
    : [];
  const capabilityMatches = textMatches(profile.verifiedCapabilities, allText);
  const qualityFields = [
    !!candidate.processNumber,
    !!candidate.contractor,
    !!candidate.deadlineText,
    candidate.sourceTimeKnown,
    !!candidate.sourceName,
  ];
  const qualityCount = qualityFields.filter(Boolean).length;
  const dataPending = qualityCount !== qualityFields.length;
  const lines: Radar360ScoreLine[] = [
    {
      criterion: "Setor e áreas de atuação",
      weight: RADAR360_SCORE_WEIGHTS.sector,
      points: profile.focusAreas.length ? (areaMatches.length ? RADAR360_SCORE_WEIGHTS.sector : 0) : 0,
      evidence: profile.focusAreas.length ? (areaMatches.join(", ") || "sem correspondência textual") : "perfil não configurado",
      state: !profile.focusAreas.length ? "pending" : areaMatches.length ? "matched" : "not_matched",
    },
    {
      criterion: "Palavras-chave",
      weight: RADAR360_SCORE_WEIGHTS.keywords,
      points: profile.keywords.length ? Math.round(RADAR360_SCORE_WEIGHTS.keywords * keywordMatches.length / profile.keywords.length) : 0,
      evidence: profile.keywords.length ? (keywordMatches.join(", ") || "sem correspondência textual") : "perfil não configurado",
      state: !profile.keywords.length ? "pending" : keywordMatches.length ? "matched" : "not_matched",
    },
    {
      criterion: "Região atendida",
      weight: RADAR360_SCORE_WEIGHTS.regions,
      points: profile.regions.length && candidate.region && regionMatches.length ? RADAR360_SCORE_WEIGHTS.regions : 0,
      evidence: !profile.regions.length || !candidate.region ? "região do perfil ou da oportunidade pendente" : (regionMatches.join(", ") || "sem correspondência"),
      state: !profile.regions.length || !candidate.region ? "pending" : regionMatches.length ? "matched" : "not_matched",
    },
    {
      criterion: "Capacidade comprovada",
      weight: RADAR360_SCORE_WEIGHTS.verifiedCapabilities,
      points: profile.verifiedCapabilities.length
        ? Math.round(RADAR360_SCORE_WEIGHTS.verifiedCapabilities * capabilityMatches.length / profile.verifiedCapabilities.length)
        : 0,
      evidence: profile.verifiedCapabilities.length ? (capabilityMatches.join(", ") || "sem correspondência textual") : "nenhuma capacidade comprovada no perfil",
      state: !profile.verifiedCapabilities.length ? "pending" : capabilityMatches.length ? "matched" : "not_matched",
    },
    {
      criterion: "Qualidade dos dados",
      weight: RADAR360_SCORE_WEIGHTS.dataQuality,
      points: Math.round(RADAR360_SCORE_WEIGHTS.dataQuality * qualityCount / qualityFields.length),
      evidence: `${qualityCount} de ${qualityFields.length} campos essenciais disponíveis`,
      state: dataPending ? "pending" : "matched",
    },
  ];
  const hasEvidence = lines.some((line) => line.state !== "pending");
  const fitScore = hasEvidence ? lines.reduce((total, line) => total + line.points, 0) : null;
  const timing = urgencyFor(candidate.deadlineText, baseDate);
  let category: EvaluatedRadar360Item["category"] = "discarded";
  let justification = "Aderência insuficiente com os dados disponíveis; revisar os critérios antes de recomendar.";
  if (candidate.conflicts?.length) {
    justification = `Divergência entre fontes: ${candidate.conflicts.join("; ")}. Conferência manual necessária.`;
  } else if (timing.expired) {
    justification = `Prazo encerrado em ${candidate.deadlineText}; excluída do ranking ativo.`;
  } else if (excluded.length) {
    justification = `Termo de exclusão do perfil encontrado: ${excluded.join(", ")}.`;
  } else if (fitScore != null && fitScore >= 60) {
    category = "gold";
    justification = `Aderência textual forte com ${areaMatches.length + keywordMatches.length + capabilityMatches.length} correspondência(s); habilitação continua dependente de análise documental.`;
  } else if (fitScore != null && fitScore >= 25) {
    category = "complementary";
    justification = "Há correspondências parciais com o perfil; revisar escopo e habilitação antes de priorizar.";
  }
  if (!timing.expired && !excluded.length && !candidate.conflicts?.length && category === "discarded") {
    pendingFields.add("revisão de aderência");
  }
  const action = candidate.sourceUrl
    ? "Consultar a fonte original e confirmar prazo, situação e edital."
    : "Localizar a fonte original e confirmar prazo, situação e edital.";
  return {
    ...candidate,
    justification,
    pendingFields: [...pendingFields],
    action,
    urgency: timing.urgency,
    fitScore,
    scoreBreakdown: lines,
    category,
    expired: timing.expired,
    sortOrder: 0,
  };
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const normalized = text.replace(/^\uFEFF/, "");
  const firstLine = normalized.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let quoted = false;
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === '"') {
      if (quoted && normalized[i + 1] === '"') {
        currentCell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      currentRow.push(currentCell);
      currentCell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && normalized[i + 1] === "\n") i += 1;
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim())) rows.push(currentRow);
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }
  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim())) rows.push(currentRow);
  const headers = (rows.shift() ?? []).map((value) => normalizeText(value));
  return { headers, rows };
}

const HEADER_ALIASES: Record<string, string[]> = {
  processNumber: ["processo", "numero do processo", "numero", "process number", "petronect id", "id petronect"],
  object: ["objeto", "objeto da oportunidade", "titulo", "descricao", "escopo", "object", "title"],
  contractor: ["contratante", "comprador", "empresa", "orgao", "company", "buyer"],
  deadlineText: ["prazo", "data limite", "encerramento", "data de encerramento", "deadline", "end date"],
  timeZone: ["fuso", "fuso horario", "timezone", "time zone"],
  sourceUrl: ["link", "url", "fonte url", "documento", "source url"],
  checkedAt: ["consultado em", "data da consulta", "checked at", "source checked at"],
  sector: ["setor", "segmento", "sector"],
  region: ["regiao", "localidade", "estado", "region", "location"],
  value: ["valor", "valor estimado", "value", "estimated value"],
  status: ["situacao", "status", "substatus"],
};

function findColumn(headers: string[], field: string): number {
  const aliases = HEADER_ALIASES[field] ?? [];
  return headers.findIndex((header) => aliases.includes(header));
}

function parseBrazilianValue(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function safeSourceUrl(raw: string): string | null {
  if (!raw.trim()) return null;
  try {
    const parsed = new URL(raw.trim());
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function parseRadar360Csv({
  csvText,
  sourceName,
  now,
  existingKeys,
}: {
  csvText: string;
  sourceName: string;
  now: Date;
  existingKeys: Set<string>;
}): Radar360ImportRow[] {
  const { headers, rows } = parseCsv(csvText);
  if (!headers.length) return [];
  const positions = Object.fromEntries(Object.keys(HEADER_ALIASES).map((field) => [field, findColumn(headers, field)]));
  const withinFile = new Set<string>();
  return rows.map((cells) => {
    const read = (field: string) => {
      const position = positions[field] as number;
      return position >= 0 ? (cells[position] ?? "").trim() : "";
    };
    const object = read("object");
    const processNumber = read("processNumber") || null;
    const contractor = read("contractor") || null;
    const deadlineText = read("deadlineText") || null;
    const sourceUrl = safeSourceUrl(read("sourceUrl"));
    const rawCheckedAt = read("checkedAt");
    const checkedDate = rawCheckedAt ? Date.parse(rawCheckedAt) : Number.NaN;
    const checkedAtKnown = Number.isFinite(checkedDate) && /(?:Z|[+-]\d{2}:\d{2})$/i.test(rawCheckedAt);
    const identity = processNumber
      ? `process:${normalizeText(processNumber)}`
      : `record:${normalizeText([object, contractor ?? "", deadlineText ?? ""].join("|"))}`;
    const sourceKey = createHash("sha256").update(identity).digest("hex");
    const missingFields: string[] = [];
    if (!processNumber) missingFields.push("número do processo");
    if (!object) missingFields.push("objeto");
    if (!contractor) missingFields.push("contratante");
    if (!deadlineText) missingFields.push("prazo");
    if (!read("timeZone")) missingFields.push("fuso horário");
    if (!sourceUrl) missingFields.push("link/documento da fonte");
    if (!read("sector")) missingFields.push("setor");
    if (!read("region")) missingFields.push("região");
    if (parseBrazilianValue(read("value")) == null) missingFields.push("valor");
    if (!checkedAtKnown) missingFields.push("momento de consulta na fonte");
    let action: Radar360ImportRow["action"] = object ? "new" : "invalid";
    if (action === "new" && (existingKeys.has(sourceKey) || withinFile.has(sourceKey))) action = "duplicate";
    withinFile.add(sourceKey);
    return {
      processNumber,
      object,
      contractor,
      deadlineText,
      timeZone: read("timeZone") || null,
      sourceUrl,
      sourceName,
      checkedAt: checkedAtKnown ? new Date(checkedDate).toISOString() : now.toISOString(),
      checkedAtKnown,
      sector: read("sector") || null,
      region: read("region") || null,
      value: parseBrazilianValue(read("value")),
      status: read("status") || null,
      missingFields,
      action,
      sourceKey,
    };
  });
}

export function evaluateAndLimitCandidates(
  profile: Radar360Profile,
  candidates: Radar360Candidate[],
  baseDate: string,
): EvaluatedRadar360Item[] {
  const evaluated = candidates.map((candidate) => evaluateRadar360Candidate(profile, candidate, baseDate));
  const ranked = evaluated
    .filter((item) => item.category !== "discarded")
    .sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1) || urgencyRank(a.urgency) - urgencyRank(b.urgency))
    .slice(0, 10);
  const rankedKeys = new Set(ranked.map((item) => item.sourceKey));
  for (const item of evaluated) {
    if (item.category !== "discarded" && !rankedKeys.has(item.sourceKey)) {
      item.category = "discarded";
      item.justification = "Fora do limite de até 10 oportunidades desta edição; não é recomendação ativa.";
      item.pendingFields = [...new Set([...item.pendingFields, "revisão em edição futura"])];
    }
  }
  const rankedPositions = new Map(ranked.map((item, index) => [item.sourceKey, index + 1]));
  return evaluated.map((item) => ({
    ...item,
    sortOrder: rankedPositions.get(item.sourceKey) ?? 1000 + (item.expired ? 2 : 1),
  })).sort((a, b) => a.sortOrder - b.sortOrder);
}

function urgencyRank(value: EvaluatedRadar360Item["urgency"]): number {
  return { today: 0, urgent: 1, soon: 2, future: 3, pending: 4, expired: 5 }[value];
}

function reportLine(item: EvaluatedRadar360Item): string {
  const details = [
    `Processo: ${item.processNumber ?? "pendente"}`,
    `Objeto: ${item.object || "pendente"}`,
    `Contratante: ${item.contractor ?? "pendente"}`,
    `Prazo: ${item.deadlineText ?? "pendente"}${item.timeZone ? ` (${item.timeZone})` : " (horário/fuso pendente)"}`,
    `Fonte: ${item.sourceName} · URL: ${item.sourceUrl ?? "pendente"}${item.sourceTimeKnown && item.sourceCheckedAt ? ` · consulta na fonte ${item.sourceCheckedAt}` : " · momento da consulta na fonte não comprovado"}`,
    `Situação: ${item.status ?? "pendente"}`,
    `Valor: ${item.value == null ? "pendente na fonte" : item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    `Aderência técnica: ${item.fitScore == null ? "pendente" : `${item.fitScore}/100`} (não é probabilidade de vitória)`,
    `Critérios: ${item.scoreBreakdown.map((line) => `${line.criterion} ${line.points}/${line.weight}${line.state === "pending" ? " pendente" : ""}`).join("; ")}`,
    `Urgência: ${item.urgency}`,
    `Justificativa: ${item.justification}`,
    `Pendências: ${item.pendingFields.join(", ") || "nenhuma identificada"}`,
    `Ação: ${item.action}`,
  ];
  return details.map((line) => `- ${line}`).join("\n");
}

export function renderRadar360Text({
  profile,
  baseDate,
  sourceCoverage,
  items,
  warnings,
}: {
  profile: Radar360Profile;
  baseDate: string;
  sourceCoverage: Array<Record<string, unknown>>;
  items: EvaluatedRadar360Item[];
  warnings: string[];
}): string {
  const active = items.filter((item) => item.category !== "discarded");
  const gold = active.filter((item) => item.category === "gold");
  const complementary = active.filter((item) => item.category === "complementary");
  const discarded = items.filter((item) => item.category === "discarded");
  const reasons = groupDiscardReasons(discarded);
  const coverageText = sourceCoverage.map((source) => {
    const label = String(source.label ?? source.kind ?? "Fonte");
    const state = String(source.status ?? "pendente");
    const count = Number(source.recordCount ?? 0);
    const checked = source.checkedAt ? `; atividade registrada no app ${String(source.checkedAt)}` : "";
    const limits = Array.isArray(source.limitations) ? source.limitations.map(String).join("; ") : "";
    return `- ${label}: ${state}; ${count} registro(s)${checked}${limits ? `; limitações: ${limits}` : ""}`;
  }).join("\n");
  const missingProfile = profileMissingFields(profile, profile.companyId != null);
  return [
    `# ${profile.displayName.toLocaleUpperCase("pt-BR")} RADAR PREMIUM`,
    "",
    "Pente-fino executivo",
    `Filtro: ${[...profile.focusAreas, ...profile.keywords].join(", ") || "perfil ainda não configurado"}. Regiões: ${profile.regions.join(", ") || "pendentes"}. Exclusões: ${profile.exclusions.join(", ") || (profile.exclusionsReviewed ? "revisadas: nenhuma" : "revisão pendente")}.`,
    `Data-base: ${baseDate}`,
    "",
    "## Cobertura e fontes consultadas",
    coverageText || "- Nenhuma fonte selecionada.",
    "A cobertura é parcial e limitada às fontes selecionadas; a integração direta ao Petronect não está configurada.",
    "",
    `## Top ${Math.min(10, active.length)} oportunidades aderentes`,
    active.length ? active.map(reportLine).join("\n\n") : "Nenhuma oportunidade ativa aderente foi encontrada nas fontes selecionadas. Isso não representa cobertura completa do mercado.",
    "",
    "## Carteira ouro",
    gold.length ? gold.map((item) => `- ${item.processNumber ?? "Processo pendente"} — ${item.object}` ).join("\n") : "Sem itens classificados como ouro nesta edição.",
    "",
    "## Complementares / parcerias",
    complementary.length ? complementary.map((item) => `- ${item.processNumber ?? "Processo pendente"} — ${item.object}` ).join("\n") : "Sem itens complementares nesta edição.",
    "",
    `## Descartadas com motivo (${discarded.length})`,
    reasons.length ? reasons.map(([reason, count]) => `- ${reason}: ${count}`).join("\n") : "Nenhuma oportunidade descartada.",
    ...discarded.slice(0, 50).map((item) => `- ${item.processNumber ?? "Processo pendente"} — ${item.object || "Objeto pendente"} | ${discardReason(item)} | prazo: ${item.deadlineText ?? "pendente"} | fonte: ${item.sourceName}`),
    discarded.length > 50 ? `- Mais ${discarded.length - 50} registros descartados foram omitidos desta lista detalhada; totais por motivo acima.` : "",
    "",
    "## Conclusão e prioridades",
    missingProfile.length ? `- Perfil incompleto: ${missingProfile.join(", ")}.` : "- Perfil com os campos mínimos preenchidos; isso não substitui análise de habilitação.",
    "- Conferir edital, prazo e situação na fonte original antes de qualquer decisão.",
    "- Aderência técnica e urgência são dimensões distintas; nenhuma representa probabilidade de vitória.",
    ...warnings.map((warning) => `- ${warning}`),
    "",
    `Score ${RADAR360_SCORE_VERSION}: setor ${RADAR360_SCORE_WEIGHTS.sector}%, palavras-chave ${RADAR360_SCORE_WEIGHTS.keywords}%, região ${RADAR360_SCORE_WEIGHTS.regions}%, capacidade comprovada ${RADAR360_SCORE_WEIGHTS.verifiedCapabilities}%, qualidade dos dados ${RADAR360_SCORE_WEIGHTS.dataQuality}%.`,
  ].join("\n");
}

function groupDiscardReasons(items: EvaluatedRadar360Item[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const reason = discardReason(item);
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function discardReason(item: EvaluatedRadar360Item): string {
  return item.expired
    ? "Prazo encerrado"
    : item.justification.startsWith("Termo de exclusão")
      ? "Exclusão do perfil"
      : item.justification.startsWith("Divergência entre fontes")
        ? "Conflito entre fontes"
        : item.justification.startsWith("Fora do limite")
          ? "Fora do limite Top 10"
          : "Baixa aderência ou dados pendentes";
}

export function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] as string);
}

function wrapText(value: string, maxChars: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function renderRadar360Svg({
  profile,
  baseDate,
  items,
  sourceCoverage,
  logoDataUri,
  warnings = [],
}: {
  profile: Radar360Profile;
  baseDate: string;
  items: EvaluatedRadar360Item[];
  sourceCoverage: Array<Record<string, unknown>>;
  logoDataUri?: string;
  warnings?: string[];
}): string {
  const active = items.filter((item) => item.category !== "discarded");
  const discards = groupDiscardReasons(items.filter((item) => item.category === "discarded"));
  const coverageSummary = sourceCoverage.map((source) => {
    const limitations = Array.isArray(source.limitations) ? `; limitações: ${source.limitations.map(String).join(", ")}` : "";
    return `${source.label ?? source.kind}: ${source.recordCount ?? 0} (${source.status ?? "pendente"})${limitations}`;
  }).join("  •  ");
  const cardHeight = 390;
  const headerHeight = 450;
  const footerHeight = 360;
  const height = headerHeight + Math.max(active.length, 1) * cardHeight + footerHeight;
  const elements: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-label="${escapeXml(`${profile.displayName} Radar Premium ${baseDate}`)}">`,
    `<rect width="1200" height="${height}" fill="#f7f4ed"/>`,
    `<rect width="1200" height="22" fill="#d5a63a"/>`,
    `<text x="72" y="98" fill="#10253f" font-family="Arial, sans-serif" font-size="22" letter-spacing="4">PETRON RADAR PREMIUM</text>`,
    `<text x="72" y="164" fill="#10253f" font-family="Arial, sans-serif" font-size="42" font-weight="700">${escapeXml(profile.displayName.toLocaleUpperCase("pt-BR"))}</text>`,
    `<text x="72" y="210" fill="#536274" font-family="Arial, sans-serif" font-size="21">Pente-fino executivo · Data-base ${escapeXml(baseDate)}</text>`,
    `<rect x="72" y="246" width="1056" height="2" fill="#d5a63a"/>`,
  ];
  if (logoDataUri && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logoDataUri)) {
    elements.push(`<image x="950" y="40" width="170" height="120" preserveAspectRatio="xMidYMid meet" href="${logoDataUri}"/>`);
  }
  for (const [index, line] of wrapText(`Fontes: ${coverageSummary || "nenhuma selecionada"} · cobertura parcial; Petronect ao vivo não configurado.`, 100).entries()) {
    elements.push(`<text x="72" y="${286 + index * 27}" fill="#536274" font-family="Arial, sans-serif" font-size="17">${escapeXml(line)}</text>`);
  }
  const fitText = `Score ${RADAR360_SCORE_VERSION} · setor ${RADAR360_SCORE_WEIGHTS.sector}% · palavras-chave ${RADAR360_SCORE_WEIGHTS.keywords}% · região ${RADAR360_SCORE_WEIGHTS.regions}% · capacidade comprovada ${RADAR360_SCORE_WEIGHTS.verifiedCapabilities}% · dados ${RADAR360_SCORE_WEIGHTS.dataQuality}% · não é probabilidade de vitória`;
  elements.push(`<text x="72" y="${headerHeight - 52}" fill="#10253f" font-family="Arial, sans-serif" font-size="15">${escapeXml(fitText)}</text>`);
  elements.push(`<text x="72" y="${headerHeight - 18}" fill="#a57912" font-family="Arial, sans-serif" font-size="17" font-weight="700">TOP ${Math.min(10, active.length)} OPORTUNIDADES · ADERÊNCIA E URGÊNCIA SEPARADAS</text>`);
  if (!active.length) {
    elements.push(`<rect x="72" y="${headerHeight + 25}" width="1056" height="130" rx="10" fill="#fff" stroke="#ded8ca"/>`);
    elements.push(`<text x="100" y="${headerHeight + 75}" fill="#10253f" font-family="Arial, sans-serif" font-size="22">Nenhuma oportunidade ativa aderente nas fontes selecionadas.</text>`);
    elements.push(`<text x="100" y="${headerHeight + 112}" fill="#536274" font-family="Arial, sans-serif" font-size="17">Isso não representa cobertura completa do mercado.</text>`);
  }
  active.forEach((item, index) => {
    const y = headerHeight + index * cardHeight + 20;
    elements.push(`<rect x="72" y="${y}" width="1056" height="${cardHeight - 18}" rx="10" fill="#ffffff" stroke="#ded8ca"/>`);
    elements.push(`<rect x="72" y="${y}" width="9" height="${cardHeight - 18}" rx="4" fill="${item.category === "gold" ? "#d5a63a" : "#10253f"}"/>`);
    elements.push(`<text x="104" y="${y + 40}" fill="#a57912" font-family="Arial, sans-serif" font-size="16" font-weight="700">${escapeXml(item.category === "gold" ? "CARTEIRA OURO" : "COMPLEMENTAR")} · ${escapeXml(item.fitScore == null ? "ADERÊNCIA PENDENTE" : `ADERÊNCIA ${item.fitScore}/100`)} · URGÊNCIA ${escapeXml(item.urgency.toUpperCase())}</text>`);
    const fields = [
      `Processo: ${item.processNumber ?? "pendente"} · ${item.object}`,
      `Contratante: ${item.contractor ?? "pendente"} · Prazo: ${item.deadlineText ?? "pendente"}${item.timeZone ? ` (${item.timeZone})` : " (horário/fuso pendente)"}`,
      `Situação: ${item.status ?? "pendente"} · Valor: ${item.value == null ? "pendente na fonte" : item.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      `Fonte: ${item.sourceName} · URL: ${item.sourceUrl ?? "pendente"} · Consulta: ${item.sourceTimeKnown && item.sourceCheckedAt ? item.sourceCheckedAt : "momento na fonte não comprovado"}`,
      `Critérios de aderência: ${item.scoreBreakdown.map((line) => `${line.criterion} ${line.points}/${line.weight}${line.state === "pending" ? " pendente" : ""}`).join("; ") || "pendentes"}`,
      `Justificativa: ${item.justification}`,
      `Pendências: ${item.pendingFields.join(", ") || "nenhuma identificada"}`,
      `Ação: ${item.action}`,
    ];
    let lineY = y + 76;
    for (const field of fields) {
      for (const line of wrapText(field, 120).slice(0, 2)) {
        elements.push(`<text x="104" y="${lineY}" fill="#27384c" font-family="Arial, sans-serif" font-size="14">${escapeXml(line)}</text>`);
        lineY += 20;
      }
    }
  });
  const footerY = headerHeight + Math.max(active.length, 1) * cardHeight + 15;
  elements.push(`<rect x="72" y="${footerY}" width="1056" height="${footerHeight - 30}" rx="10" fill="#10253f"/>`);
  elements.push(`<text x="102" y="${footerY + 42}" fill="#e4bf67" font-family="Arial, sans-serif" font-size="20" font-weight="700">DESCARTADAS COM MOTIVO (${items.filter((item) => item.category === "discarded").length})</text>`);
  let discardY = footerY + 80;
  for (const [reason, count] of discards) {
    elements.push(`<text x="102" y="${discardY}" fill="#ffffff" font-family="Arial, sans-serif" font-size="17">${escapeXml(`${reason}: ${count}`)}</text>`);
    discardY += 28;
  }
  const missingProfile = profileMissingFields(profile, profile.companyId != null);
  const warningText = warnings.length ? warnings.join(" ") : "Sem alertas adicionais.";
  for (const [index, line] of wrapText(`Alertas: ${warningText}`, 120).slice(0, 2).entries()) {
    elements.push(`<text x="102" y="${footerY + footerHeight - 132 + index * 20}" fill="#e1e7ed" font-family="Arial, sans-serif" font-size="13">${escapeXml(line)}</text>`);
  }
  elements.push(`<text x="102" y="${footerY + footerHeight - 86}" fill="#e1e7ed" font-family="Arial, sans-serif" font-size="14">${escapeXml(missingProfile.length ? `Pendências do perfil: ${missingProfile.join(", ")}.` : "Perfil com campos mínimos informados; habilitação ainda deve ser validada.")}</text>`);
  elements.push(`<text x="102" y="${footerY + footerHeight - 48}" fill="#e1e7ed" font-family="Arial, sans-serif" font-size="14">Conferir edital, prazo e situação na fonte original. Aderência não é probabilidade de vitória.</text>`);
  elements.push("</svg>");
  return elements.join("");
}

export function getCandidateKey(row: Radar360ImportRow): string {
  return row.sourceKey;
}
