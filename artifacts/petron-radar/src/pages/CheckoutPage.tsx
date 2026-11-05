import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { safeDestination, googleStartUrl } from "@/lib/safeDestination";
import { PetronLogo } from "@/components/layout/PetronLogo";
import { trackEvent } from "@/lib/analytics";
import {
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Loader2,
  CreditCard,
  Smartphone,
  FileText,
  MessageSquare,
  Mail,
  ChevronLeft,
  Star,
  Zap,
  Lock,
  Building2,
  Copy,
  CheckCheck,
  QrCode,
  RefreshCw,
} from "lucide-react";

export const PLANS: Record<string, {
  name: string;
  price: string;
  priceNum: number;
  period: string;
  badge?: string;
  founderBadge?: string;
  promoNote?: string;
  description: string;
  features: string[];
  highlight: boolean;
  isPromo?: boolean;
}> = {
  "radar-lancamento": {
    name: "Condição Especial de Lançamento",
    price: "R$ 500",
    priceNum: 500,
    period: "/mês (1º mês)",
    badge: "Founder Access",
    founderBadge: "Empresas Fundadoras",
    promoNote: "Após 30 dias → R$ 890/mês (Starter). Vagas limitadas.",
    description: "Acesso completo ao Radar Starter pelo primeiro mês. Condição exclusiva de lançamento para as primeiras empresas fundadoras.",
    features: [
      "Tudo do Radar Starter incluso",
      "Boletins de inteligência semanais",
      "Radar de oportunidades O&G",
      "Acesso web completo",
      "Suporte prioritário WhatsApp",
      "Até 2 usuários",
      "Onboarding guiado incluso",
      "Migração automática para Starter após 30 dias",
    ],
    highlight: true,
    isPromo: true,
  },
  "radar-starter": {
    name: "Radar Starter",
    price: "R$ 890",
    priceNum: 890,
    period: "/mês",
    description: "Acesso a boletins de inteligência e radar básico de oportunidades.",
    features: [
      "Boletins de inteligência semanais",
      "Radar de oportunidades (básico)",
      "Acesso web completo",
      "Suporte via e-mail",
      "Até 2 usuários",
    ],
    highlight: false,
  },
  "radar-pro": {
    name: "Radar Pro",
    price: "R$ 2.490",
    priceNum: 2490,
    period: "/mês",
    badge: "Mais popular",
    description: "Radar completo de licitações, monitoramento e CRM integrado.",
    features: [
      "Tudo do Starter",
      "Radar completo de licitações Petrobras",
      "CRM especializado O&G",
      "Alertas em tempo real",
      "Até 5 usuários",
      "Suporte prioritário WhatsApp",
    ],
    highlight: true,
  },
  "radar-enterprise": {
    name: "Radar Enterprise",
    price: "R$ 5.990",
    priceNum: 5990,
    period: "/mês",
    description: "Solução completa com integração Petroconnect e inteligência avançada.",
    features: [
      "Tudo do Pro",
      "Integração Petroconnect nativa",
      "Análise de concorrentes",
      "Usuários ilimitados",
      "Gerente de conta dedicado",
      "Onboarding guiado (5 sessões)",
      "Relatórios personalizados",
    ],
    highlight: false,
  },
  "radar-ia-managed": {
    name: "Radar IA Managed",
    price: "R$ 12.900",
    priceNum: 12900,
    period: "/mês",
    description: "Inteligência preditiva com IA gerenciada e equipe dedicada.",
    features: [
      "Tudo do Enterprise",
      "Inteligência Artificial preditiva",
      "Equipe analítica dedicada",
      "Alertas personalizados com IA",
      "Integração API customizada",
      "SLA garantido 99,9%",
      "Relatórios executivos semanais",
    ],
    highlight: false,
  },
};

const PAYMENT_METHODS = [
  { id: "pix", label: "Pix", icon: Zap, desc: "QR Code ou copia e cola" },
  { id: "boleto", label: "Boleto Bancário", icon: FileText, desc: "Vencimento em 3 dias úteis" },
  { id: "cartao", label: "Cartão de Crédito", icon: CreditCard, desc: "Parcelamento disponível" },
];

const STATUS_STEPS = [
  { id: "pending", label: "Aguardando Pagamento", icon: Clock, color: "text-amber-400" },
  { id: "paid", label: "Pagamento Confirmado", icon: CheckCircle2, color: "text-green-400" },
  { id: "active", label: "Acesso Liberado", icon: ShieldCheck, color: "text-primary" },
];

