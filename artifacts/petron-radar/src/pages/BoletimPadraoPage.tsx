import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import {
  FileText,
  Building2,
  Users,
  Target,
  AlertCircle,
  CheckCircle2,
  Clock,
  Star,
  Filter,
  Download,
  Search,
  Flame,
  ArrowRight,
  Globe,
  MapPin,
  Calendar,
  TrendingUp,
  Zap,
  BarChart3,
  Eye,
  MessageSquare,
  Mail,
  Copy,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Package,
  Cpu,
  HardHat,
  Wifi,
} from "lucide-react";

// ── TIPOS ──────────────────────────────────────────────────────────────────
type Recomendacao = "Atacar" | "Monitorar" | "Declinar";
type Prioridade = "Alta" | "Média" | "Baixa";
type ClienteBeta = "Tavares" | "Pavanelli" | "Ambos" | "—";
type Categoria = "Engenharia" | "TI";

interface Oportunidade {
  id: string;
  objeto: string;
  objetoCompleto: string;
  status: string;
  empresa: string;
  abrangencia: string;
  dataInicio: string;
  dataFim: string;
  valor: string;
  categoria: Categoria;
  setor: string;
  score: number;
  prioridade: Prioridade;
  recomendacao: Recomendacao;
  clienteBeta: ClienteBeta;
  prazoCritico: boolean;
  tags: string[];
  justificativa: string;
}

