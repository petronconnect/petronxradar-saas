import { useState } from "react";
import { Link } from "wouter";
import { InstallButton } from "@/components/pwa/InstallButton";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import {
  AlertTriangle,
  FileSearch,
  Network,
  Radar,
  Newspaper,
  Users,
  Plug,
  Target,
  Database,
  Briefcase,
  MonitorSmartphone,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Mail,
  MessageSquare,
  Send,
  Loader2,
  PartyPopper,
} from "lucide-react";
import { PetronLogo } from "@/components/layout/PetronLogo";
import {
  useCreateInquiry,
  getListInquiriesQueryKey,
} from "@workspace/api-client-react";

const demoFormSchema = z.object({
  companyName: z.string().min(2, "Informe o nome da empresa"),
  contactName: z.string().min(2, "Informe seu nome completo"),
  contactRole: z.string().min(2, "Informe seu cargo"),
  email: z.string().email("E-mail inválido"),
  whatsapp: z.string().min(10, "Informe um WhatsApp válido"),
  segment: z.string().min(1, "Selecione o segmento"),
  desiredPlan: z.string().min(1, "Selecione um plano de interesse"),
});

type DemoFormValues = z.infer<typeof demoFormSchema>;

const TEAM_WHATSAPP = import.meta.env.VITE_TEAM_WHATSAPP ?? "5513998035663";
const TEAM_EMAIL = import.meta.env.VITE_TEAM_EMAIL ?? "comercial@petronradar.com.br";

function buildWhatsAppLink(lead: DemoFormValues): string {
  const text = encodeURIComponent(
    `🎯 *Novo Lead — Petron Radar*\n\n` +
    `*Empresa:* ${lead.companyName}\n` +
    `*Responsável:* ${lead.contactName} (${lead.contactRole})\n` +
    `*E-mail:* ${lead.email}\n` +
    `*WhatsApp:* ${lead.whatsapp}\n` +
    `*Segmento:* ${lead.segment}\n` +
    `*Plano de interesse:* ${lead.desiredPlan}\n\n` +
    `_Solicitação de demonstração registrada via landing page Petron Radar._`
  );
  return `https://wa.me/${TEAM_WHATSAPP}?text=${text}`;
}

function buildEmailLink(lead: DemoFormValues): string {
  const subject = encodeURIComponent(`[Lead Petron Radar] ${lead.companyName} — ${lead.desiredPlan}`);
  const body = encodeURIComponent(
    `Novo lead registrado via landing page Petron Radar\n\n` +
    `Empresa: ${lead.companyName}\n` +
    `Responsável: ${lead.contactName}\n` +
    `Cargo: ${lead.contactRole}\n` +
    `E-mail: ${lead.email}\n` +
    `WhatsApp: ${lead.whatsapp}\n` +
    `Segmento: ${lead.segment}\n` +
    `Plano desejado: ${lead.desiredPlan}\n`
  );
  return `mailto:${TEAM_EMAIL}?subject=${subject}&body=${body}`;
}

function DemoRequestForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submittedLead, setSubmittedLead] = useState<DemoFormValues | null>(null);

  const createInquiry = useCreateInquiry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInquiriesQueryKey() });
      },
    },
  });

  const form = useForm<DemoFormValues>({
    resolver: zodResolver(demoFormSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      contactRole: "",
      email: "",
      whatsapp: "",
      segment: "",
      desiredPlan: "",
    },
  });

  async function onSubmit(values: DemoFormValues) {
    try {
      await createInquiry.mutateAsync({
        data: {
          companyName: values.companyName,
          cnpj: "A confirmar",
          contactName: values.contactName,
          contactRole: values.contactRole,
          email: values.email,
          whatsapp: values.whatsapp,
          segment: values.segment,
          servicesOffered: "A confirmar",
          hasPetrobrasRegistration: false,
          interestedInBidding: true,
          operationalVolume: "A confirmar",
          regions: "A confirmar",
          desiredPlan: values.desiredPlan,
          allowContact: true,
          notes: "Lead gerado via formulário de demonstração na landing page.",
        },
      });
      trackEvent("lead_submitted", {
        segment: values.segment,
        plan: values.desiredPlan || "unspecified",
        location: "landing_page",
      });
      setSubmittedLead(values);
      toast({
        title: "Solicitação registrada",
        description: "Nossa equipe entrará em contato em até 1 hora útil.",
      });
    } catch {
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente ou entre em contato pelo WhatsApp.",
        variant: "destructive",
      });
    }
  }

  if (submittedLead) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="bg-card border border-primary/30 rounded-2xl p-10 text-center shadow-lg shadow-primary/5"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <PartyPopper className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h3 className="text-2xl font-bold mb-2">Solicitação Recebida!</h3>
        <p className="text-muted-foreground mb-2">
          Obrigado, <span className="font-semibold text-foreground">{submittedLead.contactName}</span>. Seu interesse foi registrado no sistema Petron Radar.
        </p>
        <p className="text-muted-foreground text-sm mb-8">
          Nossa equipe comercial entrará em contato em até <strong>1 hora útil</strong> pelo WhatsApp ou e-mail informado.
        </p>

        <Separator className="mb-8 opacity-30" />

        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Notificar equipe comercial agora
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white font-bold h-12 px-8 shadow-md shadow-green-900/20"
            onClick={() => window.open(buildWhatsAppLink(submittedLead), "_blank")}
            data-testid="btn-notify-whatsapp"
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            Notificar pelo WhatsApp
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 px-8 border-border hover:bg-accent"
            onClick={() => window.open(buildEmailLink(submittedLead), "_blank")}
            data-testid="btn-notify-email"
          >
            <Mail className="w-5 h-5 mr-2" />
            Notificar por E-mail
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Os botões acima abrem o WhatsApp/e-mail com os dados do lead pré-preenchidos para envio imediato à equipe.
        </p>

        <button
          className="mt-4 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          onClick={() => { setSubmittedLead(null); form.reset(); }}
          data-testid="btn-new-demo-request"
        >
          Enviar nova solicitação
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" data-testid="form-demo-request">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="demo-company" className="text-sm font-medium">
            Empresa <span className="text-primary">*</span>
          </Label>
          <Input
            id="demo-company"
            placeholder="Nome da empresa"
            className="bg-muted/30 border-border focus:border-primary h-11"
            data-testid="input-demo-company"
            {...form.register("companyName")}
          />
          {form.formState.errors.companyName && (
            <p className="text-xs text-red-500">{form.formState.errors.companyName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="demo-contact" className="text-sm font-medium">
            Nome Completo <span className="text-primary">*</span>
          </Label>
          <Input
            id="demo-contact"
            placeholder="Seu nome"
            className="bg-muted/30 border-border focus:border-primary h-11"
            data-testid="input-demo-contact"
            {...form.register("contactName")}
          />
          {form.formState.errors.contactName && (
            <p className="text-xs text-red-500">{form.formState.errors.contactName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="demo-role" className="text-sm font-medium">
            Cargo / Função <span className="text-primary">*</span>
          </Label>
          <Input
            id="demo-role"
            placeholder="Ex: Diretor Comercial"
            className="bg-muted/30 border-border focus:border-primary h-11"
            data-testid="input-demo-role"
            {...form.register("contactRole")}
          />
          {form.formState.errors.contactRole && (
            <p className="text-xs text-red-500">{form.formState.errors.contactRole.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="demo-email" className="text-sm font-medium">
            E-mail Corporativo <span className="text-primary">*</span>
          </Label>
          <Input
            id="demo-email"
            type="email"
            placeholder="seu@empresa.com.br"
            className="bg-muted/30 border-border focus:border-primary h-11"
            data-testid="input-demo-email"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="demo-whatsapp" className="text-sm font-medium">
            WhatsApp <span className="text-primary">*</span>
          </Label>
          <Input
            id="demo-whatsapp"
            placeholder="+55 11 99999-9999"
            className="bg-muted/30 border-border focus:border-primary h-11"
            data-testid="input-demo-whatsapp"
            {...form.register("whatsapp")}
          />
          {form.formState.errors.whatsapp && (
            <p className="text-xs text-red-500">{form.formState.errors.whatsapp.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">
            Segmento <span className="text-primary">*</span>
          </Label>
          <Select
            onValueChange={(v) => form.setValue("segment", v, { shouldValidate: true })}
            value={form.watch("segment")}
          >
            <SelectTrigger className="bg-muted/30 border-border h-11" data-testid="select-demo-segment">
              <SelectValue placeholder="Selecione o segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Upstream">Upstream</SelectItem>
              <SelectItem value="Midstream">Midstream</SelectItem>
              <SelectItem value="Downstream">Downstream</SelectItem>
              <SelectItem value="Petroquímica">Petroquímica</SelectItem>
              <SelectItem value="Engenharia & Obras / O&G">Engenharia & Obras / O&G</SelectItem>
              <SelectItem value="TI / Tecnologia / Integração / Serviços Digitais">TI / Tecnologia / Serviços Digitais</SelectItem>
              <SelectItem value="Serviços O&G">Serviços O&G</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.segment && (
            <p className="text-xs text-red-500">{form.formState.errors.segment.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          Plano de Interesse <span className="text-primary">*</span>
        </Label>
        <Select
          onValueChange={(v) => form.setValue("desiredPlan", v, { shouldValidate: true })}
          value={form.watch("desiredPlan")}
        >
          <SelectTrigger className="bg-muted/30 border-border h-11" data-testid="select-demo-plan">
            <SelectValue placeholder="Qual plano te interessa?" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="radar-lancamento">⭐ Condição Especial de Lançamento — R$ 500/1º mês</SelectItem>
            <SelectItem value="radar-starter">Radar Starter — R$ 890/mês</SelectItem>
            <SelectItem value="radar-pro">Radar Pro — R$ 2.490/mês</SelectItem>
            <SelectItem value="radar-enterprise">Radar Enterprise — R$ 5.990/mês</SelectItem>
            <SelectItem value="radar-ia-managed">Radar IA Managed — R$ 12.900/mês</SelectItem>
            <SelectItem value="nao-sei">Quero conhecer as opções</SelectItem>
          </SelectContent>
        </Select>
        {form.formState.errors.desiredPlan && (
          <p className="text-xs text-red-500">{form.formState.errors.desiredPlan.message}</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Ao enviar, você autoriza a equipe Petron Radar a entrar em contato pelos dados informados. Sem spam.
      </p>

      <Button
        type="submit"
        size="lg"
        className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-md shadow-primary/20 text-base"
        disabled={createInquiry.isPending}
        data-testid="btn-submit-demo"
      >
        {createInquiry.isPending ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Enviando...</>
        ) : (
          <><Send className="w-5 h-5 mr-2" /> Solicitar Demonstração Gratuita</>
        )}
      </Button>
    </form>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <PetronLogo />
            <span className="hidden font-bold tracking-tight sm:inline-block">
              PETRON RADAR
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/apresentacao" className="text-sm font-medium text-muted-foreground hover:text-foreground hidden sm:block">
              Apresentação Executiva
            </Link>
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground hidden sm:block">
              Acesso Cliente
            </Link>
            <InstallButton variant="outline" size="sm" className="hidden sm:flex border-border" />
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" size="sm" asChild>
              <a href="#planos">Conhecer Planos</a>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* 1. Hero Section */}
        <section className="relative overflow-hidden py-24 md:py-32 lg:py-40 flex items-center justify-center border-b border-border/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
          <div className="container relative z-10 mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex justify-center mb-8"
            >
              <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1.5 text-sm font-medium">
                2 Empresas Beta em Operação
              </Badge>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex justify-center mb-8"
            >
              <PetronLogo iconOnly className="w-20 h-20" />
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70"
            >
              Inteligência de Mercado para Petróleo, Óleo & Gás
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed sm:text-xl"
            >
              Radar em tempo real de oportunidades, licitações e movimentos estratégicos no setor de O&G. Para empresas que precisam estar sempre à frente.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20" asChild>
                <a href="#demo">Solicitar Demonstração <ArrowRight className="ml-2 w-4 h-4" /></a>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base border-border hover:bg-accent" asChild>
                <Link href="#planos">Conhecer Planos</Link>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* 2. O Problema que Resolvemos */}
        <section className="py-24 bg-muted/30 border-b border-border/50">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">O mercado não espera. Sua inteligência também não deveria.</h2>
              <p className="text-muted-foreground text-lg">Os desafios que travam o crescimento de fornecedores no setor de Óleo e Gás.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <motion.div 
                whileInView={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 30 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="bg-background rounded-2xl p-8 border border-border shadow-sm hover:border-primary/30 transition-colors"
              >
                <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-6 text-red-500">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Oportunidades Perdidas</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Falta de informação oportuna faz com que sua empresa descubra licitações apenas quando já é tarde demais para preparar uma proposta competitiva.
                </p>
              </motion.div>

              <motion.div 
                whileInView={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 30 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="bg-background rounded-2xl p-8 border border-border shadow-sm hover:border-primary/30 transition-colors"
              >
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6 text-orange-500">
                  <FileSearch className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Licitações Complexas</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Processos de licitação e concorrência executados às cegas, sem inteligência competitiva sobre o mercado, valores praticados ou concorrentes.
                </p>
              </motion.div>

              <motion.div 
                whileInView={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 30 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-background rounded-2xl p-8 border border-border shadow-sm hover:border-primary/30 transition-colors"
              >
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 text-blue-500">
                  <Network className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Gestão Fragmentada</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Relacionamentos com clientes do setor de O&G perdidos em planilhas e e-mails, dificultando o acompanhamento de contas estratégicas.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 3. Como o Petron Radar Funciona */}
        <section className="py-24 border-b border-border/50">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Como o Petron Radar Funciona</h2>
              <p className="text-muted-foreground text-lg">Um ciclo contínuo de inteligência, análise e gestão para sua empresa.</p>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              {[
                { num: "01", title: "Radar de Oportunidades", desc: "Monitoramento contínuo e em tempo real do mercado.", icon: Radar },
                { num: "02", title: "Boletins de Inteligência", desc: "Análises semanais curadas do setor por especialistas.", icon: Newspaper },
                { num: "03", title: "Gestão de Clientes", desc: "CRM especializado em vendas B2B para o setor O&G.", icon: Users },
                { num: "04", title: "Integração Petroconnect", desc: "Conexão direta com cadastro do fornecedor.", icon: Plug }
              ].map((step, i) => (
                <motion.div 
                  key={step.num}
                  whileInView={{ opacity: 1, scale: 1 }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="relative group"
                >
                  <div className="bg-muted/30 border border-border rounded-2xl p-6 h-full transition-all group-hover:border-primary/50 group-hover:bg-muted/50">
                    <div className="text-5xl font-extrabold text-muted mb-4 opacity-30 group-hover:opacity-10 transition-opacity">{step.num}</div>
                    <step.icon className="w-8 h-8 text-primary mb-4" />
                    <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                  </div>
                  {i < 3 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-border z-10" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Diferenciais da Plataforma */}
        <section className="py-24 bg-muted/30 border-b border-border/50">
          <div className="container mx-auto px-4">
            <div className="mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Diferenciais da Plataforma</h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: "Foco 100% em O&G", desc: "Criado especificamente para o ecossistema de Petróleo e Gás, sem ruídos de outros setores.", icon: Target },
                { title: "Dados Reais de Mercado", desc: "Inteligência baseada em movimentações reais, licitações abertas e dados contratuais.", icon: Database },
                { title: "Equipe Especializada", desc: "Curadoria de dados feita por analistas com décadas de experiência no setor de energia.", icon: Briefcase },
                { title: "Integração Petroconnect", desc: "Nativa e direta para facilitar a gestão de cadastros e documentos perante grandes players.", icon: Plug },
                { title: "Interface Premium", desc: "Design SaaS moderno, rápido e focado em produtividade para o executivo de vendas.", icon: MonitorSmartphone },
                { title: "Planos Sob Medida", desc: "Desde acesso a boletins até gestão completa com Inteligência Artificial.", icon: CreditCard }
              ].map((diff, i) => (
                <motion.div 
                  key={i}
                  whileInView={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 20 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="flex gap-4 p-4"
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <diff.icon className="w-5 h-5" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-base font-bold mb-1">{diff.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{diff.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Prova Beta — Empresas em Operação */}
        <section className="py-24 border-b border-border/50 bg-background relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Empresas em Operação Beta</h2>
              <p className="text-muted-foreground text-lg">Organizações reais que já utilizam o Petron Radar para escalar seus negócios.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Beta 01 */}
              <motion.div 
                whileInView={{ opacity: 1, x: 0 }}
                initial={{ opacity: 0, x: -30 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <Card className="border-border bg-card/50 backdrop-blur-sm h-full hover:border-primary/30 transition-colors">
                  <CardContent className="p-8">
                    <div className="flex justify-between items-start mb-6">
                      <Badge className="bg-primary/20 text-primary border-primary/30 font-bold">Beta 01</Badge>
                      <ShieldCheck className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold mb-1">Tavares Engenharia</h3>
                    <p className="text-sm text-muted-foreground mb-6">Tavares Construções e Engenharia LTDA</p>
                    
                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Segmento</span>
                        <span className="font-medium">Engenharia & Obras / O&G</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Status</span>
                        <span className="text-green-500 font-medium">Cliente Fechado — Em Onboarding</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Cadastro Petrobras</span>
                        <span className="text-primary font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ativo
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-8 bg-muted rounded-lg p-4 border border-border/50">
                      <p className="text-sm italic font-medium leading-relaxed">
                        "Acesso antecipado a oportunidades de Engenharia em O&G."
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Beta 02 */}
              <motion.div 
                whileInView={{ opacity: 1, x: 0 }}
                initial={{ opacity: 0, x: 30 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Card className="border-border bg-card/50 backdrop-blur-sm h-full hover:border-primary/30 transition-colors">
                  <CardContent className="p-8">
                    <div className="flex justify-between items-start mb-6">
                      <Badge className="bg-primary/20 text-primary border-primary/30 font-bold">Beta 02</Badge>
                      <ShieldCheck className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold mb-1">Pavanelli Tech</h3>
                    <p className="text-sm text-muted-foreground mb-6">Pavanelli Tech LTDA (CNPJ 23.673.921/0001-10)</p>
                    
                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Segmento</span>
                        <span className="font-medium">TI / Tecnologia / Integração</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Status</span>
                        <span className="text-green-500 font-medium">Cliente Fechado</span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Cadastro Petrobras</span>
                        <span className="text-primary font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ativo
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-border/50 pb-2">
                        <span className="text-muted-foreground">Capital Social</span>
                        <span className="font-medium">R$ 4.000.000</span>
                      </div>
                    </div>
                    
                    <div className="mt-8 bg-muted rounded-lg p-4 border border-border/50">
                      <p className="text-sm italic font-medium leading-relaxed">
                        Integração completa de portfólio de TI para os maiores players da indústria.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 6. Formulário de Demonstração */}
        <section id="demo" className="py-24 border-b border-border/50 bg-background relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-primary/8 via-background to-background pointer-events-none" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-2xl mx-auto">
              <motion.div
                whileInView={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 24 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-center mb-10"
              >
                <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1.5 text-sm font-medium mb-4">
                  Demonstração Gratuita
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Solicite uma Demonstração
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Preencha o formulário e nossa equipe comercial entrará em contato em até{" "}
                  <strong className="text-foreground">1 hora útil</strong> — por WhatsApp ou e-mail.
                </p>
              </motion.div>

              <motion.div
                whileInView={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 24 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="bg-card border border-border rounded-2xl p-8 shadow-lg"
              >
                <DemoRequestForm />
              </motion.div>
            </div>
          </div>
        </section>

        {/* 7. Planos Resumo */}
        <section id="planos" className="scroll-mt-20 py-24 bg-muted/30 border-b border-border/50">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Escolha seu Radar</h2>
                <p className="text-muted-foreground text-lg">Soluções modulares para cada estágio do seu negócio em O&G.</p>
              </div>
            </div>

            {/* Plano Founder — destaque máximo */}
            <div className="mb-6 rounded-2xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/10 via-primary/10 to-amber-500/10 p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-primary to-amber-400" />
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      ⭐ Founder Access
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-primary/20 text-primary border border-primary/30 text-xs font-bold px-3 py-1 rounded-full">
                      🚀 Lançamento Oficial
                    </span>
                    <span className="text-xs text-muted-foreground">Vagas limitadas</span>
                  </div>
                  <h3 className="text-xl font-extrabold mb-1">Condição Especial de Lançamento</h3>
                  <p className="text-sm text-muted-foreground mb-3 max-w-xl">
                    Acesso completo ao Radar Starter pelos primeiros 30 dias. Exclusivo para as primeiras empresas fundadoras da plataforma.
                    Após o período, migração automática para R$ 890/mês.
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {["Boletins semanais O&G", "Radar de oportunidades", "Acesso completo", "Suporte WhatsApp", "Onboarding guiado"].map(f => (
                      <span key={f} className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" />{f}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-center md:items-end gap-3 flex-shrink-0">
                  <div className="text-center md:text-right">
                    <div className="flex items-baseline gap-1 justify-center md:justify-end">
                      <span className="text-4xl font-extrabold text-amber-300">R$ 500</span>
                      <span className="text-sm text-muted-foreground">/1º mês</span>
                    </div>
                    <p className="text-xs text-muted-foreground">depois R$ 890/mês</p>
                  </div>
                  <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold px-8 shadow-lg shadow-amber-900/30 whitespace-nowrap" asChild>
                    <Link href="/checkout/radar-lancamento">Garantir minha vaga →</Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { name: "Radar Starter", price: "R$ 890", desc: "Boletins de inteligência e radar básico de oportunidades O&G.", highlight: false, href: "/checkout/radar-starter" },
                { name: "Radar Pro", price: "R$ 2.490", desc: "Radar completo de licitações Petrobras, CRM e alertas em tempo real.", highlight: true, href: "/checkout/radar-pro" },
                { name: "Radar Enterprise", price: "R$ 5.990", desc: "Integração Petroconnect, usuários ilimitados e gerente dedicado.", highlight: false, href: "/checkout/radar-enterprise" },
              ].map((plan) => (
                <Card key={plan.name} className={`relative overflow-hidden ${plan.highlight ? 'border-primary shadow-md shadow-primary/10 bg-primary/5' : 'border-border bg-card'}`}>
                  {plan.highlight && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-bl-lg">
                      Mais popular
                    </div>
                  )}
                  <CardContent className="p-6">
                    <h3 className="font-bold text-lg mb-2">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-2xl font-extrabold">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-6">{plan.desc}</p>
                    <Button variant={plan.highlight ? "default" : "outline"} className={`w-full ${plan.highlight ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`} asChild>
                      <Link href={plan.href}>Contratar</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Próximos Passos / CTA Final */}
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5" />
          <div className="container relative z-10 mx-auto px-4 text-center">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              Pronto para ter inteligência de mercado no seu setor?
            </h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Junte-se às empresas que já estão fechando os melhores negócios em Óleo e Gás antes mesmo da concorrência saber que eles existem.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-lg shadow-primary/25" asChild>
                <a href="#planos">Contratar Agora</a>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base border-border hover:bg-accent bg-background" asChild>
                <a href="#demo">Solicitar Demonstração</a>
              </Button>
            </div>
            
            <div className="mt-10 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Atendimento via WhatsApp
              </div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" /> Atendimento via E-mail
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">Resposta em até 1 hora útil em horário comercial.</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-background py-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 opacity-50">
            <PetronLogo iconOnly className="w-6 h-6 grayscale" />
            <span className="font-bold text-sm tracking-tight">PETRON RADAR</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/termos" className="text-muted-foreground hover:text-foreground">Termos de Uso</Link>
            <Link href="/privacidade" className="text-muted-foreground hover:text-foreground">Política de Privacidade</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; 2026 Petron Radar Premium. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