const PIX_STATIC: boolean = false;
const PIX_KEY = "e9b1e9f6-8ed9-4f74-8d0b-d701bbf63ef1";
const PIX_HOLDER = "Lumara XLab";
const PIX_BANK = "Mercado Pago";
const PETRON_WHATSAPP = "5513998035663";

const checkoutSchema = z.object({
  companyName: z.string().min(2, "Informe o nome da empresa"),
  cnpj: z.string().min(14, "CNPJ inválido").max(18),
  contactName: z.string().min(2, "Informe o responsável"),
  contactRole: z.string().min(2, "Informe o cargo"),
  email: z.string().email("E-mail inválido"),
  whatsapp: z.string().min(10, "Informe o WhatsApp"),
  cidade: z.string().min(2, "Informe a cidade"),
  estado: z.string().trim().length(2, "UF com 2 letras"),
});

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Recovery = { paymentId: number; planSlug: string; status: string; googleRequired: boolean };

type ServerRegistration = {
  inquiryId: number;
  planSlug: string;
  companyName: string;
  cnpj: string;
  contactName: string;
  contactRole: string;
  email: string;
  whatsapp: string;
  cidade: string;
  estado: string;
  segment: string;
};

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

type Stage = "form" | "payment" | "status";

type PixData = {
  paymentId: number;
  mpPaymentId: string;
  pixCopyPaste: string;
  qrCodeBase64: string;
  amount: number;
  sandboxMode: boolean;
  claimToken?: string;
};

