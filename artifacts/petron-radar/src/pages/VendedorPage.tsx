import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Globe,
  MonitorPlay,
  CreditCard,
  Package,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Target,
  ArrowRight,
  Users,
  TrendingUp,
  Zap,
  Shield,
  Star,
} from "lucide-react";

const SCRIPT_STEPS = [
  {
    num: "01",
    title: "Abertura e Rapport",
    duration: "3 min",
    color: "bg-blue-500",
    objetivo: "Criar conexão e estabelecer credibilidade.",
    roteiro: [
      "Cumprimentar pelo nome, confirmar disponibilidade dos 20 minutos.",
      "Breve apresentação: 'Somos o Petron Radar, uma plataforma de inteligência de mercado criada exclusivamente para o setor de Petróleo, Óleo e Gás.'",
      "Validação: 'Antes de começar, me conta — a [empresa] atua hoje principalmente em qual frente do setor? Licitações, prestação de serviços, fornecimento?'",
      "Ouvir e anotar — isso vai guiar a apresentação.",
    ],
    dica: "Adapte o foco da apresentação conforme o que o prospect responder nesse momento. Não apresente tudo — mostre o que é relevante para ele.",
  },
  {
    num: "02",
    title: "Diagnóstico da Dor",
    duration: "5 min",
    color: "bg-amber-500",
    objetivo: "Identificar onde a empresa está perdendo dinheiro ou oportunidades.",
    roteiro: [
      "'Como vocês ficam sabendo de novas oportunidades de licitação ou contratos no setor hoje?'",
      "'Vocês já perderam alguma licitação por não saberem que ela existia ou por chegar tarde?'",
      "'Como é a gestão dos relacionamentos com clientes grandes como Petrobras hoje — existe uma ferramenta ou é tudo em planilha?'",
      "'Vocês já estão cadastrados no Petrobras Fornecedor / Petroconnect? Está atualizado?'",
      "Resumir o que foi dito: 'Então se eu entendi, o principal desafio é [X], certo?'",
    ],
    dica: "Não interrompa. Quanto mais o prospect falar, mais munição você tem para apresentar o produto como solução direta dos problemas dele.",
  },
  {
    num: "03",
    title: "Apresentação da Plataforma",
    duration: "8 min",
    color: "bg-purple-500",
    objetivo: "Mostrar o produto conectado às dores identificadas.",
    roteiro: [
      "Abrir a Apresentação Executiva (link abaixo) e compartilhar tela.",
      "Slide de problema: validar com as dores que ele mencionou.",
      "Slide de solução: apresentar os 4 módulos — Radar, Boletins, CRM, Petroconnect.",
      "Mostrar o dashboard ao vivo se possível: 'Isso aqui é o que seus gestores veriam todo dia.'",
      "Cases beta: 'A Tavares Engenharia e a Pavanelli Tech já estão operando. Posso mostrar o que eles disseram.'",
      "Perguntar: 'O que fez mais sentido para vocês até aqui?'",
    ],
    dica: "Não leia os slides. Fale com propriedade. Use os cases para criar credibilidade — empresas reais com CNPJ e operação ativa.",
  },
  {
    num: "04",
    title: "Apresentação da Proposta",
    duration: "3 min",
    color: "bg-primary",
    objetivo: "Apresentar o plano ideal e o investimento de forma direta.",
    roteiro: [
      "Com base no que você ouviu no diagnóstico, recomendar um plano específico.",
      "'Para o perfil da [empresa], o plano que faz mais sentido é o [X] — que inclui [features relevantes].'",
      "Apresentar o preço diretamente: 'O investimento é de R$ [X]/mês. Parcelamos em 12x e o acesso é liberado em até 1 hora útil.'",
      "Enviar o link do checkout ou proposta durante a chamada.",
      "Não desculpar o preço. Ancorá-lo no valor: 'Uma licitação perdida custa muito mais que isso por mês.'",
    ],
    dica: "Nunca peça 'o que você acha do preço?' Apresente, deixe processar e pergunte: 'Faz sentido para vocês?'",
  },
  {
    num: "05",
    title: "Fechamento",
    duration: "3 min",
    color: "bg-green-500",
    objetivo: "Obter compromisso — contrato, pagamento ou próxima etapa clara.",
    roteiro: [
      "'Você tem alguma dúvida antes de avançarmos?'",
      "Tratar objeções com calma (ver painel de objeções).",
      "Fechamento direto: 'Posso registrar seu pedido agora e você já recebe o acesso hoje?'",
      "Se não fechar agora: 'Quando você consegue dar uma resposta — amanhã ou depois de amanhã?'",
      "Combinar data e horário específicos para o follow-up. Nunca sair sem uma próxima etapa definida.",
    ],
    dica: "Silêncio após a proposta de fechamento é normal. Não preencha com desconto ou recuo. Aguarde a resposta.",
  },
];

