import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useListInquiries } from "@workspace/api-client-react";
import {
  BarChart3,
  FileText,
  MessageSquare,
  Mail,
  Linkedin,
  Copy,
  CheckCheck,
  ArrowRight,
  TrendingUp,
  Users,
  Calendar,
  Target,
  Package,
  ExternalLink,
  MonitorPlay,
  Globe,
  CreditCard,
  ClipboardList,
  FlaskConical,
  Megaphone,
  Clock,
  ChevronRight,
  Star,
  Briefcase,
  Send,
  Phone,
  Building2,
  FileCheck,
} from "lucide-react";

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Texto copiado!", description: "Pronto para colar no seu canal." });
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 text-xs border-border hover:border-primary/50 hover:text-primary"
      onClick={handleCopy}
    >
      {copied ? <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}

const METRICS = [
  { label: "Envios Realizados", value: "2", sub: "leads abordados", icon: Send, color: "text-blue-400", bg: "bg-blue-500/10" },
  { label: "Respostas Recebidas", value: "2", sub: "taxa 100%", icon: MessageSquare, color: "text-green-400", bg: "bg-green-500/10" },
  { label: "Reuniões Agendadas", value: "1", sub: "conversão em demo", icon: Calendar, color: "text-amber-400", bg: "bg-amber-500/10" },
  { label: "Contratos Fechados", value: "2", sub: "Tavares + Pavanelli", icon: FileCheck, color: "text-primary", bg: "bg-primary/10" },
];