export default function CheckoutPage() {
  const { plano } = useParams<{ plano: string }>();
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>("form");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [statusStep, setStatusStep] = useState(0);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(true);
  const [resumePaymentId, setResumePaymentId] = useState<number | null>(null);
  const [pollStopped, setPollStopped] = useState<string | null>(null);
  const search = useSearch();
  const [formData, setFormData] = useState<CheckoutFormValues | null>(null);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inquiryId, setInquiryId] = useState<number | null>(null);

  const plan = PLANS[plano ?? ""] ?? PLANS["radar-pro"];

  const [registration, setRegistration] = useState<ServerRegistration | null>(null);
  const [registrationLoading, setRegistrationLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      companyName: "",
      cnpj: "",
      contactName: "",
      contactRole: "",
      email: "",
      whatsapp: "",
      cidade: "",
      estado: "",
    },
  });

  // Reuse a registration already stored on the server (from /cadastro).
  const resetRef = useRef(form.reset);
  resetRef.current = form.reset;
  const setValueRef = useRef(form.setValue);
  setValueRef.current = form.setValue;
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/auth/registration`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { registration: ServerRegistration | null; googleEmail?: string | null } | null) => {
        if (!alive || !d) return;
        if (d.googleEmail) {
          setGoogleEmail(d.googleEmail);
          setValueRef.current("email", d.googleEmail);
        }
        if (!d.registration) return;
        const r = d.registration;
        setRegistration(r);
        setInquiryId(r.inquiryId);
        resetRef.current({
          companyName: r.companyName ?? "",
          cnpj: r.cnpj ?? "",
          contactName: r.contactName ?? "",
          contactRole: r.contactRole ?? "",
          email: d.googleEmail ?? r.email ?? "",
          whatsapp: r.whatsapp ?? "",
          cidade: r.cidade ?? "",
          estado: r.estado ?? "",
        });
      })
      .catch(() => {})
      .finally(() => { if (alive) setRegistrationLoading(false); });
    return () => { alive = false; };
  }, []);

  async function onSubmitForm(values: CheckoutFormValues) {
    setSubmitError(null);
    // Always submit to the server; it decides whether the existing inquiry can be reused.
    if (googleEmail && values.email.trim().toLowerCase() !== googleEmail.toLowerCase()) {
      form.setError("email", { message: `Use o e-mail verificado no Google (${googleEmail}).` });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: values.companyName,
          cnpj: values.cnpj,
          contactName: values.contactName,
          contactRole: values.contactRole,
          email: googleEmail ?? values.email.trim(),
          whatsapp: values.whatsapp,
          cidade: values.cidade,
          estado: values.estado.toUpperCase(),
          segment: registration?.segment || "A confirmar",
          servicesOffered: "A confirmar",
          planSlug: plano ?? "radar-pro",
          allowContact: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { inquiryId?: number; checkoutPath?: string; error?: string };
      if (!res.ok || typeof body.inquiryId !== "number") {
        throw new Error(body.error ?? "Não foi possível registrar seus dados. Tente novamente.");
      }
      setInquiryId(body.inquiryId);
      trackEvent("checkout_details_submitted", {
        plan: plano ?? "radar-pro",
        location: "checkout",
      });
      setFormData(values);
      setStage("payment");
      toast({ title: "Dados registrados", description: "Escolha a forma de pagamento." });
      // Server may point to a different plan's checkout; only follow safe internal paths.
      const dest = safeDestination(body.checkoutPath);
      if (dest && !dest.startsWith(`/checkout/${plano ?? "radar-pro"}`) && dest.startsWith("/checkout/")) {
        window.history.replaceState(null, "", `${API_BASE}${dest}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tente novamente.";
      setSubmitError(msg);
      toast({ title: "Erro ao registrar", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const onGeneratePix = useCallback(async () => {
    if (!formData) return;
    setPixLoading(true);
    try {
      const nameParts = formData.contactName.trim().split(" ");
      const res = await fetch(`${API_BASE}/api/payments/pix`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquiryId: inquiryId ?? undefined,
          planSlug: plano ?? "radar-pro",
          amount: plan.priceNum,
          payerEmail: formData.email,
          payerName: nameParts[0],
          payerLastName: nameParts.slice(1).join(" ") || ".",
          payerCnpj: formData.cnpj,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Erro ao gerar Pix");
      }
      const data = await res.json() as PixData;
      setPixData(data);
      trackEvent("pix_qr_created", {
        plan: plano ?? "radar-pro",
        method: "pix",
      });
      toast({ title: "QR Code Pix gerado!", description: "Efetue o pagamento para liberar o acesso." });
    } catch (err) {
      toast({ title: "Erro ao gerar Pix", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setPixLoading(false);
    }
  }, [formData, inquiryId, plano, plan.priceNum, toast]);

  // Claim the paid access. Uses the claim token when this tab created the
  // payment; otherwise {} and the server relies on the HttpOnly recovery receipt.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const claimingRef = useRef(false);
  const runClaim = useCallback(async (paymentId: number, claimToken?: string) => {
    if (claimingRef.current) return;
    claimingRef.current = true;
    setClaiming(true);
    setClaimError(null);
    setClaimCode(null);
    setStage("status");
    setStatusStep(1);
    try {
      const claimRes = await fetch(`${API_BASE}/api/payments/${paymentId}/claim`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claimToken ? { claimToken } : {}),
      });
      const claimData = (await claimRes.json().catch(() => ({}))) as { ok?: boolean; alreadyExists?: boolean; error?: string; code?: string };
      if (claimRes.ok && claimData.ok === true) {
        setStatusStep(2);
        toastRef.current({ title: "Acesso liberado", description: "Entrando na sua conta Petron Radar..." });
        setTimeout(() => { window.location.href = import.meta.env.BASE_URL; }, 2200);
        return;
      }
      let msg: string;
      if (claimData.code === "google_reverification_required") {
        setClaimCode("google_reverification_required");
        msg = "Sua verificação com Google expirou. Confirme novamente com a mesma conta Google para liberar o acesso.";
      } else if (claimData.alreadyExists) {
        msg = "Já existe uma conta ativa para este cadastro. Entre com seu login para acessar.";
      } else {
        msg = claimData.error ?? "Não foi possível liberar o acesso automaticamente.";
      }
      setClaimError(msg);
      toastRef.current({ title: "Pagamento confirmado, acesso pendente", description: msg, variant: "destructive" });
    } catch {
      const msg = "Não foi possível liberar o acesso automaticamente (falha de conexão).";
      setClaimError(msg);
      toastRef.current({ title: "Pagamento confirmado, acesso pendente", description: msg, variant: "destructive" });
    } finally {
      claimingRef.current = false;
      setClaiming(false);
    }
  }, []);

  // Discover a paid/pending payment via the recovery receipt (reload or OAuth return).
  const resumeParam = new URLSearchParams(search).get("resume") === "1";
  const recoveryCheckedRef = useRef(false);
  useEffect(() => {
    if (recoveryCheckedRef.current) return;
    recoveryCheckedRef.current = true;
    let alive = true;
    fetch(`${API_BASE}/api/payments/recovery`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { recovery: Recovery | null } | null) => {
        if (!alive || !d?.recovery) return;
        const rec = d.recovery;
        if (rec.planSlug !== (plano ?? "radar-pro") && !resumeParam) return;
        setRecovery(rec);
        if (rec.status === "approved") {
          void runClaim(rec.paymentId);
        } else if (rec.status === "pending" || rec.status === "in_process") {
          setResumePaymentId(rec.paymentId);
          setStage("status");
          setStatusStep(0);
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setRecoveryLoading(false); });
    return () => { alive = false; };
  }, [plano, resumeParam, runClaim]);

  // Poll payment status every 5 seconds (fresh QR in this tab, or resumed receipt).
  const pollPaymentId = pixData && stage === "payment" ? pixData.paymentId : (resumePaymentId && stage === "status" && statusStep === 0 ? resumePaymentId : null);
  const pollClaimToken = pixData?.claimToken;
  useEffect(() => {
    if (!pollPaymentId || pollStopped) return;
    let checking = false;
    let failures = 0;
    const interval = setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const res = await fetch(`${API_BASE}/api/payments/${pollPaymentId}/status`, { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { status: string };
        failures = 0;
        if (data.status === "approved") {
          clearInterval(interval);
          trackEvent("payment_approved", { plan: plano ?? "radar-pro", method: "pix" });
          void runClaim(pollPaymentId, pollClaimToken);
        } else if (["rejected", "cancelled", "expired", "refunded"].includes(data.status)) {
          clearInterval(interval);
          setPollStopped(`O pagamento não foi concluído (status: ${data.status}). Gere um novo pagamento ou fale com o suporte.`);
        }
      } catch {
        failures += 1;
        if (failures >= 5) {
          clearInterval(interval);
          setPollStopped("Não foi possível verificar o pagamento agora. Tente retomar a verificação.");
        }
      } finally {
        checking = false;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [pollPaymentId, pollClaimToken, pollStopped, plano, runClaim]);

  function copyPixKey() {
    if (!pixData?.pixCopyPaste) return;
    navigator.clipboard.writeText(pixData.pixCopyPaste).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" asChild>
              <Link href="/planos">
                <ChevronLeft className="w-4 h-4 mr-1" /> Planos
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-4 opacity-30" />
            <PetronLogo iconOnly className="w-6 h-6" />
            <span className="font-bold text-sm tracking-tight hidden sm:block">PETRON RADAR</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 text-green-400" />
            <span className="hidden sm:inline">Checkout seguro</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-5xl">
        {/* Stage header */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          {["Dados da Empresa", "Pagamento", "Status"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < (stage === "form" ? 0 : stage === "payment" ? 1 : 2) + 1
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}>
                {i + 1}
              </div>
              <span className={`hidden sm:block ${i <= (stage === "form" ? 0 : stage === "payment" ? 1 : 2) ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {s}
              </span>
              {i < 2 && <ChevronLeft className="w-4 h-4 text-muted-foreground/30 rotate-180 shrink-0" />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {stage === "form" && (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="border-border">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base">Dados da Empresa</CardTitle>
                      <p className="text-sm text-muted-foreground">Preencha os dados para formalizar o acesso ao Petron Radar.</p>
                    </CardHeader>
                    <CardContent>
                      {registrationLoading ? (
                        <div className="mb-4 h-10 rounded-lg bg-muted/40 animate-pulse" aria-label="Verificando cadastro existente" />
                      ) : registration ? (
                        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground" data-testid="status-existing-registration">
                          Encontramos o cadastro de <strong className="text-foreground">{registration.companyName}</strong>. Os dados foram preenchidos; ao continuar, eles são reenviados para confirmação do pedido. O acesso só é liberado após a confirmação do pagamento.
                        </div>
                      ) : null}
                      <form onSubmit={form.handleSubmit(onSubmitForm)} className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-sm">Razão Social <span className="text-primary">*</span></Label>
                            <Input
                              placeholder="Nome da empresa"
                              className="h-11 bg-muted/30 border-border"
                              {...form.register("companyName")}
                            />
                            {form.formState.errors.companyName && (
                              <p className="text-xs text-red-500">{form.formState.errors.companyName.message}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm">CNPJ <span className="text-primary">*</span></Label>
                            <Input
                              placeholder="00.000.000/0001-00"
                              className="h-11 bg-muted/30 border-border"
                              {...form.register("cnpj")}
                            />
                            {form.formState.errors.cnpj && (
                              <p className="text-xs text-red-500">{form.formState.errors.cnpj.message}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm">Responsável <span className="text-primary">*</span></Label>
                            <Input
                              placeholder="Nome completo"
                              className="h-11 bg-muted/30 border-border"
                              {...form.register("contactName")}
                            />
                            {form.formState.errors.contactName && (
                              <p className="text-xs text-red-500">{form.formState.errors.contactName.message}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm">Cargo <span className="text-primary">*</span></Label>
                            <Input
                              placeholder="Ex: Diretor Comercial"
                              className="h-11 bg-muted/30 border-border"
                              {...form.register("contactRole")}
                            />
                            {form.formState.errors.contactRole && (
                              <p className="text-xs text-red-500">{form.formState.errors.contactRole.message}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm">E-mail Corporativo <span className="text-primary">*</span></Label>
                            <Input
                              type="email"
                              readOnly={!!googleEmail}
                              placeholder="seu@empresa.com.br"
                              className="h-11 bg-muted/30 border-border"
                              {...form.register("email")}
                            />
                            {form.formState.errors.email && (
                              <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm">WhatsApp <span className="text-primary">*</span></Label>
                            <Input
                              placeholder="+55 11 99999-9999"
                              className="h-11 bg-muted/30 border-border"
                              {...form.register("whatsapp")}
                            />
                            {form.formState.errors.whatsapp && (
                              <p className="text-xs text-red-500">{form.formState.errors.whatsapp.message}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm">Cidade <span className="text-primary">*</span></Label>
                            <Input
                              placeholder="Ex: Macaé"
                              className="h-11 bg-muted/30 border-border"
                              data-testid="input-cidade"
                              {...form.register("cidade")}
                            />
                            {form.formState.errors.cidade && (
                              <p className="text-xs text-red-500">{form.formState.errors.cidade.message}</p>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm">UF <span className="text-primary">*</span></Label>
                            <Input
                              placeholder="RJ"
                              maxLength={2} className="h-11 bg-muted/30 border-border uppercase"
                              data-testid="input-estado"
                              {...form.register("estado")}
                            />
                            {form.formState.errors.estado && (
                              <p className="text-xs text-red-500">{form.formState.errors.estado.message}</p>
                            )}
                          </div>
                        </div>
                        {submitError && (
                          <p className="text-xs text-red-500" data-testid="status-submit-error">{submitError}</p>
                        )}
                        <p className="text-xs text-muted-foreground pt-1">
                          Seus dados são usados exclusivamente para formalização do contrato e liberação de acesso.
                        </p>
                        <Button
                          type="submit"
                          size="lg"
                          className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                          disabled={submitting || registrationLoading || recoveryLoading}
                        >
                          {submitting ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</>
                          ) : (
                            <>Continuar para Pagamento <ArrowRight className="w-4 h-4 ml-2" /></>
                          )}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {stage === "payment" && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="border-border">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base">Forma de Pagamento</CardTitle>
                      <p className="text-sm text-muted-foreground">Selecione como deseja realizar o pagamento.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        {PAYMENT_METHODS.map((pm) => (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => { setPaymentMethod(pm.id); setPixData(null); }}
                            className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
                              paymentMethod === pm.id
                                ? "border-primary bg-primary/5"
                                : "border-border bg-muted/20 hover:border-primary/30"
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              paymentMethod === pm.id ? "bg-primary/10" : "bg-muted"
                            }`}>
                              <pm.icon className={`w-5 h-5 ${paymentMethod === pm.id ? "text-primary" : "text-muted-foreground"}`} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{pm.label}</p>
                              <p className="text-xs text-muted-foreground">{pm.desc}</p>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                              paymentMethod === pm.id ? "border-primary bg-primary" : "border-border"
                            }`} />
                          </button>
                        ))}
                      </div>

                      {/* ── PIX ───────────────────────────────────────── */}
                      {paymentMethod === "pix" && PIX_STATIC && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          <div className="bg-white rounded-xl p-5 flex flex-col items-center gap-3 border border-border">
                            <img
                              src={`${import.meta.env.BASE_URL}pix-qr-code.png`}
                              alt="QR Code Pix Petron Radar"
                              className="w-56 h-56 object-contain"
                            />
                            <p className="text-xs text-muted-foreground text-center">
                              Escaneie o QR Code com o app do seu banco e pague <strong className="text-foreground">{plan.price}</strong>
                            </p>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Chave Pix (aleatória)</p>
                            <div className="flex items-stretch gap-2">
                              <div className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 font-mono text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                                {PIX_KEY}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="px-3 shrink-0 border-border"
                                onClick={() => {
                                  navigator.clipboard.writeText(PIX_KEY).then(() => {
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 3000);
                                  });
                                }}
                              >
                                {copied
                                  ? <CheckCheck className="w-4 h-4 text-green-400" />
                                  : <Copy className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>

                          <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-2 text-xs">
                            <div className="flex justify-between"><span className="text-muted-foreground">Favorecido</span><span className="font-semibold">{PIX_HOLDER}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Instituição</span><span className="font-semibold">{PIX_BANK}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-semibold">{plan.price}{plan.period}</span></div>
                          </div>

                          <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-1.5">
                            <p className="text-xs font-semibold">Como concluir</p>
                            <ul className="space-y-1 text-xs text-muted-foreground list-none">
                              <li>1. Abra o app do seu banco e acesse <strong>Pix</strong></li>
                              <li>2. Pague pelo <strong>QR Code</strong> ou faça uma transferência Pix para a <strong>chave acima</strong>, no valor de <strong>{plan.price}</strong></li>
                              <li>3. Toque em <strong>"Já paguei"</strong> e envie o comprovante à nossa equipe no WhatsApp</li>
                              <li>4. Após confirmarmos o pagamento, seu acesso é liberado e as credenciais enviadas por e-mail/WhatsApp</li>
                            </ul>
                          </div>

                          <Button
                            size="lg"
                            className="w-full h-12 bg-primary text-primary-foreground font-bold"
                            asChild
                          >
                            <a
                              href={`https://wa.me/${PETRON_WHATSAPP}?text=${encodeURIComponent(`Olá! Acabei de pagar o plano ${plan.name} (${plan.price}) via Pix. Segue o comprovante para liberação do meu acesso ao Petron Radar.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                setStage("status");
                                setStatusStep(0);
                              }}
                            >
                              <MessageSquare className="w-4 h-4 mr-2" /> Já paguei — enviar comprovante
                            </a>
                          </Button>
                        </motion.div>
                      )}

                      {paymentMethod === "pix" && !PIX_STATIC && !pixData && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-5 text-center space-y-3">
                          <QrCode className="w-10 h-10 text-primary mx-auto" />
                          <p className="text-sm font-semibold">Pague {plan.price} via Pix</p>
                          <p className="text-xs text-muted-foreground">
                            Clique abaixo para gerar o QR Code Pix. Após o pagamento, o acesso é liberado automaticamente.
                          </p>
                          <Button
                            size="lg"
                            className="w-full h-12 bg-primary text-primary-foreground font-bold"
                            onClick={onGeneratePix}
                            disabled={pixLoading}
                          >
                            {pixLoading
                              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando QR Code...</>
                              : <><Zap className="w-4 h-4 mr-2" /> Gerar QR Code Pix</>}
                          </Button>
                        </div>
                      )}

                      {paymentMethod === "pix" && !PIX_STATIC && pixData && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          {pixData.sandboxMode && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 text-xs text-amber-400 flex items-center gap-2">
                              <span className="font-bold">Modo Teste</span>
                              <span>MP_ACCESS_TOKEN não configurado. Configure nas credenciais para pagamentos reais.</span>
                            </div>
                          )}

                          <div className="bg-white rounded-xl p-5 flex flex-col items-center gap-3 border border-border">
                            {pixData.qrCodeBase64 ? (
                              <img
                                src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                                alt="QR Code Pix"
                                className="w-48 h-48"
                              />
                            ) : (
                              <div className="w-48 h-48 flex items-center justify-center bg-muted/20 rounded-lg border-2 border-dashed border-border">
                                <QrCode className="w-16 h-16 text-muted-foreground/40" />
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground text-center">
                              Escaneie o QR Code com o app do seu banco
                            </p>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Pix Copia e Cola</p>
                            <div className="flex items-stretch gap-2">
                              <div className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 font-mono text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                                {pixData.pixCopyPaste}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="px-3 shrink-0 border-border"
                                onClick={copyPixKey}
                              >
                                {copied
                                  ? <CheckCheck className="w-4 h-4 text-green-400" />
                                  : <Copy className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>

                          <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-1.5">
                            <p className="text-xs font-semibold">Instruções</p>
                            <ul className="space-y-1 text-xs text-muted-foreground list-none">
                              <li>1. Abra o app do seu banco e acesse a opção <strong>Pix</strong></li>
                              <li>2. Escolha <strong>Pagar com QR Code</strong> ou <strong>Copia e Cola</strong></li>
                              <li>3. Pague exatamente <strong>{plan.price}</strong></li>
                              <li>4. O acesso é liberado automaticamente após a confirmação</li>
                            </ul>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/10 rounded-lg px-3 py-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                            <span>Aguardando confirmação do pagamento...</span>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-dashed border-border text-muted-foreground"
                            onClick={() => setPixData(null)}
                          >
                            Gerar novo QR Code
                          </Button>
                        </motion.div>
                      )}

                      {paymentMethod === "boleto" && (
                        <div className="bg-muted/30 border border-border rounded-lg p-4 text-sm space-y-2">
                          <p className="font-semibold">Boleto Bancário</p>
                          <p className="text-xs text-muted-foreground">O boleto será gerado e enviado para o e-mail informado em até 1 hora útil. Vencimento em 3 dias úteis.</p>
                        </div>
                      )}
                      {paymentMethod === "cartao" && (
                        <div className="bg-muted/30 border border-border rounded-lg p-4 text-sm space-y-2">
                          <p className="font-semibold">Cartão de Crédito</p>
                          <p className="text-xs text-muted-foreground">Link de pagamento seguro enviado por e-mail e WhatsApp após confirmação do pedido. Parcelamento em até 12x.</p>
                        </div>
                      )}

                      <Separator className="opacity-30" />

                      <div className="space-y-3">
                        {paymentMethod !== "pix" && (
                          <Button
                            size="lg"
                            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
                            onClick={() => {
                              setStage("status");
                              setStatusStep(0);
                              toast({ title: "Pedido confirmado!", description: "Nossa equipe entrará em contato em breve." });
                            }}
                          >
                            Confirmar Pedido <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground"
                          onClick={() => setStage("form")}
                        >
                          Voltar e editar dados
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {stage === "status" && (
                <motion.div
                  key="status"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {claiming && (
                    <Card className="border-primary/30 bg-primary/5" data-testid="status-claiming">
                      <CardContent className="p-8 text-center space-y-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                        <h2 className="text-xl font-bold">Pagamento confirmado</h2>
                        <p className="text-sm text-muted-foreground">Liberando seu acesso ao Petron Radar...</p>
                      </CardContent>
                    </Card>
                  )}
                  {resumePaymentId && statusStep === 0 && !claiming && (
                    <Card className="border-amber-500/30 bg-amber-500/5" data-testid="status-resumed-pending">
                      <CardContent className="p-6 space-y-3">
                        <div className="flex items-center gap-2">
                          {pollStopped ? <Clock className="w-5 h-5 text-amber-400" /> : <Loader2 className="w-5 h-5 animate-spin text-amber-400" />}
                          <h2 className="font-bold">Pagamento em andamento encontrado</h2>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {pollStopped ?? "Estamos aguardando a confirmação do Pix já gerado. Não é preciso pagar novamente; esta página atualiza sozinha."}
                        </p>
                        {pollStopped && (
                          <Button variant="outline" size="sm" onClick={() => setPollStopped(null)} data-testid="button-resume-polling">
                            <RefreshCw className="w-4 h-4 mr-2" /> Retomar verificação
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  {claimError && statusStep < 2 && !claiming && (
                    <Card className="border-amber-500/40 bg-amber-500/5" data-testid="status-access-pending">
                      <CardContent className="p-8 text-center space-y-4">
                        <Clock className="w-10 h-10 text-amber-400 mx-auto" />
                        <h2 className="text-2xl font-bold">Pagamento confirmado, acesso pendente</h2>
                        <p className="text-sm text-muted-foreground" data-testid="text-claim-error">{claimError}</p>
                        <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
                          {claimCode === "google_reverification_required" ? (
                            <Button
                              onClick={() => window.location.assign(googleStartUrl("register", `/checkout/${plano ?? "radar-pro"}?resume=1`))}
                              data-testid="button-google-reverify"
                            >
                              Confirmar novamente com Google
                            </Button>
                          ) : (recovery?.paymentId ?? pixData?.paymentId ?? resumePaymentId) ? (
                            <Button
                              variant="outline"
                              onClick={() => {
                                const id = pixData?.paymentId ?? recovery?.paymentId ?? resumePaymentId;
                                if (id) void runClaim(id, pixData?.claimToken);
                              }}
                              data-testid="button-retry-claim"
                            >
                              <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
                            </Button>
                          ) : null}
                          <Button asChild variant="outline" data-testid="link-login-after-payment">
                            <Link href="/login">Ir para o login</Link>
                          </Button>
                          <Button asChild data-testid="link-support-after-payment">
                            <a href={`https://wa.me/${PETRON_WHATSAPP}?text=${encodeURIComponent(`Olá! Meu pagamento do plano ${plan.name} foi confirmado, mas o acesso ainda não foi liberado.`)}`} target="_blank" rel="noopener noreferrer">
                              <MessageSquare className="w-4 h-4 mr-2" /> Falar com o suporte
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {statusStep >= 2 ? (
                    <Card className="border-green-500/40 bg-green-500/5">
                      <CardContent className="p-8 text-center">
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                          className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-5"
                        >
                          <ShieldCheck className="w-10 h-10 text-green-400" />
                        </motion.div>
                        <h2 className="text-2xl font-bold mb-2 text-green-400">Acesso Liberado!</h2>
                        <p className="text-muted-foreground text-sm">
                          {formData?.contactName && `Parabéns, ${formData.contactName}! `}
                          Seu pagamento foi confirmado e o acesso ao Petron Radar está ativo.
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Credenciais enviadas para <strong>{formData?.email}</strong> e WhatsApp.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (resumePaymentId || claimError || claiming) ? null : (
                    <Card className="border-primary/30 bg-primary/5">
                      <CardContent className="p-8 text-center">
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.2, type: "spring" }}
                          className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5"
                        >
                          <CheckCircle2 className="w-8 h-8 text-primary" />
                        </motion.div>
                        <h2 className="text-2xl font-bold mb-2">Pedido Registrado!</h2>
                        <p className="text-muted-foreground text-sm">
                          {formData?.contactName && `Obrigado, ${formData.contactName}. `}
                          Nossa equipe entrará em contato em até 1 hora útil.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="border-border">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Status do Pedido
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {STATUS_STEPS.map((step, i) => (
                        <div key={step.id} className="flex items-center gap-4">
                          <motion.div
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: i <= statusStep ? 1 : 0.3 }}
                            transition={{ delay: i * 0.3, duration: 0.4 }}
                            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                              i <= statusStep ? (i === statusStep ? "bg-primary/10" : "bg-green-500/10") : "bg-muted/30"
                            }`}
                          >
                            <step.icon className={`w-4.5 h-4.5 ${
                              i < statusStep ? "text-green-400" : i === statusStep ? step.color : "text-muted-foreground/30"
                            }`} />
                          </motion.div>
                          <div>
                            <p className={`text-sm font-medium transition-colors ${i <= statusStep ? "text-foreground" : "text-muted-foreground/40"}`}>
                              {step.label}
                            </p>
                            {i === 0 && statusStep === 0 && (
                              <p className="text-xs text-amber-400">Aguardando confirmação da equipe...</p>
                            )}
                            {i === 0 && statusStep > 0 && (
                              <p className="text-xs text-green-400">Pix registrado com sucesso</p>
                            )}
                            {i === 1 && statusStep >= 1 && (
                              <p className="text-xs text-green-400">Pagamento recebido e confirmado</p>
                            )}
                            {i === 2 && statusStep >= 2 && (
                              <p className="text-xs text-primary">Credenciais enviadas por e-mail e WhatsApp</p>
                            )}
                          </div>
                          {i < statusStep && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.2 }}
                              className="ml-auto"
                            >
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button variant="outline" className="flex-1 border-border" asChild>
                      <a href={`https://wa.me/${PETRON_WHATSAPP}`} target="_blank" rel="noopener noreferrer">
                        <MessageSquare className="w-4 h-4 mr-2 text-green-400" />
                        Falar com equipe Petron
                      </a>
                    </Button>
                    <Button variant="outline" className="flex-1 border-border" asChild>
                      <Link href="/">
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Acessar o Dashboard
                      </Link>
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order summary */}
          <div className="space-y-4">
            <Card className={`border-border ${plan.highlight ? "border-primary/40 bg-primary/5" : ""}`}>
              <CardContent className="p-6">
                {plan.badge && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 mb-3 text-xs font-bold">
                    <Star className="w-3 h-3 mr-1" /> {plan.badge}
                  </Badge>
                )}
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{plan.description}</p>
                <div className="mb-5">
                  <span className="text-3xl font-extrabold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <Separator className="mb-4 opacity-30" />
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plano</span>
                  <span className="font-medium">{plan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Periodicidade</span>
                  <span className="font-medium">Mensal</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vigência inicial</span>
                  <span className="font-medium">12 meses</span>
                </div>
                <Separator className="opacity-30" />
                <div className="flex justify-between">
                  <span className="font-bold">Total / mês</span>
                  <span className="text-xl font-extrabold text-primary">{plan.price}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-muted/20">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span>Transação segura — dados criptografados</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>Aceita CNPJ brasileiro e empresas internacionais</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>Acesso liberado em até 1 hora útil</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
