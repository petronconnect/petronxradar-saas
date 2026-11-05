import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useListInquiries } from "@workspace/api-client-react";
import {
  Rocket,
  Target,
  CheckCircle2,
  Circle,
  ChevronRight,
  ArrowRight,
  MessageSquare,
  Mail,
  Linkedin,
  Copy,
  CheckCheck,
  Users,
  TrendingUp,
  Calendar,
  Star,
  Zap,
  Globe,
  Building2,
  Phone,
  ShieldCheck,
  Flame,
  Clock,
  Package,
  BarChart3,
  AlertCircle,
  ExternalLink,
  Play,
  RefreshCw,
} from "lucide-react";

function CopyBtn({ text }: { text: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  async function go() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button size="sm" variant="outline" className="h-7 text-xs border-border hover:border-primary/50 hover:text-primary" onClick={go}>
      {copied ? <CheckCheck className="w-3 h-3 mr-1 text-green-400" /> : <Copy className="w-3 h-3 mr-1" />}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}

const LAUNCH_CHECKLIST = [
  { id: 1, group: "Imediato — Fazer Agora", items: [
    { label: "Postar no LinkedIn: 'Lançamento Petron Radar — inteligência de mercado para O&G'", link: "/kit-comercial", urgente: true },
    { label: "Enviar mensagem de abertura para 5 leads qualificados no WhatsApp", link: "/kit-comercial", urgente: true },
    { label: "Cadastrar os 2 clientes beta (Tavares e Pavanelli) como cases no LinkedIn", urgente: true },
    { label: "Compartilhar link da landing page em 3 grupos de WhatsApp do setor O&G", link: "/landing", urgente: true },
  ]},
  { id: 2, group: "Hoje — Até o Final do Dia", items: [
    { label: "Criar lista de 20 empresas-alvo no setor O&G (ver segmentos abaixo)", urgente: false },
    { label: "Agendar demonstração para pelo menos 1 lead da lista", urgente: false },
    { label: "Enviar proposta por e-mail para lead mais qualificado", link: "/kit-comercial", urgente: false },
    { label: "Ativar oferta beta limitada (vagas comunicadas como limitadas)", urgente: false },
  ]},
  { id: 3, group: "Esta Semana", items: [
    { label: "Abordar 20 leads no LinkedIn e WhatsApp com scripts prontos", urgente: false },
    { label: "Realizar 3 demonstrações ao vivo da plataforma", link: "/apresentacao", urgente: false },
    { label: "Enviar 3 propostas comerciais formais", link: "/kit-comercial", urgente: false },
    { label: "Fechar ao menos 1 novo contrato além dos 2 beta", urgente: false },
    { label: "Registrar todos os leads no módulo Inquiries", link: "/inquiries", urgente: false },
  ]},
];

const FUNNEL_STAGES = [
  { stage: "Prospecção", desc: "Empresas identificadas como potencial", meta: 50, atual: 12, cor: "bg-blue-500", textCor: "text-blue-400" },
  { stage: "Contato Feito", desc: "WhatsApp, e-mail ou LinkedIn enviado", meta: 30, atual: 7, cor: "bg-indigo-500", textCor: "text-indigo-400" },
  { stage: "Demo Agendada", desc: "Reunião de apresentação marcada", meta: 10, atual: 2, cor: "bg-purple-500", textCor: "text-purple-400" },
  { stage: "Proposta Enviada", desc: "Proposta ou checkout compartilhado", meta: 7, atual: 1, cor: "bg-primary", textCor: "text-primary" },
  { stage: "Fechado", desc: "Contrato assinado / pagamento confirmado", meta: 3, atual: 2, cor: "bg-green-500", textCor: "text-green-400" },
];

const WEEKLY_GOALS = [
  { label: "Novos leads abordados", meta: 20, atual: 2 },
  { label: "Demos realizadas", meta: 3, atual: 0 },
  { label: "Propostas enviadas", meta: 3, atual: 0 },
  { label: "Contratos fechados", meta: 1, atual: 0 },
];

const TARGET_SEGMENTS_BR = [
  { segment: "Engenharia & Obras em O&G", potencial: "Alto", empresas: "1.200+", ex: "Construtoras, instaladoras, montadoras industriais", cor: "text-green-400", bg: "bg-green-500/10" },
  { segment: "TI / Tecnologia / Integração", potencial: "Alto", empresas: "800+", ex: "Sistemas, automação, SCADA, IoT industrial", cor: "text-blue-400", bg: "bg-blue-500/10" },
  { segment: "Serviços Especializados O&G", potencial: "Alto", empresas: "2.000+", ex: "Inspeção, manutenção, sondagem, logística offshore", cor: "text-amber-400", bg: "bg-amber-500/10" },
  { segment: "Petroquímica e Refino", potencial: "Médio", empresas: "400+", ex: "Fornecedores de insumos, químicos, catalisadores", cor: "text-purple-400", bg: "bg-purple-500/10" },
  { segment: "Fornecedores de Equipamentos", potencial: "Médio", empresas: "600+", ex: "Válvulas, tubulações, compressores, instrumentação", cor: "text-sky-400", bg: "bg-sky-500/10" },
  { segment: "Consultoria & Gestão", potencial: "Médio", empresas: "300+", ex: "Consultorias QHSE, gestão de projetos, compliance", cor: "text-orange-400", bg: "bg-orange-500/10" },
];

const TARGET_SEGMENTS_INTL = [
  { country: "Estados Unidos", flag: "🇺🇸", foco: "Houston — hub mundial de O&G. Empresas de serviços internacionais com operações no Brasil.", potencial: "Muito Alto" },
  { country: "Noruega", flag: "🇳🇴", foco: "Oslo / Bergen — majors e fornecedores de tecnologia offshore presentes no pré-sal.", potencial: "Alto" },
  { country: "Reino Unido", flag: "🇬🇧", foco: "Aberdeen / Londres — empresas de subsea e engenharia offshore com projetos Petrobras.", potencial: "Alto" },
  { country: "Países Árabes / UAE", flag: "🇦🇪", foco: "Dubai — empresas de trading, serviços e logística O&G com interesse no mercado brasileiro.", potencial: "Médio" },
  { country: "Argentina & Chile", flag: "🇦🇷", foco: "Buenos Aires / Santiago — fornecedores sul-americanos em expansão para o Brasil.", potencial: "Médio" },
];

const CAMPAIGN_MESSAGES = [
  {
    channel: "WhatsApp",
    icon: MessageSquare,
    cor: "text-green-400",
    bg: "bg-green-500/10",
    msgs: [
      {
        label: "Disparo Beta — Oferta Limitada",
        text: `[Nome], bom dia!\n\nEstamos lançando o *Petron Radar* — radar de inteligência de mercado para O&G 🛢️\n\nÉ uma plataforma de inteligência exclusiva para fornecedores e prestadores de serviço do setor.\n\n✅ Radar de licitações Petrobras em tempo real\n✅ Boletins semanais de inteligência\n✅ CRM especializado O&G\n✅ Integração Petroconnect\n\n*Fase Beta com desconto especial* — vagas limitadas.\n\nPosso te mostrar em 15 minutos?`,
      },
      {
        label: "CTA — Agendar Demo",
        text: `[Nome], posso te chamar para uma demonstração rápida de 15 min do Petron Radar?\n\nMostramos ao vivo: radar de oportunidades, boletins de inteligência e o CRM do setor de O&G.\n\nQual o melhor horário para você — manhã ou tarde?`,
      },
      {
        label: "CTA — Contratar Starter",
        text: `[Nome], temos o plano *Radar Starter* por R$ 890/mês — acesso a boletins de inteligência e radar básico de licitações do setor O&G.\n\nPara começar agora:\n🔗 [link checkout]\n\nAcesso liberado em até 1h útil após o pagamento.`,
      },
      {
        label: "CTA — Contratar Pro",
        text: `[Nome], o *Radar Pro* (R$ 2.490/mês) inclui radar completo de licitações Petrobras, CRM especializado e alertas em tempo real.\n\nPara empresas que precisam estar na frente das oportunidades do setor.\n\nCheckout: [link]\nQualquer dúvida, me chame aqui.`,
      },
    ],
  },
  {
    channel: "E-mail",
    icon: Mail,
    cor: "text-blue-400",
    bg: "bg-blue-500/10",
    msgs: [
      {
        label: "Cold Outreach — Beta Launch",
        text: `Assunto: [LANÇAMENTO BETA] Petron Radar — Inteligência de Mercado para O&G\n\nOlá, [Nome],\n\nEstamos lançando o Petron Radar — plataforma de inteligência de mercado exclusiva para fornecedores do setor de Petróleo, Óleo & Gás.\n\nEm operação com 2 empresas beta:\n• Tavares Construções e Engenharia LTDA — Engenharia & Obras / O&G\n• Pavanelli Tech LTDA — TI / Tecnologia / Integração\n\nO que a plataforma oferece:\n→ Radar de licitações e oportunidades Petrobras em tempo real\n→ Boletins semanais de inteligência do mercado O&G\n→ CRM especializado para contas estratégicas do setor\n→ Integração nativa com Petroconnect\n\n🎯 OFERTA BETA — vagas limitadas com condições especiais:\nPlano Starter: R$ 890/mês | Pro: R$ 2.490/mês | Enterprise: R$ 5.990/mês\n\nAgende sua demonstração gratuita de 20 minutos:\n[link da landing]\n\nAtenciosamente,\n[Seu Nome] — Equipe Comercial Petron Radar`,
      },
      {
        label: "Nurturing — Após 1ª Mensagem sem Resposta",
        text: `Assunto: Cases reais: como Tavares e Pavanelli usam o Petron Radar\n\nOlá, [Nome],\n\nSei que a agenda está sempre cheia — por isso vou direto ao ponto.\n\nA Tavares Construções e Engenharia e a Pavanelli Tech LTDA já utilizam o Petron Radar para monitorar oportunidades no setor O&G.\n\nSão empresas com CNPJ ativo, Petrobras cadastrado e operação real — igual à sua.\n\nO diferencial é simples: chegam antes à informação, e fecham mais contratos.\n\n20 minutos de demonstração pode mudar como vocês prospectam no setor.\n\nQual é o melhor horário esta semana?\n\n[Seu Nome]`,
      },
    ],
  },
  {
    channel: "LinkedIn",
    icon: Linkedin,
    cor: "text-sky-400",
    bg: "bg-sky-500/10",
    msgs: [
      {
        label: "Post de Lançamento Beta",
        text: `🚀 Lançamento: Petron Radar Premium — Inteligência de Mercado para O&G\n\nDepois de meses em desenvolvimento e validação com clientes reais, estamos lançando o Petron Radar para o mercado.\n\nSe você é fornecedor, prestador de serviços ou gestor de negócios no setor de Petróleo, Óleo & Gás, essa plataforma foi criada para você.\n\n✅ Radar de licitações Petrobras em tempo real\n✅ Boletins semanais de inteligência do setor\n✅ CRM especializado O&G\n✅ Integração Petroconnect\n\nJá em operação com:\n🏗️ Tavares Construções e Engenharia LTDA (Beta 01)\n💻 Pavanelli Tech LTDA (Beta 02)\n\n🎯 Fase Beta com condições especiais — vagas limitadas.\n\nSolicite sua demonstração gratuita:\n[link da landing]\n\n#PetróleoeGás #OeG #Petrobras #Inteligência #B2B #SaaS #Licitações`,
      },
      {
        label: "Mensagem de Conexão",
        text: `Olá, [Nome]!\n\nVi que você atua no setor de Petróleo & Gás — exatamente o perfil que a plataforma que desenvolvemos atende.\n\nO Petron Radar é uma ferramenta de inteligência de mercado para fornecedores e prestadores que querem chegar antes nas melhores oportunidades do setor.\n\nPoderia compartilhar nossa apresentação executiva com você?`,
      },
    ],
  },
];

const OFFER_BETA = {
  titulo: "Condição Especial de Lançamento — Founder Access",
  validade: "Maio 2026 · Vagas Limitadas",
  condicoes: [
    "R$ 500 no 1º mês — depois R$ 890/mês (Radar Starter)",
    "Acesso imediato após Pix confirmado",
    "Onboarding guiado incluso (até 3 sessões)",
    "Suporte prioritário via WhatsApp nos primeiros 60 dias",
    "Selo 'Empresa Fundadora' na plataforma",
    "Setup gratuito no Petroconnect",
    "Condição de beta preservada por 6 meses",
  ],
  planos: [
    { nome: "⭐ Founder — R$ 500/1º mês", preco: "→ R$ 890/mês", href: "/checkout/radar-lancamento", destaque: true, founder: true },
    { nome: "Starter", preco: "R$ 890/mês", href: "/checkout/radar-starter", destaque: false },
    { nome: "Pro", preco: "R$ 2.490/mês", href: "/checkout/radar-pro", destaque: false },
    { nome: "Enterprise", preco: "R$ 5.990/mês", href: "/checkout/radar-enterprise", destaque: false },
  ],
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-400 bg-green-500/10 border-green-500/20" : score >= 60 ? "text-primary bg-primary/10 border-primary/20" : "text-muted-foreground bg-muted/30 border-border";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {score}
    </span>
  );
}