const COPY_TEXTS = [
  {
    channel: "WhatsApp",
    icon: MessageSquare,
    color: "text-green-400",
    bg: "bg-green-500/10",
    items: [
      {
        label: "Abordagem Fria — 1ª mensagem",
        text: `Olá, [Nome]! Tudo bem?\n\nSou da equipe Petron Radar — uma plataforma de inteligência de mercado 100% focada em Petróleo, Óleo & Gás.\n\nMonitoramos licitações, oportunidades e movimentos de grandes players como Petrobras em tempo real.\n\nEmpresas como a [Nome da Empresa do lead] estão usando para chegar antes da concorrência nas melhores oportunidades do setor.\n\nPosso te mostrar como funciona em 20 minutos? Sem compromisso.`,
      },
      {
        label: "Follow-up D+2",
        text: `[Nome], vim verificar se você teve chance de ver minha mensagem anterior sobre o Petron Radar.\n\nJá temos 2 empresas beta operando no sistema e os resultados têm sido muito bons em geração de oportunidades qualificadas.\n\nSe quiser, posso enviar nossa apresentação executiva agora mesmo. Fica muito mais fácil de entender o valor da plataforma.`,
      },
      {
        label: "Envio de Proposta",
        text: `[Nome], conforme combinado, segue o link com os planos e a proposta comercial do Petron Radar:\n\n🔗 [link da proposta]\n\nTemos planos a partir de R$ 890/mês com acesso a radar de licitações, boletins de inteligência e CRM especializado em O&G.\n\nPosso te ligar amanhã para tirar qualquer dúvida?`,
      },
    ],
  },
  {
    channel: "E-mail",
    icon: Mail,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    items: [
      {
        label: "Cold outreach — Assunto: Inteligência de Mercado para [Empresa]",
        text: `Assunto: Inteligência de Mercado Especializada em O&G para [Nome da Empresa]\n\nOlá, [Nome],\n\nIdentifiquei que a [Nome da Empresa] atua no setor de Petróleo, Óleo & Gás e quero apresentar uma solução que pode impactar diretamente seus resultados comerciais.\n\nO Petron Radar é uma plataforma SaaS de inteligência de mercado desenvolvida exclusivamente para fornecedores e prestadores de serviço do setor O&G. Nossa solução oferece:\n\n• Radar em tempo real de licitações e oportunidades da Petrobras e outras operadoras\n• Boletins de inteligência semanais com análises de mercado\n• CRM especializado para gestão de contas estratégicas em O&G\n• Integração Petroconnect para gestão de cadastro de fornecedor\n\nJá contamos com empresas como Tavares Engenharia e Pavanelli Tech utilizando a plataforma com resultados expressivos.\n\nGostaria de agendar uma demonstração de 20 minutos?\n\nAtenciosamente,\n[Seu Nome]\nEquipe Comercial — Petron Radar\n[WhatsApp] | [E-mail]`,
      },
      {
        label: "Follow-up pós-demo",
        text: `Assunto: Próximos Passos — Petron Radar para [Nome da Empresa]\n\nOlá, [Nome],\n\nFoi um prazer conversar com você na nossa demonstração!\n\nConforme discutimos, o plano mais indicado para o perfil da [Nome da Empresa] é o [Plano X], que inclui [benefícios principais].\n\nSeguem os próximos passos:\n1. Confirmar o plano de interesse\n2. Enviar dados da empresa para formalizar o contrato\n3. Realizar o pagamento e liberar acesso em até 24h\n\nProposta completa: [link]\n\nQualquer dúvida, estou disponível pelo WhatsApp: [número]\n\nAtenciosamente,\n[Seu Nome]`,
      },
    ],
  },
  {
    channel: "LinkedIn",
    icon: Linkedin,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    items: [
      {
        label: "Conexão + mensagem inicial",
        text: `Olá, [Nome]! Vi que você atua na área de [área] no setor de O&G — exatamente o perfil que nossa plataforma foi construída para atender.\n\nO Petron Radar é uma ferramenta de inteligência de mercado para empresas que precisam se antecipar em licitações e oportunidades na cadeia de petróleo e gás.\n\nPosso compartilhar nossa apresentação executiva?`,
      },
      {
        label: "Post de lançamento (para perfil pessoal/empresa)",
        text: `Lançamos o Petron Radar — inteligência de mercado para o setor de Petróleo, Óleo & Gás.\n\nSe você é fornecedor, prestador de serviços ou busca oportunidades de negócio no setor de O&G, precisa conhecer:\n\n✅ Radar de licitações em tempo real\n✅ Boletins de inteligência semanais\n✅ CRM especializado em O&G\n✅ Integração Petroconnect\n\nJá temos 2 empresas beta em operação com resultados concretos.\n\nDemonstração gratuita disponível: [link da landing]\n\n#PetróleoeGás #OeG #Petrobras #Inteligência #B2B #SaaS`,
      },
    ],
  },
];

const FOLLOWUP_SEQUENCE = [
  { day: "D+0", label: "Primeiro contato", action: "Enviar mensagem de abordagem inicial (WhatsApp ou LinkedIn). Incluir link da landing page.", tipo: "Prospecção", cor: "bg-blue-500" },
  { day: "D+2", label: "Follow-up 1", action: "Se sem resposta: reenviar no WhatsApp com texto diferente. Mencionar os cases beta (Tavares e Pavanelli).", tipo: "Follow-up", cor: "bg-amber-500" },
  { day: "D+4", label: "Envio da apresentação", action: "Enviar link da Apresentação Executiva (/apresentacao). Perguntar se houve tempo de ver.", tipo: "Nutrir", cor: "bg-purple-500" },
  { day: "D+7", label: "Oferta de demo", action: "Propor horário específico para demonstração de 20 min. Usar mensagem de WhatsApp pré-pronta.", tipo: "Demo", cor: "bg-green-500" },
  { day: "D+10", label: "Envio de proposta", action: "Após a demo (ou sem ela): enviar link de proposta/checkout com plano recomendado. Seguir com e-mail formal.", tipo: "Proposta", cor: "bg-primary" },
  { day: "D+14", label: "Follow-up decisão", action: "Perguntar sobre status da decisão. Oferecer período trial ou desconto de lançamento (se aplicável).", tipo: "Fechamento", cor: "bg-red-500" },
  { day: "D+21", label: "Última tentativa", action: "Mensagem final: resumir valor, reafirmar disponibilidade. Se não responder, arquivar e nutrir mensalmente.", tipo: "Final", cor: "bg-gray-500" },
];