// ── DADOS DAS OPORTUNIDADES ──────────────────────────────────────────────
const OPORTUNIDADES: Oportunidade[] = [
  {
    id: "7004415516",
    objeto: "Interligação de dutos e ramais industriais",
    objetoCompleto: "Serviços de interligação de dutos, ramais e conexões em unidades onshore. Inclui soldagem, teste hidrostático e comissionamento.",
    status: "Recebimento de Propostas",
    empresa: "Petrobras",
    abrangencia: "Nacional",
    dataInicio: "15/04/2026",
    dataFim: "30/05/2026",
    valor: "R$ 18,5M",
    categoria: "Engenharia",
    setor: "Engenharia / Dutos",
    score: 94,
    prioridade: "Alta",
    recomendacao: "Atacar",
    clienteBeta: "Tavares",
    prazoCritico: true,
    tags: ["dutos", "soldagem", "onshore", "prazo crítico"],
    justificativa: "Prazo urgente 30/05. Escopo central de engenharia de dutos — perfil direto de Tavares. Valor expressivo, Petrobras, Nacional.",
  },
  {
    id: "7004540482",
    objeto: "Monitoramento e inspeção de integridade estrutural",
    objetoCompleto: "Serviços de monitoramento de integridade estrutural e inspeção por END em equipamentos de produção e dutos. Inclui software de gestão de dados de inspeção.",
    status: "Recebimento de Propostas",
    empresa: "Petrobras",
    abrangencia: "Nacional",
    dataInicio: "10/04/2026",
    dataFim: "25/05/2026",
    valor: "R$ 7,2M",
    categoria: "TI",
    setor: "TI / Monitoramento e Inspeção",
    score: 92,
    prioridade: "Alta",
    recomendacao: "Atacar",
    clienteBeta: "Pavanelli",
    prazoCritico: true,
    tags: ["inspeção", "END", "integridade", "software", "prazo crítico"],
    justificativa: "Prazo urgentíssimo 25/05. Inclui software de gestão de dados — encaixe direto Pavanelli (TI industrial). Petrobras Nacional.",
  },
  {
    id: "7004345558",
    objeto: "Execução de projeto de subestação elétrica",
    objetoCompleto: "Projeto, fornecimento e execução de subestação elétrica de média tensão para unidade de produção onshore. Inclui painéis, transformadores, cabeamento e comissionamento.",
    status: "Recebimento de Propostas",
    empresa: "Petrobras",
    abrangencia: "Nacional",
    dataInicio: "01/04/2026",
    dataFim: "15/06/2026",
    valor: "R$ 28,0M",
    categoria: "Engenharia",
    setor: "Engenharia / Elétrica",
    score: 91,
    prioridade: "Alta",
    recomendacao: "Atacar",
    clienteBeta: "Tavares",
    prazoCritico: true,
    tags: ["subestação", "elétrica", "média tensão", "onshore"],
    justificativa: "Maior valor do boletim. Subestação elétrica — core de Tavares (engenharia industrial). Prazo 15/06, Nacional, Petrobras.",
  },
  {
    id: "7004457389",
    objeto: "Montagem industrial de módulos de processamento de gás",
    objetoCompleto: "Serviços de montagem industrial de módulos de processamento de gás natural em UPGN. Inclui içamento, alinhamento, fixação e interligações mecânicas.",
    status: "Recebimento de Propostas",
    empresa: "Petrobras",
    abrangencia: "Nacional",
    dataInicio: "05/04/2026",
    dataFim: "15/06/2026",
    valor: "R$ 42,0M",
    categoria: "Engenharia",
    setor: "Engenharia / Montagem Industrial",
    score: 90,
    prioridade: "Alta",
    recomendacao: "Atacar",
    clienteBeta: "Tavares",
    prazoCritico: true,
    tags: ["montagem industrial", "UPGN", "gás natural", "içamento"],
    justificativa: "Maior valor do boletim (R$42M). Montagem industrial de UPGN — perfil robusto de engenharia. Tavares prioritário. Jun/26.",
  },
  {
    id: "7004548684",
    objeto: "Obras civis e montagem eletromecânica em planta industrial",
    objetoCompleto: "Obras civis, estruturais e montagem eletromecânica em expansão de planta de processamento. Inclui fundações, estruturas metálicas, instalações elétricas e instrumentação.",
    status: "Recebimento de Propostas",
    empresa: "Petrobras",
    abrangencia: "Nacional",
    dataInicio: "12/04/2026",
    dataFim: "25/06/2026",
    valor: "R$ 35,0M",
    categoria: "Engenharia",
    setor: "Engenharia / Eletromecânica",
    score: 89,
    prioridade: "Alta",
    recomendacao: "Atacar",
    clienteBeta: "Tavares",
    prazoCritico: true,
    tags: ["obras civis", "eletromecânica", "estruturas metálicas", "expansão"],
    justificativa: "R$35M, Petrobras, Jun/26. Combo obras civis + eletromecânica é o perfil central de Tavares. Alta aderência.",
  },
  {
    id: "7004518007",
    objeto: "Automação e controle SCADA em plataforma offshore",
    objetoCompleto: "Fornecimento, instalação e comissionamento de sistema SCADA para automação e controle de processo em plataforma offshore. Inclui servidores, IHMs, rede industrial e integração com sistemas legados.",
    status: "Recebimento de Propostas",
    empresa: "Petrobras",
    abrangencia: "Internacional",
    dataInicio: "15/04/2026",
    dataFim: "30/06/2026",
    valor: "R$ 16,5M",
    categoria: "TI",
    setor: "TI / Automação Industrial",
    score: 93,
    prioridade: "Alta",
    recomendacao: "Atacar",
    clienteBeta: "Pavanelli",
    prazoCritico: true,
    tags: ["SCADA", "automação", "offshore", "IHM", "integração"],
    justificativa: "SCADA offshore: core de TI industrial de Pavanelli. R$16,5M, Petrobras, Internacional — oportunidade âncora para Pavanelli.",
  },
  {
    id: "7004555109",
    objeto: "Integração de sistemas de controle e comunicação industrial",
    objetoCompleto: "Projeto e execução de integração de sistemas DCS, comunicação industrial (Fieldbus, Profibus, OPC-UA) e PIMS em unidade de processamento. Inclui comissionamento e suporte.",
    status: "Recebimento de Propostas",
    empresa: "Petrobras",
    abrangencia: "Nacional",
    dataInicio: "18/04/2026",
    dataFim: "20/06/2026",
    valor: "R$ 12,8M",
    categoria: "TI",
    setor: "TI / Integração de Sistemas",
    score: 91,
    prioridade: "Alta",
    recomendacao: "Atacar",
    clienteBeta: "Pavanelli",
    prazoCritico: true,
    tags: ["DCS", "Profibus", "OPC-UA", "PIMS", "integração"],
    justificativa: "Integração DCS/PIMS: especialidade técnica de Pavanelli. Petrobras Nacional, Jun/26. Forte aderência técnica e comercial.",
  },
  {
    id: "7004461520",
    objeto: "Obras de urbanização e infraestrutura em área portuária",
    objetoCompleto: "Execução de obras de urbanização, pavimentação, drenagem e infraestrutura de suporte em terminal portuário da Transpetro. Inclui sinalização e sistema de iluminação.",
    status: "Recebimento de Propostas",
    empresa: "Transpetro",
    abrangencia: "Nacional",
    dataInicio: "20/04/2026",
    dataFim: "30/07/2026",
    valor: "R$ 11,2M",
    categoria: "Engenharia",
    setor: "Engenharia / Obras Civis",
    score: 82,
    prioridade: "Alta",
    recomendacao: "Atacar",
    clienteBeta: "Tavares",
    prazoCritico: false,
    tags: ["urbanização", "pavimentação", "drenagem", "portuário", "Transpetro"],
    justificativa: "Obras civis portuárias — aderente a Tavares. Transpetro, Jul/26. Valor justo, concorrência menor que Petrobras.",
  },
  {
    id: "7004520624",
    objeto: "Readequação de instalações elétricas e instrumentação onshore",
    objetoCompleto: "Readequação, modernização e retrofit de instalações elétricas, instrumentação e sistemas de controle em unidade onshore. Adequação às normas NR-10, NR-13 e IEC 61511.",
    status: "Recebimento de Propostas",
    empresa: "Petrobras",
    abrangencia: "Nacional",
    dataInicio: "25/04/2026",
    dataFim: "15/08/2026",
    valor: "R$ 9,8M",
    categoria: "Engenharia",
    setor: "Engenharia / Readequação",
    score: 76,
    prioridade: "Média",
    recomendacao: "Monitorar",
    clienteBeta: "Tavares",
    prazoCritico: false,
    tags: ["readequação", "retrofit", "NR-10", "instrumentação", "onshore"],
    justificativa: "Retrofit elétrico + instrumentação: aderência parcial de Tavares. Monitorar documentação exigida (NR-10/13) antes de propor.",
  },
  {
    id: "7004539186",
    objeto: "Operação e gestão logística de almoxarifado industrial",
    objetoCompleto: "Operação, gestão e controle de almoxarifado industrial com sistema de gestão de materiais (WMS/ERP). Inclui rastreabilidade, inventário e relatórios gerenciais digitais.",
    status: "Recebimento de Propostas",
    empresa: "Petrobras",
    abrangencia: "Nacional",
    dataInicio: "01/05/2026",
    dataFim: "30/09/2026",
    valor: "R$ 5,8M",
    categoria: "TI",
    setor: "TI / Logística e Sistemas",
    score: 72,
    prioridade: "Média",
    recomendacao: "Monitorar",
    clienteBeta: "Pavanelli",
    prazoCritico: false,
    tags: ["WMS", "ERP", "logística", "almoxarifado", "rastreabilidade"],
    justificativa: "WMS/ERP logístico: TI indireta, aderência parcial Pavanelli. Avaliar consórcio com empresa de logística antes de qualificar.",
  },
  {
    id: "7004549241",
    objeto: "Documentação técnica digital e gestão de informação de engenharia",
    objetoCompleto: "Serviços de elaboração, digitalização e gestão de documentação técnica de engenharia (GED/EDMS). Inclui plataforma de gestão documental, migração de dados e treinamento.",
    status: "Recebimento de Propostas",
    empresa: "Petrobras",
    abrangencia: "Internacional",
    dataInicio: "10/05/2026",
    dataFim: "30/10/2026",
    valor: "R$ 3,2M",
    categoria: "TI",
    setor: "TI / Documentação e GED",
    score: 68,
    prioridade: "Média",
    recomendacao: "Atacar",
    clienteBeta: "Pavanelli",
    prazoCritico: false,
    tags: ["GED", "EDMS", "documentação digital", "migração", "internacional"],
    justificativa: "GED/EDMS: TI de documentação técnica. Valor menor mas Internacional Petrobras — referência de projeto. Pavanelli pode qualificar.",
  },
  {
    id: "7004569810",
    objeto: "Engenharia de manutenção e planejamento de paradas programadas",
    objetoCompleto: "Serviços de engenharia de manutenção, planejamento e execução de paradas programadas em terminal de produtos. Inclui coordenação técnica, gestão de equipes e documentação pós-parada.",
    status: "Recebimento de Propostas",
    empresa: "Transpetro",
    abrangencia: "Nacional",
    dataInicio: "01/06/2026",
    dataFim: "15/01/2027",
    valor: "R$ 8,9M",
    categoria: "Engenharia",
    setor: "Engenharia / Manutenção Industrial",
    score: 70,
    prioridade: "Média",
    recomendacao: "Monitorar",
    clienteBeta: "Ambos",
    prazoCritico: false,
    tags: ["manutenção", "parada programada", "Transpetro", "terminal"],
    justificativa: "Manutenção e paradas: aderência para ambos (Tavares em execução, Pavanelli em sistemas). Prazo longo (Jan/27) — monitorar evolução.",
  },
];

