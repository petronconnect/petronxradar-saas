export interface OpportunityLike {
  title: string;
  sector: string;
  value: number;
  region: string;
  status: string;
  deadline?: string | null;
  description?: string | null;
}

export type ImpactLevel = "positivo" | "neutro" | "atencao";

export interface AnalysisFactor {
  label: string;
  detail: string;
  impact: ImpactLevel;
}

export interface OpportunityAnalysis {
  score: number;
  level: "alta" | "media" | "baixa";
  levelLabel: string;
  recommendation: string;
  factors: AnalysisFactor[];
  diasRestantes: number | null;
  prazoLabel: string;
  nextSteps: string[];
}

const STRATEGIC_SECTORS = ["upstream", "downstream", "midstream"];

/** Aceita ISO (yyyy-mm-dd) e formato brasileiro (dd/mm/yyyy). */
function parseDeadline(raw: string): Date | null {
  const br = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Análise determinística baseada nos dados estruturados da oportunidade
 * (valor, prazo, setor, região). Não substitui a leitura do edital no Petronect.
 */
export function analyzeOpportunity(op: OpportunityLike): OpportunityAnalysis {
  let score = 50;
  const factors: AnalysisFactor[] = [];

  // Porte do contrato
  if (op.value >= 5_000_000) {
    score += 15;
    factors.push({ label: "Porte do contrato", detail: "Contrato de grande porte (acima de R$ 5 mi) — alto potencial de receita.", impact: "positivo" });
  } else if (op.value >= 1_000_000) {
    score += 10;
    factors.push({ label: "Porte do contrato", detail: "Contrato de médio porte (R$ 1–5 mi).", impact: "positivo" });
  } else if (op.value >= 300_000) {
    score += 5;
    factors.push({ label: "Porte do contrato", detail: "Contrato de pequeno/médio porte.", impact: "neutro" });
  } else {
    factors.push({ label: "Porte do contrato", detail: "Contrato de baixo valor — avalie a relação custo/benefício da proposta.", impact: "atencao" });
  }

  // Prazo
  let diasRestantes: number | null = null;
  let prazoLabel = "Sem prazo informado";
  if (op.deadline) {
    const d = parseDeadline(op.deadline);
    if (d) {
      diasRestantes = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
      if (diasRestantes < 0) {
        score -= 30;
        prazoLabel = "Prazo encerrado";
        factors.push({ label: "Prazo", detail: "Prazo de submissão encerrado.", impact: "atencao" });
      } else if (diasRestantes <= 7) {
        score -= 5;
        prazoLabel = `${diasRestantes} dia(s) restante(s)`;
        factors.push({ label: "Prazo", detail: "Prazo apertado — exige mobilização imediata da documentação.", impact: "atencao" });
      } else if (diasRestantes <= 20) {
        score += 8;
        prazoLabel = `${diasRestantes} dias restantes`;
        factors.push({ label: "Prazo", detail: "Prazo adequado para preparar habilitação e proposta.", impact: "positivo" });
      } else {
        score += 12;
        prazoLabel = `${diasRestantes} dias restantes`;
        factors.push({ label: "Prazo", detail: "Prazo confortável para estruturar uma proposta competitiva.", impact: "positivo" });
      }
    }
  } else {
    factors.push({ label: "Prazo", detail: "Confirme o prazo de submissão diretamente no Petronect.", impact: "neutro" });
  }

  // Setor
  if (STRATEGIC_SECTORS.includes(op.sector.toLowerCase())) {
    score += 10;
    factors.push({ label: "Setor", detail: `${op.sector} — setor estratégico com demanda recorrente na Petrobras.`, impact: "positivo" });
  } else {
    score += 5;
    factors.push({ label: "Setor", detail: `${op.sector}.`, impact: "neutro" });
  }

  // Região
  if (op.region) {
    factors.push({ label: "Região", detail: `Execução em ${op.region} — considere logística e custos de mobilização.`, impact: "neutro" });
  }

  score = Math.max(5, Math.min(98, Math.round(score)));

  let level: OpportunityAnalysis["level"];
  let levelLabel: string;
  let recommendation: string;
  if (score >= 70) {
    level = "alta";
    levelLabel = "Alta aderência";
    recommendation =
      "Boa aderência ao seu perfil. Recomendamos reunir a documentação de habilitação e registrar a proposta no Petronect dentro do prazo.";
  } else if (score >= 45) {
    level = "media";
    levelLabel = "Aderência moderada";
    recommendation =
      "Aderência moderada. Avalie sua capacidade técnica, margem e prazo antes de decidir participar.";
  } else {
    level = "baixa";
    levelLabel = "Baixa aderência";
    recommendation =
      "Aderência baixa ou prazo crítico. Participe apenas se houver capacidade comprovada e diferencial competitivo claro.";
  }

  const nextSteps: string[] = [];
  if (diasRestantes !== null && diasRestantes < 0) {
    nextSteps.push("Prazo de submissão encerrado — registre como referência ou descarte em Meu Portfólio.");
  } else {
    nextSteps.push("Baixe o edital e a planilha de proposta/orçamento no portal Petronect.");
    nextSteps.push("Reúna a documentação de habilitação (checklist abaixo).");
    nextSteps.push("Monte a proposta técnica e comercial conforme as exigências do edital.");
    nextSteps.push(
      diasRestantes !== null
        ? `Registre a proposta no Petronect — ${prazoLabel.toLowerCase()}.`
        : "Confirme o prazo e registre a proposta no Petronect."
    );
    nextSteps.push("Adicione ao Meu Portfólio para acompanhar cada etapa do lance.");
  }

  return { score, level, levelLabel, recommendation, factors, diasRestantes, prazoLabel, nextSteps };
}

export interface DocGroup {
  grupo: string;
  items: string[];
}

export const HABILITACAO_DOCS: DocGroup[] = [
  {
    grupo: "Habilitação Jurídica",
    items: [
      "Contrato/Estatuto social e últimas alterações",
      "Comprovante de inscrição no CNPJ",
      "Documentos dos sócios administradores",
    ],
  },
  {
    grupo: "Regularidade Fiscal e Trabalhista",
    items: [
      "Certidão Negativa de Débitos Federais (Receita/PGFN)",
      "Certificado de Regularidade do FGTS (CRF)",
      "Certidão Negativa de Débitos Trabalhistas (CNDT)",
      "Certidões de regularidade estadual e municipal",
    ],
  },
  {
    grupo: "Qualificação Econômico-Financeira",
    items: [
      "Balanço patrimonial do último exercício",
      "Certidão negativa de falência / recuperação judicial",
    ],
  },
  {
    grupo: "Qualificação Técnica",
    items: [
      "Atestados de capacidade técnica compatíveis",
      "Registro em conselho de classe (CREA/CRQ), quando aplicável",
    ],
  },
  {
    grupo: "Cadastro Petrobras",
    items: [
      "Cadastro Petronect ativo",
      "CRCC (Certificado de Registro Cadastral) na linha de fornecimento",
      "Avaliação de SMS / integridade, quando exigida",
    ],
  },
];