const MATERIALS = [
  { label: "Landing Comercial", desc: "Página pública de oferta da plataforma", href: "/landing", icon: Globe, ext: false },
  { label: "Apresentação Executiva", desc: "7 slides de apresentação para reuniões", href: "/apresentacao", icon: MonitorPlay, ext: false },
  { label: "Planos & Preços", desc: "Tabela completa de planos e funcionalidades", href: "/planos", icon: CreditCard, ext: false },
  { label: "Clientes Beta", desc: "Tavares Engenharia e Pavanelli Tech — cases reais", href: "/clientes-beta", icon: FlaskConical, ext: false },
  { label: "Inquiries / Leads", desc: "Painel de leads e solicitações recebidas", href: "/inquiries", icon: ClipboardList, ext: false },
  { label: "Checkout — Radar Starter", desc: "Página de contratação do plano Starter", href: "/checkout/radar-starter", icon: Package, ext: false },
  { label: "Checkout — Radar Pro", desc: "Página de contratação do plano Pro", href: "/checkout/radar-pro", icon: Package, ext: false },
  { label: "Checkout — Radar Enterprise", desc: "Página de contratação do plano Enterprise", href: "/checkout/radar-enterprise", icon: Package, ext: false },
  { label: "Modo Vendedor", desc: "Roteiro de apresentação e objeções", href: "/vendedor", icon: Briefcase, ext: false },
];

const PROPOSAL_TEMPLATE = `PROPOSTA COMERCIAL — PETRON RADAR PREMIUM
Data: [DATA]
Proposta nº: [NÚMERO]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PARA:
Empresa: [NOME DA EMPRESA]
CNPJ: [CNPJ]
Responsável: [NOME DO RESPONSÁVEL]
Cargo: [CARGO]
E-mail: [E-MAIL]
WhatsApp: [WHATSAPP]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SOLUÇÃO PROPOSTA: [NOME DO PLANO]
Valor: R$ [VALOR]/mês
Vigência inicial: 12 meses
Faturamento: Mensal, via Pix, Boleto ou Cartão de Crédito

INCLUI:
✅ [FUNCIONALIDADE 1]
✅ [FUNCIONALIDADE 2]
✅ [FUNCIONALIDADE 3]
✅ Suporte via WhatsApp em horário comercial
✅ Onboarding guiado de até 3 sessões
✅ Acesso imediato após confirmação do pagamento

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONDIÇÕES ESPECIAIS (BETA LAUNCH):
• Desconto de [X]% nos primeiros 3 meses
• Setup gratuito
• Suporte prioritário durante os primeiros 60 dias

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRÓXIMOS PASSOS:
1. Confirmação do plano pelo responsável
2. Envio dos dados da empresa para formalização
3. Emissão de NF ou contrato (se necessário)
4. Pagamento e liberação do acesso em até 24h

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALIDADE DESTA PROPOSTA: 7 dias

Petron Radar Premium
E-mail: comercial@petronradar.com.br
WhatsApp: +55 [NÚMERO]
Web: [link da landing]`;