function scoreInquiry(lead: any): number {
  let s = 40;
  const planScores: Record<string, number> = {
    "radar-ia-managed": 40, "radar-enterprise": 30, "radar-pro": 20, "radar-starter": 10,
  };
  s += planScores[lead.desiredPlan] ?? 5;
  if (lead.hasPetrobrasRegistration) s += 10;
  if (lead.interestedInBidding) s += 10;
  return Math.min(s, 100);
}

type Tab = "hoje" | "funil" | "segmentos" | "campanhas";

export default function CentralAquisicaoPage() {
  const [tab, setTab] = useState<Tab>("hoje");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [campanhaAtiva, setCampanhaAtiva] = useState(false);
  const { toast } = useToast();

  const inquiriesData = useListInquiries();
  const leads = (Array.isArray(inquiriesData) ? inquiriesData : [])
    .map((l: any) => ({ ...l, score: scoreInquiry(l) }))
    .sort((a: any, b: any) => b.score - a.score);

  function toggleCheck(key: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function iniciarCampanha() {
    setCampanhaAtiva(true);
    toast({
      title: "Campanha Beta Iniciada!",
      description: "Execute os passos do checklist para ganhar mercado hoje.",
    });
  }

  const totalCheckItems = LAUNCH_CHECKLIST.reduce((acc, g) => acc + g.items.length, 0);
  const completedItems = checkedItems.size;
  const progress = Math.round((completedItems / totalCheckItems) * 100);

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "hoje", label: "Começar Hoje", icon: Rocket },
    { id: "funil", label: "Funil & Metas", icon: BarChart3 },
    { id: "segmentos", label: "Segmentos", icon: Target },
    { id: "campanhas", label: "Campanhas", icon: Zap },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">Central de Aquisição</h1>
            {campanhaAtiva && (
              <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs font-bold animate-pulse">
                <Flame className="w-3 h-3 mr-1" /> Campanha Ativa
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Ganhar mercado agora — funil, segmentos, campanhas e scripts prontos para disparo.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!campanhaAtiva ? (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-md shadow-green-900/20"
              onClick={iniciarCampanha}
              data-testid="btn-iniciar-campanha"
            >
              <Play className="w-4 h-4 mr-2" />
              Iniciar Campanha Beta
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="border-green-500/30 text-green-400" disabled>
              <Flame className="w-4 h-4 mr-2" /> Campanha em Andamento
            </Button>
          )}
          <Button size="sm" variant="outline" className="border-border" asChild>
            <Link href="/landing">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Landing
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="border-border" asChild>
            <Link href="/inquiries">
              <Users className="w-3.5 h-3.5 mr-1.5" /> Leads
            </Link>
          </Button>
        </div>
      </div>

      {/* Cases Beta — topo de prova social */}
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { tag: "Beta 01", nome: "Tavares Construções e Engenharia LTDA", seg: "Engenharia & Obras / O&G", status: "Em Onboarding", petrobras: true },
          { tag: "Beta 02", nome: "Pavanelli Tech LTDA", seg: "TI / Tecnologia / Integração", status: "Ativo", petrobras: true },
        ].map((c) => (
          <div key={c.tag} className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-primary/20 text-primary border-primary/30 font-bold text-xs">{c.tag}</Badge>
                <span className="text-xs text-green-400 font-medium">{c.status}</span>
              </div>
              <p className="text-sm font-semibold mt-0.5 truncate">{c.nome}</p>
              <p className="text-xs text-muted-foreground">{c.seg} {c.petrobras && "· Petrobras ativo"}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto pb-0 scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ─── COMEÇAR HOJE ─── */}
        {tab === "hoje" && (
          <motion.div key="hoje" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-5">
            {/* Progress */}
            <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Progresso do Lançamento</span>
                  <span className="text-primary font-bold">{completedItems}/{totalCheckItems} itens — {progress}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
              {progress === 100 && (
                <Badge className="bg-green-500/10 text-green-400 border-green-500/20 font-bold flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Completo!
                </Badge>
              )}
            </div>

            {/* Checklist por grupo */}
            {LAUNCH_CHECKLIST.map((group) => (
              <Card key={group.id} className="border-border bg-card">
                <CardHeader className="pb-3 pt-4 px-5">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    {group.id === 1 && <Flame className="w-3.5 h-3.5 text-red-400" />}
                    {group.id === 2 && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                    {group.id === 3 && <Calendar className="w-3.5 h-3.5 text-blue-400" />}
                    {group.group}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-2.5">
                  {group.items.map((item, i) => {
                    const key = `${group.id}-${i}`;
                    const done = checkedItems.has(key);
                    return (
                      <div
                        key={key}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          done ? "border-green-500/20 bg-green-500/5" : "border-border bg-muted/20 hover:border-primary/30"
                        }`}
                        onClick={() => toggleCheck(key)}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {done
                            ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                            : <Circle className="w-5 h-5 text-muted-foreground/40" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-relaxed ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {item.label}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.urgente && !done && (
                            <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">Urgente</Badge>
                          )}
                          {(item as any).link && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); }}
                              asChild
                            >
                              <Link href={(item as any).link}>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}

            {/* Botão grande de início */}
            {!campanhaAtiva && (
              <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 text-center">
                <Rocket className="w-10 h-10 text-green-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold mb-2">Pronto para ganhar mercado?</h3>
                <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                  Execute o checklist acima, use os scripts prontos e inicie a campanha beta agora. As primeiras vagas beta são limitadas — cada dia conta.
                </p>
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold h-12 px-10 shadow-lg shadow-green-900/20"
                  onClick={iniciarCampanha}
                >
                  <Play className="w-5 h-5 mr-2" /> Iniciar Campanha Beta Comercial
                </Button>
              </div>
            )}

            {campanhaAtiva && (
              <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-5 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="font-bold text-green-400">Campanha Beta em andamento!</p>
                <p className="text-sm text-muted-foreground mt-1">Continue executando os itens do checklist. Use os scripts prontos na aba Campanhas.</p>
                <div className="flex gap-3 justify-center mt-4">
                  <Button size="sm" variant="outline" className="border-border" onClick={() => setTab("campanhas")}>
                    <Zap className="w-3.5 h-3.5 mr-1.5" /> Ver Scripts
                  </Button>
                  <Button size="sm" variant="outline" className="border-border" asChild>
                    <Link href="/vendedor">Modo Vendedor</Link>
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── FUNIL & METAS ─── */}
        {tab === "funil" && (
          <motion.div key="funil" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-5">
            <div className="grid lg:grid-cols-2 gap-5">
              {/* Funil visual */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Funil de Prospecção
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {FUNNEL_STAGES.map((s, i) => {
                    const pct = Math.round((s.atual / s.meta) * 100);
                    const width = Math.max(40, 100 - i * 12);
                    return (
                      <div key={s.stage} className="space-y-1" style={{ marginLeft: `${i * 12}px`, marginRight: `${i * 12}px` }}>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-semibold ${s.textCor}`}>{s.stage}</span>
                          <span className="text-muted-foreground">{s.atual} / {s.meta} meta</span>
                        </div>
                        <div className="h-8 bg-muted/30 rounded-md overflow-hidden border border-border/50 relative">
                          <motion.div
                            className={`h-full ${s.cor} opacity-70`}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: i * 0.08 }}
                          />
                          <div className="absolute inset-0 flex items-center px-3 justify-between">
                            <span className="text-xs font-medium text-white/90 drop-shadow">{s.desc}</span>
                            <span className="text-xs font-bold text-white/70">{pct}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Metas semanais */}
              <div className="space-y-4">
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Target className="w-4 h-4" /> Metas Semanais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {WEEKLY_GOALS.map((g) => {
                      const pct = Math.min(100, Math.round((g.atual / g.meta) * 100));
                      return (
                        <div key={g.label}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-muted-foreground">{g.label}</span>
                            <span className={`font-bold ${g.atual >= g.meta ? "text-green-400" : "text-foreground"}`}>
                              {g.atual}/{g.meta}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${g.atual >= g.meta ? "bg-green-500" : "bg-primary"}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Ranking de leads */}
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Star className="w-4 h-4" /> Ranking de Leads por Potencial
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {leads.length === 0 ? (
                      <div className="px-5 pb-4 text-sm text-muted-foreground">
                        Nenhum lead ainda. Compartilhe a landing para começar.
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {leads.slice(0, 6).map((lead: any, i: number) => (
                          <div key={lead.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/20 transition-colors">
                            <span className="text-xs text-muted-foreground w-4 text-right font-bold">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{lead.companyName}</p>
                              <p className="text-xs text-muted-foreground truncate">{lead.segment} · {lead.desiredPlan}</p>
                            </div>
                            <ScoreBadge score={lead.score} />
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                              <a href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                <Phone className="w-3 h-3" />
                              </a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="px-5 py-2.5 border-t border-border">
                      <Link href="/inquiries" className="text-xs text-primary hover:underline flex items-center gap-1">
                        Ver todos os leads <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Calendário de demos */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Calendário de Demonstrações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { dia: "Hoje", hora: "—", empresa: "Agendar agora", status: "vazio" },
                    { dia: "Amanhã", hora: "—", empresa: "Agendar agora", status: "vazio" },
                    { dia: "Esta semana", hora: "—", empresa: "Meta: 3 demos", status: "meta" },
                  ].map((slot, i) => (
                    <div key={i} className={`rounded-lg border p-4 text-center ${slot.status === "meta" ? "border-primary/20 bg-primary/5" : "border-dashed border-border bg-muted/10"}`}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{slot.dia}</p>
                      <p className="text-sm font-medium text-muted-foreground">{slot.empresa}</p>
                      {slot.status === "vazio" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs mt-2 text-primary" asChild>
                          <Link href="/inquiries">Agendar <ArrowRight className="w-3 h-3 ml-1" /></Link>
                        </Button>
                      )}
                      {slot.status === "meta" && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary w-0 rounded-full" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">0/3 realizadas</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Registre demos confirmadas diretamente nos Inquiries do lead correspondente.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ─── SEGMENTOS ─── */}
        {tab === "segmentos" && (
          <motion.div key="segmentos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Mercado Brasileiro — Empresas com CNPJ</h3>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {TARGET_SEGMENTS_BR.map((seg) => (
                  <motion.div
                    key={seg.segment}
                    whileInView={{ opacity: 1, y: 0 }}
                    initial={{ opacity: 0, y: 10 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3 }}
                    className="border border-border bg-card rounded-xl p-4 hover:border-primary/30 transition-colors"
                  >
                    <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${seg.bg} ${seg.cor}`}>
                      <div className={`w-1.5 h-1.5 rounded-full bg-current`} />
                      {seg.potencial} potencial
                    </div>
                    <h4 className="text-sm font-bold mb-1">{seg.segment}</h4>
                    <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{seg.ex}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{seg.empresas} empresas estimadas</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <Separator className="opacity-30" />

            <div>
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Camada Internacional / Overseas</h3>
              </div>
              <div className="space-y-3">
                {TARGET_SEGMENTS_INTL.map((country) => (
                  <div key={country.country} className="flex items-start gap-4 border border-border bg-card rounded-xl p-4 hover:border-primary/30 transition-colors">
                    <span className="text-2xl flex-shrink-0">{country.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-bold">{country.country}</h4>
                        <Badge variant="outline" className="text-xs border-border">{country.potencial}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{country.foco}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Abordagem Internacional:</strong> Plataforma disponível em português com suporte a empresas sem CNPJ brasileiro.
                  Para leads internacionais, use o campo "Empresa Internacional" no checkout e ajuste a proposta comercial com valores em USD quando necessário.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── CAMPANHAS ─── */}
        {tab === "campanhas" && (
          <motion.div key="campanhas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
            {/* Oferta beta */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-bold text-primary">{OFFER_BETA.titulo}</h3>
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Validade: {OFFER_BETA.validade}</Badge>
                    </div>
                    <ul className="space-y-1">
                      {OFFER_BETA.condicoes.map((c, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {OFFER_BETA.planos.map((p) => (
                      <Button
                        key={p.nome}
                        size="sm"
                        variant={p.destaque ? "default" : "outline"}
                        className={`text-xs h-auto py-2 flex-col gap-0 ${p.destaque ? "bg-primary text-primary-foreground" : "border-border"}`}
                        asChild
                      >
                        <Link href={p.href}>
                          <span className="font-bold">{p.nome}</span>
                          <span className="opacity-75 font-normal">{p.preco}</span>
                        </Link>
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scripts por canal */}
            {CAMPAIGN_MESSAGES.map((ch) => (
              <div key={ch.channel}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-lg ${ch.bg} flex items-center justify-center`}>
                    <ch.icon className={`w-4 h-4 ${ch.cor}`} />
                  </div>
                  <h3 className="font-bold">{ch.channel}</h3>
                </div>
                <div className="space-y-3">
                  {ch.msgs.map((msg, i) => (
                    <Card key={i} className="border-border bg-card">
                      <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{msg.label}</p>
                        <CopyBtn text={msg.text} />
                      </CardHeader>
                      <CardContent className="px-4 pb-3">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/50 max-h-52 overflow-y-auto">
                          {msg.text}
                        </pre>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Separator className="mt-5 opacity-20" />
              </div>
            ))}

            {/* CTAs finais por plano */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" /> Links de Contratação por Plano
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { nome: "Radar Starter", preco: "R$ 890/mês", desc: "Boletins + radar básico", href: "/checkout/radar-starter", destaque: false },
                  { nome: "Radar Pro", preco: "R$ 2.490/mês", desc: "Radar completo + CRM", href: "/checkout/radar-pro", destaque: true },
                  { nome: "Radar Enterprise", preco: "R$ 5.990/mês", desc: "Petroconnect + análise avançada", href: "/checkout/radar-enterprise", destaque: false },
                  { nome: "IA Managed", preco: "R$ 12.900/mês", desc: "IA preditiva + equipe dedicada", href: "/checkout/radar-ia-managed", destaque: false },
                ].map((plan) => (
                  <div key={plan.nome} className={`rounded-xl border p-4 ${plan.destaque ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
                    {plan.destaque && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs mb-2">Recomendado</Badge>}
                    <p className="text-sm font-bold mb-0.5">{plan.nome}</p>
                    <p className="text-lg font-extrabold text-primary mb-0.5">{plan.preco}</p>
                    <p className="text-xs text-muted-foreground mb-3">{plan.desc}</p>
                    <Button size="sm" className={`w-full h-8 text-xs ${plan.destaque ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border"}`} variant={plan.destaque ? "default" : "outline"} asChild>
                      <Link href={plan.href}>
                        Contratar <ArrowRight className="w-3 h-3 ml-1.5" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
