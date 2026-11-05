import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Flame,
  Clock,
  Calendar,
  Rocket,
  Globe,
  Users,
  FileText,
  Monitor,
  Target,
  Wallet,
  MessageSquare,
  Mail,
  Linkedin,
  Building2,
  Star,
  BarChart3,
  ArrowRight,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Zap,
  Package,
  Phone,
} from "lucide-react";

type Status = "pendente" | "em-andamento" | "concluido";

interface CheckItem {
  id: string;
  label: string;
  desc?: string;
  link?: string;
  urgente?: boolean;
}

interface CheckGroup {
  id: string;
  titulo: string;
  categoria: string;
  icon: any;
  cor: string;
  bg: string;
  border: string;
  items: CheckItem[];
}

const GRUPOS: CheckGroup[] = [
  {
    id: "landing",
    titulo: "Publicação da Landing Page",
    categoria: "Divulgação",
    icon: Globe,
    cor: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    items: [
      { id: "l1", label: "Revisar textos e proposta de valor na landing", link: "/landing", urgente: true },
      { id: "l2", label: "Confirmar que formulário de demo está recebendo leads corretamente", link: "/landing" },
      { id: "l3", label: "Publicar o projeto no Replit Deploy para gerar URL pública", urgente: true },
      { id: "l4", label: "Testar formulário de solicitação de demo na URL publicada" },
      { id: "l5", label: "Criar encurtador de link personalizado (petronradar.com.br ou similar)" },
      { id: "l6", label: "Compartilhar link público em grupos de WhatsApp O&G e LinkedIn" },
    ],
  },
  {
    id: "convites",
    titulo: "Campanha de Convites Comerciais",
    categoria: "Comercial",
    icon: MessageSquare,
    cor: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    items: [
      { id: "c1", label: "Postar no LinkedIn: lançamento Petron Radar Beta com cases Tavares e Pavanelli", link: "/aquisicao", urgente: true },
      { id: "c2", label: "Enviar WhatsApp de abertura para 10 contatos qualificados do setor O&G", link: "/kit-comercial", urgente: true },
      { id: "c3", label: "Enviar e-mail de cold outreach para 20 empresas da lista de segmentos", link: "/kit-comercial" },
      { id: "c4", label: "Conectar com 15 novas pessoas no LinkedIn — foco em gestores O&G" },
      { id: "c5", label: "Compartilhar post de lançamento em 3 grupos WhatsApp do setor" },
      { id: "c6", label: "Fazer follow-up de 48h com quem não respondeu (script pronto no Kit)" },
    ],
  },
  {
    id: "tavares",
    titulo: "Ativação Beta — Tavares Construções Engenharia",
    categoria: "Beta 01",
    icon: Building2,
    cor: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    items: [
      { id: "t1", label: "Agendar sessão de onboarding com Eduardo Tavares (RJ)", urgente: true, desc: "WhatsApp: 21987650001 · E-mail: contato@tavaresengenharia.com.br" },
      { id: "t2", label: "Guiar cadastro e primeiros passos na plataforma (30 min ao vivo)" },
      { id: "t3", label: "Conectar Petroconnect com as credenciais da empresa", link: "/petroconnect" },
      { id: "t4", label: "Configurar radar de oportunidades filtrado para segmento Engenharia O&G" },
      { id: "t5", label: "Enviar primeiro boletim personalizado após onboarding", link: "/boletins" },
      { id: "t6", label: "Coletar feedback após 7 dias de uso — NPS inicial" },
      { id: "t7", label: "Discutir upgrade de plano Pro → Enterprise em 60 dias", link: "/petron-pay" },
    ],
  },
  {
    id: "pavanelli",
    titulo: "Ativação Beta — Pavanelli Tech LTDA",
    categoria: "Beta 02",
    icon: Building2,
    cor: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    items: [
      { id: "p1", label: "Confirmar onboarding concluído com Rodrigo Pavanelli (SP)", urgente: true, desc: "WhatsApp: 11996540002 · E-mail: rodrigo@pavanellitech.com.br" },
      { id: "p2", label: "Verificar uso do radar de oportunidades — conferir primeiros acessos" },
      { id: "p3", label: "Validar integração Petroconnect ativa e sincronizada", link: "/petroconnect" },
      { id: "p4", label: "Solicitar depoimento formal para usar como case comercial" },
      { id: "p5", label: "Propor uso como referência em apresentações de vendas", link: "/apresentacao" },
      { id: "p6", label: "Avaliar candidatura ao plano IA Managed", link: "/petron-pay" },
    ],
  },
  {
    id: "boletins",
    titulo: "Primeiros Boletins de Inteligência",
    categoria: "Conteúdo",
    icon: FileText,
    cor: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    items: [
      { id: "b1", label: "Verificar os 4 boletins reais já publicados na plataforma", link: "/boletins" },
      { id: "b2", label: "Criar boletim de boas-vindas personalizado para Tavares e Pavanelli", link: "/boletins" },
      { id: "b3", label: "Publicar boletim semanal sobre oportunidades ativas do radar", link: "/boletins" },
      { id: "b4", label: "Criar alerta de licitações por e-mail/WhatsApp para clientes beta" },
      { id: "b5", label: "Planejar calendário editorial: 1 boletim/semana nas primeiras 4 semanas" },
    ],
  },
  {
    id: "demo",
    titulo: "Roteiro de Demonstração",
    categoria: "Vendas",
    icon: Monitor,
    cor: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    items: [
      { id: "d1", label: "Usar o roteiro do Modo Vendedor para estruturar a demo", link: "/vendedor" },
      { id: "d2", label: "Preparar tela de demo com dados reais (oportunidades + boletins)", link: "/oportunidades" },
      { id: "d3", label: "Agendar 3 demos esta semana via leads captados" },
      { id: "d4", label: "Usar apresentação executiva como entrada da reunião", link: "/apresentacao" },
      { id: "d5", label: "Enviar proposta formal via Kit Comercial após cada demo", link: "/kit-comercial" },
      { id: "d6", label: "Registrar resultado de cada demo nos Inquiries", link: "/inquiries" },
    ],
  },
  {
    id: "leads",
    titulo: "Captação de Leads",
    categoria: "Growth",
    icon: Target,
    cor: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    items: [
      { id: "le1", label: "Criar lista de 30 empresas-alvo qualificadas por segmento O&G", link: "/aquisicao" },
      { id: "le2", label: "Cadastrar manualmente leads quentes que entram por WhatsApp nos Inquiries", link: "/inquiries" },
      { id: "le3", label: "Acompanhar funil de prospecção semanalmente", link: "/aquisicao" },
      { id: "le4", label: "Usar ranking de potencial para priorizar abordagens", link: "/aquisicao" },
      { id: "le5", label: "Configurar WhatsApp Business para recebimento automático de leads" },
    ],
  },
  {
    id: "reunioes",
    titulo: "Controle de Reuniões",
    categoria: "Operacional",
    icon: Calendar,
    cor: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    items: [
      { id: "r1", label: "Meta: 3 demos realizadas esta semana" },
      { id: "r2", label: "Registrar data, empresa, responsável e próximos passos de cada reunião" },
      { id: "r3", label: "Enviar proposta em até 24h após cada reunião", link: "/kit-comercial" },
      { id: "r4", label: "Follow-up após 48h sem resposta à proposta" },
      { id: "r5", label: "Atualizar status de cada lead em Inquiries após cada contato", link: "/inquiries" },
    ],
  },
  {
    id: "mercadopago",
    titulo: "Integração Mercado Pago",
    categoria: "Financeiro",
    icon: Wallet,
    cor: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    items: [
      { id: "mp1", label: "Criar conta Mercado Pago PJ (pessoa jurídica) para o Petron Radar", urgente: true, desc: "mpago.com.br — cadastro com CNPJ da empresa" },
      { id: "mp2", label: "Obter Access Token de produção no painel do Mercado Pago" },
      { id: "mp3", label: "Configurar as variáveis de ambiente no Replit Secrets (não expor em código)", link: "/petron-pay", desc: "MERCADO_PAGO_ACCESS_TOKEN, MP_CLIENT_ID, MP_WEBHOOK_SECRET" },
      { id: "mp4", label: "Ativar Petron Pay Gateway em modo Sandbox para testar cobranças Pix", link: "/petron-pay" },
      { id: "mp5", label: "Registrar URL de webhook para confirmação automática de pagamento" },
      { id: "mp6", label: "Testar fluxo completo: Pix gerado → pago → acesso liberado automaticamente" },
      { id: "mp7", label: "Mudar ambiente para Produção após testes aprovados", link: "/petron-pay" },
    ],
  },
];