export default function KitComercialPage() {
  const inquiriesData = useListInquiries();
  const inquiries = Array.isArray(inquiriesData) ? inquiriesData : [];
  const recentLeads = inquiries.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kit Comercial</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Central de vendas — textos prontos, métricas de campanha, materiais e propostas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/vendedor">
              <Briefcase className="w-4 h-4 mr-2" />
              Modo Vendedor
            </Link>
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
            <Link href="/landing">
              <ExternalLink className="w-4 h-4 mr-2" />
              Ver Landing
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="campanha" className="w-full">
        <TabsList className="bg-muted/50 border border-border w-full justify-start overflow-x-auto">
          <TabsTrigger value="campanha" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Campanha
          </TabsTrigger>
          <TabsTrigger value="textos" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Textos Prontos
          </TabsTrigger>
          <TabsTrigger value="followup" className="gap-2">
            <Clock className="w-4 h-4" /> Sequência Follow-up
          </TabsTrigger>
          <TabsTrigger value="materiais" className="gap-2">
            <Package className="w-4 h-4" /> Materiais
          </TabsTrigger>
          <TabsTrigger value="proposta" className="gap-2">
            <FileText className="w-4 h-4" /> Proposta
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB CAMPANHA ─── */}
        <TabsContent value="campanha" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {METRICS.map((m) => (
              <motion.div
                key={m.label}
                whileInView={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 10 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-border bg-card">
                  <CardContent className="p-5">
                    <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center mb-3`}>
                      <m.icon className={`w-4.5 h-4.5 ${m.color}`} />
                    </div>
                    <div className="text-3xl font-extrabold mb-0.5">{m.value}</div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{m.sub}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" /> Leads Recentes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {recentLeads.length === 0 ? (
                  <div className="px-6 pb-6 text-sm text-muted-foreground">
                    Nenhum lead registrado ainda. Compartilhe a landing page para começar.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentLeads.map((lead: any) => (
                      <div key={lead.id} className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                        <div>
                          <p className="text-sm font-medium">{lead.companyName}</p>
                          <p className="text-xs text-muted-foreground">{lead.contactName} — {lead.segment}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs border-border">{lead.desiredPlan}</Badge>
                          <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
                            <a href={`https://wa.me/55${lead.whatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-6 py-3 border-t border-border">
                  <Link href="/inquiries" className="text-xs text-primary hover:underline flex items-center gap-1">
                    Ver todos os leads <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Próximas Ações Comerciais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { action: "Abordar 5 novos leads no LinkedIn", due: "Esta semana", status: "pendente" },
                  { action: "Enviar proposta para Pavanelli Tech (renovação)", due: "Esta semana", status: "pendente" },
                  { action: "Postar no LinkedIn sobre lançamento", due: "Hoje", status: "urgente" },
                  { action: "Cadastrar leads do WhatsApp no Inquiries", due: "Hoje", status: "urgente" },
                  { action: "Agendar demo com lead D+7 da sequência", due: "Amanhã", status: "pendente" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${item.status === "urgente" ? "bg-primary" : "bg-muted-foreground/40"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{item.action}</p>
                      <p className="text-xs text-muted-foreground">{item.due}</p>
                    </div>
                    {item.status === "urgente" && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs flex-shrink-0">Urgente</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── TAB TEXTOS PRONTOS ─── */}
        <TabsContent value="textos" className="space-y-8 mt-6">
          {COPY_TEXTS.map((channel) => (
            <div key={channel.channel}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-8 h-8 rounded-lg ${channel.bg} flex items-center justify-center`}>
                  <channel.icon className={`w-4 h-4 ${channel.color}`} />
                </div>
                <h3 className="text-base font-bold">{channel.channel}</h3>
              </div>
              <div className="space-y-4">
                {channel.items.map((item, i) => (
                  <Card key={i} className="border-border bg-card">
                    <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{item.label}</p>
                      </div>
                      <CopyButton text={item.text} />
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed bg-muted/30 rounded-lg p-4 border border-border/50">
                        {item.text}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Separator className="mt-8 opacity-30" />
            </div>
          ))}
        </TabsContent>

        {/* ─── TAB FOLLOW-UP ─── */}
        <TabsContent value="followup" className="mt-6">
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              Sequência de 7 etapas para nutrir e converter leads ao longo de 21 dias. Use em conjunto com os textos prontos da aba anterior.
            </p>
          </div>
          <div className="space-y-3">
            {FOLLOWUP_SEQUENCE.map((step, i) => (
              <motion.div
                key={i}
                whileInView={{ opacity: 1, x: 0 }}
                initial={{ opacity: 0, x: -10 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Card className="border-border bg-card hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                      <div className={`w-10 h-10 rounded-full ${step.cor} flex items-center justify-center text-white font-bold text-xs`}>
                        {step.day}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold">{step.label}</p>
                        <Badge variant="outline" className="text-xs border-border">{step.tipo}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.action}</p>
                    </div>
                    {i < FOLLOWUP_SEQUENCE.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-3 hidden lg:block" />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card className="border-primary/20 bg-primary/5 mt-6">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Star className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold mb-1">Dica de conversão</p>
                  <p className="text-sm text-muted-foreground">
                    Leads que recebem uma demonstração ao vivo convertem em até 3x mais. Priorize sempre marcar uma reunião de 20 minutos antes de enviar a proposta.
                    Use o link da Apresentação Executiva (/apresentacao) para reuniões remotas — os slides são projetados para projetor e videochamada.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB MATERIAIS ─── */}
        <TabsContent value="materiais" className="mt-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MATERIALS.map((mat) => (
              <Card key={mat.label} className="border-border bg-card hover:border-primary/30 transition-all group">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <mat.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold mb-0.5">{mat.label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{mat.desc}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-4 h-8 text-xs border-border hover:border-primary/50 hover:text-primary"
                    asChild
                  >
                    <Link href={mat.href}>
                      Acessar <ExternalLink className="w-3 h-3 ml-1.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border bg-card mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Cases Beta — Prova Social
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              {[
                { tag: "Beta 01", name: "Tavares Engenharia", legal: "Tavares Construções e Engenharia LTDA", segment: "Engenharia & Obras / O&G", status: "Cliente Fechado — Em Onboarding" },
                { tag: "Beta 02", name: "Pavanelli Tech", legal: "Pavanelli Tech LTDA", segment: "TI / Tecnologia / Integração", status: "Cliente Fechado — Ativo" },
              ].map((c) => (
                <div key={c.tag} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/20 text-primary border-primary/30 font-bold text-xs">{c.tag}</Badge>
                    <span className="text-xs text-green-500 font-medium">{c.status}</span>
                  </div>
                  <p className="font-bold text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.legal}</p>
                  <p className="text-xs text-muted-foreground">Segmento: {c.segment}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB PROPOSTA ─── */}
        <TabsContent value="proposta" className="mt-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="border-border">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Template de Proposta Comercial
                  </CardTitle>
                  <CopyButton text={PROPOSAL_TEMPLATE} />
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed bg-muted/30 rounded-lg p-5 border border-border/50 max-h-[520px] overflow-y-auto">
                    {PROPOSAL_TEMPLATE}
                  </pre>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Checkouts por Plano</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "Radar Starter", href: "/checkout/radar-starter", price: "R$ 890/mês" },
                    { label: "Radar Pro", href: "/checkout/radar-pro", price: "R$ 2.490/mês" },
                    { label: "Radar Enterprise", href: "/checkout/radar-enterprise", price: "R$ 5.990/mês" },
                    { label: "Radar IA Managed", href: "/checkout/radar-ia-managed", price: "R$ 12.900/mês" },
                  ].map((plan) => (
                    <Button key={plan.label} variant="outline" size="sm" className="w-full justify-between h-9 border-border text-xs" asChild>
                      <Link href={plan.href}>
                        <span>{plan.label}</span>
                        <span className="text-muted-foreground">{plan.price}</span>
                      </Link>
                    </Button>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Como usar</p>
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                    <li>Copie o template acima</li>
                    <li>Cole em Word ou Google Docs</li>
                    <li>Preencha os campos com [] em amarelo</li>
                    <li>Converta em PDF</li>
                    <li>Envie por WhatsApp ou e-mail</li>
                    <li>Direcione ao checkout do plano</li>
                  </ol>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Contato Comercial
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span>comercial@petronradar.com.br</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MessageSquare className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      <span>WhatsApp configurável via env</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