// ── HELPERS ───────────────────────────────────────────────────────────────
const REC_CONFIG = {
  Atacar: { cls: "bg-green-500/15 text-green-400 border-green-500/25", icon: Zap },
  Monitorar: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/25", icon: Eye },
  Declinar: { cls: "bg-muted/30 text-muted-foreground border-border", icon: Clock },
} as const;

const PRIO_CONFIG = {
  Alta: { cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  Média: { cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  Baixa: { cls: "bg-muted/30 text-muted-foreground border-border" },
} as const;

const BETA_CONFIG = {
  Tavares: { cls: "bg-primary/15 text-primary border-primary/25", icon: HardHat },
  Pavanelli: { cls: "bg-purple-500/15 text-purple-400 border-purple-500/25", icon: Cpu },
  Ambos: { cls: "bg-blue-500/15 text-blue-400 border-blue-500/25", icon: Users },
  "—": { cls: "bg-muted/20 text-muted-foreground border-border", icon: Target },
} as const;

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90 ? "text-green-400 border-green-500/30 bg-green-500/10"
    : score >= 80 ? "text-primary border-primary/30 bg-primary/10"
    : score >= 70 ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
    : "text-muted-foreground border-border bg-muted/20";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full border ${color}`}>
      <Star className="w-3 h-3" />{score}
    </span>
  );
}

function OppCard({ op, expanded, onToggle }: { op: Oportunidade; expanded: boolean; onToggle: () => void }) {
  const { toast } = useToast();
  const RecIcon = REC_CONFIG[op.recomendacao].icon;
  const BetaIcon = BETA_CONFIG[op.clienteBeta].icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`rounded-xl border bg-card overflow-hidden transition-all ${
        op.prazoCritico ? "border-red-500/25" : op.prioridade === "Alta" ? "border-primary/20" : "border-border"
      }`}
    >
      {/* Prazo crítico strip */}
      {op.prazoCritico && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-1.5 flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs font-bold text-red-400">PRAZO CRÍTICO — {op.dataFim}</span>
        </div>
      )}

      <button className="w-full text-left p-4" onClick={onToggle}>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded border border-border">{op.id}</span>
              <Badge variant="outline" className="text-xs border-border text-muted-foreground">{op.empresa}</Badge>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${BETA_CONFIG[op.clienteBeta].cls}`}>
                <BetaIcon className="w-3 h-3" /> {op.clienteBeta}
              </span>
              {op.categoria === "TI" && (
                <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs"><Cpu className="w-3 h-3 mr-1" />TI</Badge>
              )}
              {op.categoria === "Engenharia" && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs"><HardHat className="w-3 h-3 mr-1" />Engenharia</Badge>
              )}
            </div>
            <p className="text-sm font-bold leading-snug pr-2">{op.objeto}</p>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{op.abrangencia}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Até {op.dataFim}</span>
              <span className="flex items-center gap-1 font-semibold text-foreground">{op.valor}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <ScoreBadge score={op.score} />
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${PRIO_CONFIG[op.prioridade].cls}`}>
                {op.prioridade}
              </span>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${REC_CONFIG[op.recomendacao].cls}`}>
              <RecIcon className="w-3.5 h-3.5" />{op.recomendacao}
            </span>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="px-4 py-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Objeto completo</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{op.objetoCompleto}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Justificativa da Recomendação</p>
                <p className="text-sm leading-relaxed">{op.justificativa}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {op.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded bg-muted/30 border border-border text-muted-foreground">{t}</span>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="h-8 text-xs border-border" onClick={() => { navigator.clipboard.writeText(`Oportunidade Petronect ${op.id} — ${op.objeto}\nEmpresa: ${op.empresa} | Prazo: ${op.dataFim} | Valor: ${op.valor}\nRecomendação: ${op.recomendacao} — Score ${op.score}\n${op.justificativa}`); toast({ title: "Copiado!" }); }}>
                  <Copy className="w-3 h-3 mr-1.5" /> Copiar dados
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-green-400 border border-green-500/20 hover:bg-green-500/10" onClick={() => { const msg = encodeURIComponent(`Oportunidade Petronect ${op.id}\n*${op.objeto}*\nEmpresa: ${op.empresa} | Prazo: ${op.dataFim} | Valor: ${op.valor}\nRecomendação Petron Radar: *${op.recomendacao}* — Score ${op.score}`); window.open(`https://wa.me/?text=${msg}`, '_blank'); }}>
                  <MessageSquare className="w-3 h-3 mr-1.5" /> WhatsApp
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── GERADOR DE BOLETIM ─────────────────────────────────────────────────────
function gerarTextoBoletim(cliente: "Tavares" | "Pavanelli", ops: Oportunidade[]): string {
  const filtradas = ops.filter((o) => o.clienteBeta === cliente || o.clienteBeta === "Ambos");
  const atacar = filtradas.filter((o) => o.recomendacao === "Atacar").sort((a, b) => b.score - a.score);
  const monitorar = filtradas.filter((o) => o.recomendacao === "Monitorar");

  const nomeCompleto = cliente === "Tavares"
    ? "Tavares Construções e Engenharia LTDA"
    : "Pavanelli Tech LTDA";

  return `📡 PETRON RADAR — BOLETIM PADRÃO DE INTELIGÊNCIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cliente: ${nomeCompleto}
Data: ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
Total de oportunidades analisadas: ${filtradas.length}

🎯 OPORTUNIDADES — ATACAR (${atacar.length})
${atacar.map((o, i) => `
${i + 1}. ID ${o.id} — ${o.objeto}
   Empresa: ${o.empresa} | Abrangência: ${o.abrangencia}
   Prazo final: ${o.dataFim} | Valor estimado: ${o.valor}
   Score Radar: ${o.score}/100 | Prioridade: ${o.prioridade}
   ${o.prazoCritico ? "⚠️ PRAZO CRÍTICO — Ação imediata necessária" : ""}
   Recomendação: ${o.justificativa}`).join("\n")}

👁️ OPORTUNIDADES — MONITORAR (${monitorar.length})
${monitorar.map((o) => `• ID ${o.id} — ${o.objeto} (Score ${o.score} | Prazo ${o.dataFim})`).join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Petron Radar Premium — Inteligência O&G
Próximo boletim: semanal`;
}

// ── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────
export default function BoletimPadraoPage() {
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [filtroCliente, setFiltroCliente] = useState<string>("todos");
  const [filtroPrazo, setFiltroPrazo] = useState<string>("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>("todas");
  const [filtroRec, setFiltroRec] = useState<string>("todas");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => setExpandedId((prev) => prev === id ? null : id);

  const agora = new Date();
  const isCritico = (dataFim: string) => {
    const [d, m, y] = dataFim.split("/").map(Number);
    const dt = new Date(y, m - 1, d);
    const diff = (dt.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 45;
  };

  const filtradas = OPORTUNIDADES.filter((op) => {
    if (busca && !op.objeto.toLowerCase().includes(busca.toLowerCase()) && !op.id.includes(busca)) return false;
    if (filtroCliente !== "todos" && op.clienteBeta !== filtroCliente && op.clienteBeta !== "Ambos") return false;
    if (filtroPrazo === "critico" && !op.prazoCritico) return false;
    if (filtroPrioridade !== "todas" && op.prioridade !== filtroPrioridade) return false;
    if (filtroRec !== "todas" && op.recomendacao !== filtroRec) return false;
    if (filtroCategoria !== "todas" && op.categoria !== filtroCategoria) return false;
    return true;
  }).sort((a, b) => b.score - a.score);

  const prazoCriticoCount = OPORTUNIDADES.filter((o) => o.prazoCritico).length;
  const atacarCount = OPORTUNIDADES.filter((o) => o.recomendacao === "Atacar").length;
  const valorTotal = OPORTUNIDADES.reduce((acc, o) => {
    const v = parseFloat(o.valor.replace(/[^0-9,]/g, "").replace(",", "."));
    return acc + v;
  }, 0);

  function gerarBoletim(cliente: "Tavares" | "Pavanelli") {
    const texto = gerarTextoBoletim(cliente, OPORTUNIDADES);
    navigator.clipboard.writeText(texto);
    trackEvent("bulletin_copy_requested", { bulletin_type: "standard" });
    toast({
      title: `Boletim ${cliente} copiado!`,
      description: "Texto pronto para enviar por WhatsApp ou e-mail.",
    });
  }

  const dataAtual = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Boletim Padrão de Inteligência</h1>
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Petronect · {dataAtual}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {OPORTUNIDADES.length} oportunidades analisadas — base Petronect para clientes beta Tavares e Pavanelli.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-9"
            onClick={() => gerarBoletim("Tavares")}
          >
            <HardHat className="w-4 h-4 mr-2" /> Boletim Tavares
          </Button>
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-9"
            onClick={() => gerarBoletim("Pavanelli")}
          >
            <Cpu className="w-4 h-4 mr-2" /> Boletim Pavanelli
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Oportunidades totais", valor: OPORTUNIDADES.length, cor: "text-foreground", icon: Target },
          { label: "Prazos críticos (Mai/Jun)", valor: prazoCriticoCount, cor: "text-red-400", icon: Flame },
          { label: "Recomendação Atacar", valor: atacarCount, cor: "text-green-400", icon: Zap },
          { label: "Volume total estimado", valor: `R$ ${valorTotal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}M`, cor: "text-primary", icon: TrendingUp },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <k.icon className={`w-4 h-4 mb-2 ${k.cor}`} />
            <p className={`text-xl font-extrabold ${k.cor}`}>{k.valor}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Alertas de prazo crítico */}
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-red-400" />
          <p className="text-sm font-bold text-red-400">Ação Imediata — Prazos Críticos Maio/Junho 2026</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {OPORTUNIDADES.filter((o) => o.prazoCritico).map((o) => {
            const BetaIcon = BETA_CONFIG[o.clienteBeta].icon;
            return (
              <div key={o.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-card border border-red-500/15">
                <BetaIcon className={`w-3.5 h-3.5 flex-shrink-0 ${BETA_CONFIG[o.clienteBeta].cls.split(" ")[1]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{o.objeto}</p>
                  <p className="text-xs text-muted-foreground">{o.id} · Prazo {o.dataFim}</p>
                </div>
                <ScoreBadge score={o.score} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por objeto ou ID…"
            className="pl-9 h-9 bg-muted/20 border-border text-sm"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={filtroCliente} onValueChange={setFiltroCliente}>
          <SelectTrigger className="h-9 w-[150px] bg-muted/20 border-border text-xs">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            <SelectItem value="Tavares">Tavares (Engenharia)</SelectItem>
            <SelectItem value="Pavanelli">Pavanelli (TI)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroPrazo} onValueChange={setFiltroPrazo}>
          <SelectTrigger className="h-9 w-[150px] bg-muted/20 border-border text-xs">
            <SelectValue placeholder="Prazo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os prazos</SelectItem>
            <SelectItem value="critico">Críticos Mai/Jun</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
          <SelectTrigger className="h-9 w-[130px] bg-muted/20 border-border text-xs">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="Alta">Alta</SelectItem>
            <SelectItem value="Média">Média</SelectItem>
            <SelectItem value="Baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroRec} onValueChange={setFiltroRec}>
          <SelectTrigger className="h-9 w-[140px] bg-muted/20 border-border text-xs">
            <SelectValue placeholder="Recomendação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="Atacar">Atacar</SelectItem>
            <SelectItem value="Monitorar">Monitorar</SelectItem>
            <SelectItem value="Declinar">Declinar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="h-9 w-[130px] bg-muted/20 border-border text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="Engenharia">Engenharia</SelectItem>
            <SelectItem value="TI">TI / Tecnologia</SelectItem>
          </SelectContent>
        </Select>
        {(busca || filtroCliente !== "todos" || filtroPrazo !== "todos" || filtroPrioridade !== "todas" || filtroRec !== "todas" || filtroCategoria !== "todas") && (
          <Button size="sm" variant="ghost" className="h-9 text-xs text-muted-foreground" onClick={() => { setBusca(""); setFiltroCliente("todos"); setFiltroPrazo("todos"); setFiltroPrioridade("todas"); setFiltroRec("todas"); setFiltroCategoria("todas"); }}>
            Limpar filtros
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Legenda */}
      <div className="flex gap-4 flex-wrap text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><HardHat className="w-3.5 h-3.5 text-primary" /> Tavares — Engenharia & Obras</span>
        <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-purple-400" /> Pavanelli — TI & Automação</span>
        <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-green-400" /> Atacar — Qualificar imediatamente</span>
        <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-amber-400" /> Monitorar — Acompanhar evolução</span>
        <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-primary" /> Score 0-100</span>
      </div>

      <Separator className="opacity-20" />

      {/* Lista de oportunidades */}
      <div className="space-y-2.5">
        <AnimatePresence>
          {filtradas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma oportunidade encontrada com os filtros aplicados.</p>
            </div>
          ) : (
            filtradas.map((op) => (
              <OppCard
                key={op.id}
                op={op}
                expanded={expandedId === op.id}
                onToggle={() => toggle(op.id)}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Resumo executivo por cliente */}
      <div className="grid sm:grid-cols-2 gap-4">
        {(["Tavares", "Pavanelli"] as const).map((cliente) => {
          const ops = OPORTUNIDADES.filter((o) => o.clienteBeta === cliente || o.clienteBeta === "Ambos");
          const atacar = ops.filter((o) => o.recomendacao === "Atacar");
          const critico = ops.filter((o) => o.prazoCritico);
          const Icon = cliente === "Tavares" ? HardHat : Cpu;
          const cor = cliente === "Tavares" ? "text-primary border-primary/20 bg-primary/5" : "text-purple-400 border-purple-500/20 bg-purple-500/5";
          const btnCls = cliente === "Tavares" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-purple-600 text-white hover:bg-purple-700";

          return (
            <Card key={cliente} className={`border ${cor}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cor.split(" ")[2]}`}>
                    <Icon className={`w-5 h-5 ${cor.split(" ")[0]}`} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{cliente === "Tavares" ? "Tavares Construções e Engenharia" : "Pavanelli Tech LTDA"}</p>
                    <p className="text-xs text-muted-foreground">{cliente === "Tavares" ? "BETA-01 · Engenharia & Obras O&G" : "BETA-02 · TI & Automação Industrial"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { l: "Total", v: ops.length },
                    { l: "Atacar", v: atacar.length },
                    { l: "Críticas", v: critico.length },
                  ].map((s) => (
                    <div key={s.l} className="text-center rounded-lg p-2 bg-card border border-border">
                      <p className={`text-lg font-extrabold ${cor.split(" ")[0]}`}>{s.v}</p>
                      <p className="text-xs text-muted-foreground">{s.l}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5 mb-4">
                  {atacar.slice(0, 3).map((o) => (
                    <div key={o.id} className="flex items-center gap-2 text-xs">
                      <Zap className="w-3 h-3 text-green-400 flex-shrink-0" />
                      <span className="truncate text-muted-foreground">{o.objeto}</span>
                      <ScoreBadge score={o.score} />
                    </div>
                  ))}
                </div>
                <Button size="sm" className={`w-full h-8 text-xs font-bold ${btnCls}`} onClick={() => gerarBoletim(cliente)}>
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> Gerar e copiar boletim completo
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