function ProgressRing({ pct }: { pct: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct === 100 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#3b82f6";
  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#1e2a3a" strokeWidth="5" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 26 26)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{pct}%</text>
    </svg>
  );
}

export default function ProximasAplicacoesPage() {
  const { toast } = useToast();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [activeGrupo, setActiveGrupo] = useState<string | null>(null);

  const toggle = (id: string) =>
    setChecked((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const pctOf = (grupo: CheckGroup) => {
    const done = grupo.items.filter((i) => checked.has(i.id)).length;
    return Math.round((done / grupo.items.length) * 100);
  };

  const totalItems = GRUPOS.reduce((acc, g) => acc + g.items.length, 0);
  const totalDone = checked.size;
  const totalPct = Math.round((totalDone / totalItems) * 100);

  const urgentesLeft = GRUPOS.flatMap((g) => g.items.filter((i) => i.urgente && !checked.has(i.id)));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Próximas Aplicações</h1>
          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-bold">Operação Comercial Imediata</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Checklist executável para levar o Petron Radar Premium à operação comercial plena.
        </p>
      </div>

      {/* Dashboard de progresso geral */}
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="col-span-1 flex items-center justify-center p-4 rounded-xl border border-border bg-card">
          <div className="text-center">
            <ProgressRing pct={totalPct} />
            <p className="text-xs text-muted-foreground mt-1.5">Progresso geral</p>
            <p className="text-sm font-bold">{totalDone}/{totalItems}</p>
          </div>
        </div>
        <div className="col-span-3 grid grid-cols-3 gap-3">
          {[
            { label: "Urgentes pendentes", valor: urgentesLeft.length, cor: urgentesLeft.length === 0 ? "text-green-400" : "text-red-400", icon: Flame },
            { label: "Grupos concluídos", valor: GRUPOS.filter((g) => pctOf(g) === 100).length, cor: "text-green-400", icon: CheckCircle2 },
            { label: "Grupos em andamento", valor: GRUPOS.filter((g) => pctOf(g) > 0 && pctOf(g) < 100).length, cor: "text-amber-400", icon: Clock },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center flex flex-col items-center justify-center gap-1">
              <s.icon className={`w-5 h-5 ${s.cor}`} />
              <p className={`text-2xl font-extrabold ${s.cor}`}>{s.valor}</p>
              <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Urgentes */}
      {urgentesLeft.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-2 pt-3 px-5">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-red-400 flex items-center gap-2">
              <Flame className="w-3.5 h-3.5" /> Ações Urgentes Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            {urgentesLeft.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-red-500/10 bg-red-500/5 cursor-pointer hover:border-red-500/30 transition-colors"
                onClick={() => toggle(item.id)}
              >
                <Circle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-sm flex-1">{item.label}</p>
                <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs flex-shrink-0">Urgente</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Grupos de checklist */}
      <div className="space-y-3">
        {GRUPOS.map((grupo) => {
          const pct = pctOf(grupo);
          const done = grupo.items.filter((i) => checked.has(i.id)).length;
          const isOpen = activeGrupo === grupo.id;
          const Icon = grupo.icon;

          return (
            <Card key={grupo.id} className={`border-border bg-card overflow-hidden transition-all`}>
              <button
                className="w-full text-left"
                onClick={() => setActiveGrupo(isOpen ? null : grupo.id)}
              >
                <div className="flex items-center gap-4 p-4">
                  <div className={`w-9 h-9 rounded-lg ${grupo.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4.5 h-4.5 ${grupo.cor}`} style={{ width: 18, height: 18 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <p className="text-sm font-bold">{grupo.titulo}</p>
                      <Badge variant="outline" className="text-xs border-border text-muted-foreground">{grupo.categoria}</Badge>
                      {pct === 100 && <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" /> Concluído</Badge>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${pct === 100 ? "bg-green-500" : "bg-primary"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                      <span className={`text-xs font-semibold flex-shrink-0 ${pct === 100 ? "text-green-400" : "text-muted-foreground"}`}>
                        {done}/{grupo.items.length}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                  />
                </div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden border-t border-border"
                  >
                    <div className="px-5 py-4 space-y-2">
                      {grupo.items.map((item) => {
                        const done = checked.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              done ? "border-green-500/20 bg-green-500/5" : "border-border bg-muted/10 hover:border-primary/30"
                            }`}
                            onClick={() => toggle(item.id)}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {done
                                ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                                : <Circle className="w-5 h-5 text-muted-foreground/30" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-relaxed ${done ? "line-through text-muted-foreground" : ""}`}>
                                {item.label}
                              </p>
                              {item.desc && !done && (
                                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {item.urgente && !done && (
                                <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">Urgente</Badge>
                              )}
                              {item.link && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                  onClick={(e) => e.stopPropagation()}
                                  asChild
                                >
                                  <Link href={item.link}><ChevronRight className="w-3.5 h-3.5" /></Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      {/* Próximos marcos */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Marcos de Operação Comercial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { marco: "Landing publicada + primeiro lead captado", prazo: "Esta semana", cor: "text-primary", icon: Globe },
              { marco: "Tavares e Pavanelli com onboarding completo", prazo: "Esta semana", cor: "text-green-400", icon: ShieldCheck },
              { marco: "3 demos realizadas + 1 proposta enviada", prazo: "Esta semana", cor: "text-amber-400", icon: Monitor },
              { marco: "Primeiro pagamento via Mercado Pago confirmado", prazo: "Próximas 2 semanas", cor: "text-cyan-400", icon: Wallet },
              { marco: "5 clientes ativos pagantes além dos betas", prazo: "Próximo mês", cor: "text-purple-400", icon: Users },
              { marco: "MRR R$ 10.000+", prazo: "60 dias", cor: "text-rose-400", icon: TrendingUp },
            ].map((m, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/10">
                <m.icon className={`w-4 h-4 flex-shrink-0 ${m.cor}`} />
                <p className="text-sm flex-1">{m.marco}</p>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-muted/30 ${m.cor}`}>{m.prazo}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Links rápidos */}
      <div className="grid sm:grid-cols-4 gap-3">
        {[
          { label: "Aquisição", href: "/aquisicao", icon: Rocket, desc: "Funil e campanhas" },
          { label: "Kit Comercial", href: "/kit-comercial", icon: Package, desc: "Scripts e materiais" },
          { label: "Petron Pay", href: "/petron-pay", icon: Wallet, desc: "Mercado Pago setup" },
          { label: "Modo Vendedor", href: "/vendedor", icon: Zap, desc: "Roteiro de demo" },
        ].map((l) => (
          <Button key={l.href} variant="outline" className="border-border h-auto py-3 flex-col gap-1" asChild>
            <Link href={l.href}>
              <l.icon className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold">{l.label}</span>
              <span className="text-xs text-muted-foreground font-normal">{l.desc}</span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