const OBJECTIONS = [
  {
    objection: "Está caro / não tenho orçamento agora.",
    response: "Entendo. Mas me ajude a entender — quanto a empresa perde por mês em oportunidades que não chegam no tempo certo? Uma licitação perdida vale muito mais do que o plano. Além disso, temos planos a partir de R$ 890/mês. Posso apresentar o Starter que já resolve o problema de radar?",
    tipo: "Preço",
    cor: "text-red-400",
  },
  {
    objection: "Preciso ver com meu sócio / diretor antes.",
    response: "Claro, faz todo sentido. Posso preparar um resumo executivo em PDF para você apresentar? E qual a melhor forma de incluir ele em uma conversa conosco — uma videochamada de 15 minutos nessa semana?",
    tipo: "Decisor",
    cor: "text-amber-400",
  },
  {
    objection: "Já temos uma ferramenta / já usamos planilha.",
    response: "Que ótimo que já há um processo. A diferença é que o Petron Radar é construído 100% para O&G — não é uma ferramenta genérica. O radar de licitações Petrobras, os boletins de inteligência semanais e a integração Petroconnect não existem em nenhuma outra solução do mercado. Posso mostrar um comparativo rápido?",
    tipo: "Concorrência",
    cor: "text-blue-400",
  },
  {
    objection: "Não sei se o mercado está aquecido o suficiente.",
    response: "Na verdade, o melhor momento para ter inteligência de mercado é exatamente quando o mercado está em movimento — e o setor de O&G está em expansão no Brasil, especialmente no pré-sal. Quem tem informação primeiro fecha os melhores contratos. O Petron Radar é exatamente para não perder essa janela.",
    tipo: "Mercado",
    cor: "text-purple-400",
  },
  {
    objection: "Quero um período de teste primeiro.",
    response: "Entendo a preocupação. Não oferecemos trial gratuito porque o valor da plataforma está na curadoria humana e no acesso real a dados. O que eu posso fazer é garantir que os primeiros 30 dias sejam dedicados ao onboarding com suporte total — e se você não ver valor, conversamos sobre o que não funcionou. Mas até hoje nossos clientes beta estão satisfeitos.",
    tipo: "Teste",
    cor: "text-green-400",
  },
  {
    objection: "Minha empresa é pequena, não sei se serve para mim.",
    response: "O Petron Radar foi criado pensando em fornecedores que querem crescer no setor — especialmente os de médio porte que competem com players maiores. É exatamente por ter acesso à mesma inteligência que as grandes que você consegue disputar em igualdade. O plano Starter é perfeito para esse perfil.",
    tipo: "Tamanho",
    cor: "text-sky-400",
  },
  {
    objection: "Posso pagar apenas se fechar um contrato com Petrobras?",
    response: "Entendo a lógica, mas funciona ao contrário — você precisa do Petron Radar para aumentar sua chance de fechar esse contrato. A plataforma te ajuda a identificar oportunidades, preparar propostas e manter o cadastro Petroconnect atualizado. É o investimento que viabiliza o contrato.",
    tipo: "Condição",
    cor: "text-orange-400",
  },
];

const QUICK_LINKS = [
  { label: "Apresentação Executiva", href: "/apresentacao", icon: MonitorPlay, desc: "7 slides — abrir para compartilhar" },
  { label: "Landing Comercial", href: "/landing", icon: Globe, desc: "Enviar link ao prospect" },
  { label: "Planos & Preços", href: "/planos", icon: CreditCard, desc: "Tabela completa de planos" },
  { label: "⭐ Checkout Founder", href: "/checkout/radar-lancamento", icon: Package, desc: "R$ 500/1º mês → R$ 890/mês" },
  { label: "Checkout Starter", href: "/checkout/radar-starter", icon: Package, desc: "R$ 890/mês" },
  { label: "Checkout Pro", href: "/checkout/radar-pro", icon: Package, desc: "R$ 2.490/mês" },
  { label: "Checkout Enterprise", href: "/checkout/radar-enterprise", icon: Package, desc: "R$ 5.990/mês" },
  { label: "Kit Comercial", href: "/kit-comercial", icon: Briefcase, desc: "Textos e materiais" },
];

export default function VendedorPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [activeObj, setActiveObj] = useState<number | null>(null);
  const [mode, setMode] = useState<"roteiro" | "objecoes">("roteiro");

  const step = SCRIPT_STEPS[activeStep];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-primary" />
            Modo Vendedor
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Roteiro de apresentação passo-a-passo, objeções e atalhos para fechar o contrato.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "roteiro" ? "default" : "outline"}
            className={mode === "roteiro" ? "bg-primary text-primary-foreground" : "border-border"}
            onClick={() => setMode("roteiro")}
          >
            Roteiro
          </Button>
          <Button
            size="sm"
            variant={mode === "objecoes" ? "default" : "outline"}
            className={mode === "objecoes" ? "bg-primary text-primary-foreground" : "border-border"}
            onClick={() => setMode("objecoes")}
          >
            Objeções
          </Button>
        </div>
      </div>

      {mode === "roteiro" && (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Step navigator */}
          <div className="space-y-2">
            {SCRIPT_STEPS.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`w-full text-left rounded-lg px-4 py-3 border transition-all ${
                  activeStep === i
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-card hover:border-primary/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full ${s.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {s.num}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.duration}</p>
                  </div>
                </div>
              </button>
            ))}

            <Separator className="opacity-30 my-2" />

            <div className="text-xs text-muted-foreground text-center py-1">
              Total: ~22 min
            </div>
          </div>

          {/* Step content */}
          <div className="lg:col-span-3 space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="border-border">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center text-white font-extrabold text-lg flex-shrink-0`}>
                          {step.num}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{step.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs border-border">{step.duration}</Badge>
                            <span className="text-xs text-muted-foreground">{step.objetivo}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Roteiro</p>
                      <div className="space-y-3">
                        {step.roteiro.map((item, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs text-muted-foreground font-bold">{i + 1}</span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <Star className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-primary mb-1">Dica de vendas</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{step.dica}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border"
                        onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                        disabled={activeStep === 0}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {activeStep + 1} / {SCRIPT_STEPS.length}
                      </span>
                      <Button
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => setActiveStep(Math.min(SCRIPT_STEPS.length - 1, activeStep + 1))}
                        disabled={activeStep === SCRIPT_STEPS.length - 1}
                      >
                        Próximo <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>

            {/* Quick links */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" /> Atalhos Rápidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {QUICK_LINKS.map((link) => (
                    <Button
                      key={link.label}
                      variant="outline"
                      size="sm"
                      className="h-auto py-2.5 px-3 flex-col items-start gap-0.5 border-border hover:border-primary/40 hover:text-primary text-left"
                      asChild
                    >
                      <Link href={link.href}>
                        <span className="flex items-center gap-1.5 text-xs font-semibold w-full">
                          <link.icon className="w-3.5 h-3.5 flex-shrink-0" />
                          {link.label}
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">{link.desc}</span>
                      </Link>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {mode === "objecoes" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione uma objeção para ver a resposta comercial recomendada.
            </p>
            {OBJECTIONS.map((obj, i) => (
              <button
                key={i}
                onClick={() => setActiveObj(activeObj === i ? null : i)}
                className={`w-full text-left rounded-lg px-4 py-3.5 border transition-all ${
                  activeObj === i
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${obj.cor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className={`text-xs border-border ${obj.cor}`}>{obj.tipo}</Badge>
                    </div>
                    <p className="text-sm font-medium leading-relaxed">"{obj.objection}"</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5 transition-transform ${activeObj === i ? "rotate-90" : ""}`} />
                </div>

                <AnimatePresence>
                  {activeObj === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-muted-foreground leading-relaxed">{obj.response}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Target className="w-4 h-4" /> Princípios de Fechamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: Shield, tip: "Nunca peça desculpas pelo preço. Ancore no valor gerado — uma licitação ou contrato vale 10x o plano." },
                  { icon: Users, tip: "Sempre termine com uma próxima etapa definida — data, horário e responsável. Nunca 'vou pensar e te aviso'." },
                  { icon: TrendingUp, tip: "Use os cases beta como prova social concreta. Tavares e Pavanelli são empresas reais com CNPJ ativo." },
                  { icon: MessageSquare, tip: "Após enviar proposta pelo WhatsApp, aguarde 24h antes do follow-up. Não seja insistente — seja consultivo." },
                  { icon: Star, tip: "O plano recomendado deve ser apresentado como decisão sua, não do cliente: 'Para o seu perfil, o Pro é o ideal.'" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.tip}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Atalhos Rápidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {QUICK_LINKS.slice(0, 5).map((link) => (
                    <Button
                      key={link.label}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start border-border hover:border-primary/40 hover:text-primary h-9"
                      asChild
                    >
                      <Link href={link.href}>
                        <link.icon className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                        <span className="text-xs">{link.label}</span>
                        <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground/50" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
