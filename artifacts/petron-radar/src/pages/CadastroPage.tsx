import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PetronLogo } from "@/components/layout/PetronLogo";
import { PLANS } from "@/pages/CheckoutPage";
import { safeDestination, googleStartUrl, authErrorMessage } from "@/lib/safeDestination";
import { AlertCircle, ArrowRight, BadgeCheck, ChevronLeft, Loader2, Lock, ShieldCheck } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const schema = z.object({
  companyName: z.string().trim().min(2, "Informe a razão social"),
  cnpj: z.string().trim().min(14, "CNPJ inválido").max(18, "CNPJ inválido"),
  contactName: z.string().trim().min(2, "Informe o responsável"),
  contactRole: z.string().trim().min(2, "Informe o cargo"),
  email: z.string().trim().email("E-mail inválido"),
  whatsapp: z.string().trim().min(10, "Informe o WhatsApp com DDD"),
  segment: z.string().trim().min(2, "Informe o segmento"),
  servicesOffered: z.string().trim().min(3, "Descreva os serviços oferecidos"),
  cidade: z.string().trim().min(2, "Informe a cidade"),
  estado: z.string().trim().length(2, "UF com 2 letras"),
  planSlug: z.string().refine((v) => v in PLANS, "Selecione um plano"),
  allowContact: z.boolean(),
});
type Values = z.infer<typeof schema>;

type RegistrationResponse = {
  registration: null | {
    inquiryId: number; planSlug: string; companyName: string; cnpj: string; contactName: string;
    contactRole: string; email: string; whatsapp: string; cidade: string; estado: string; segment: string;
  };
  googleEmail: string | null;
};

const FIELDS: { name: keyof Values; label: string; placeholder: string; type?: string; span?: boolean }[] = [
  { name: "companyName", label: "Razão social", placeholder: "Nome da empresa" },
  { name: "cnpj", label: "CNPJ", placeholder: "00.000.000/0001-00" },
  { name: "contactName", label: "Responsável", placeholder: "Nome completo" },
  { name: "contactRole", label: "Cargo", placeholder: "Ex: Diretor Comercial" },
  { name: "email", label: "E-mail corporativo", placeholder: "voce@empresa.com.br", type: "email" },
  { name: "whatsapp", label: "WhatsApp", placeholder: "+55 22 99999-9999" },
  { name: "segment", label: "Segmento", placeholder: "Ex: Caldeiraria, Inspeção, Offshore" },
  { name: "cidade", label: "Cidade", placeholder: "Ex: Macaé" },
];

export default function CadastroPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const googleVerifiedParam = params.get("google") === "verified";
  const initialPlan = params.get("plano");
  const [authError] = useState(() => authErrorMessage(params.get("authError")));

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "", cnpj: "", contactName: "", contactRole: "", email: "", whatsapp: "",
      segment: "", servicesOffered: "", cidade: "", estado: "",
      planSlug: initialPlan && initialPlan in PLANS ? initialPlan : "radar-pro",
      allowContact: true,
    },
  });
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(false);
    Promise.all([
      fetch(`${BASE}/api/auth/options`, { credentials: "include", cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { googleAvailable: false }))
        .catch(() => ({ googleAvailable: false })),
      fetch(`${BASE}/api/auth/registration`, { credentials: "include", cache: "no-store" })
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
    ])
      .then(([opts, reg]: [{ googleAvailable?: boolean }, RegistrationResponse]) => {
        if (!alive) return;
        setGoogleAvailable(!!opts.googleAvailable);
        setGoogleEmail(reg.googleEmail ?? null);
        const f = formRef.current;
        const r = reg.registration;
        if (r) {
          f.reset({
            ...f.getValues(),
            companyName: r.companyName ?? "", cnpj: r.cnpj ?? "", contactName: r.contactName ?? "",
            contactRole: r.contactRole ?? "", email: r.email ?? "", whatsapp: r.whatsapp ?? "",
            cidade: r.cidade ?? "", estado: r.estado ?? "", segment: r.segment ?? "",
            planSlug: r.planSlug in PLANS ? r.planSlug : f.getValues("planSlug"),
          });
        }
        if (reg.googleEmail) f.setValue("email", reg.googleEmail);
      })
      .catch(() => { if (alive) setLoadError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  async function onSubmit(values: Values) {
    setSubmitError(null);
    if (googleEmail && values.email.trim().toLowerCase() !== googleEmail.toLowerCase()) {
      form.setError("email", { message: `Use o mesmo e-mail verificado no Google (${googleEmail}).` });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/auth/register`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, estado: values.estado.toUpperCase() }),
      });
      const body = (await res.json().catch(() => ({}))) as { checkoutPath?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Não foi possível concluir o cadastro. Tente novamente.");
      const dest = safeDestination(body.checkoutPath);
      navigate(dest && dest.startsWith("/checkout/") ? dest : `/checkout/${values.planSlug}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Não foi possível concluir o cadastro.");
    } finally {
      setSubmitting(false);
    }
  }

  const errors = form.formState.errors;
  const selectedPlan = form.watch("planSlug");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-background to-background pointer-events-none" />
      <header className="relative border-b border-border/50">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/login" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-login">
            <ChevronLeft className="h-4 w-4" /> Já sou cliente
          </Link>
          <PetronLogo iconOnly className="w-6 h-6" />
        </div>
      </header>

      <main className="relative container mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Cadastro de empresa</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Solicite acesso ao Petron Radar</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Preencha os dados da empresa e siga para o pagamento. Não pedimos senha agora: o acesso à plataforma
            só é criado depois que o pagamento for confirmado ou a equipe Petron ativar sua conta.
          </p>
        </div>

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-500" data-testid="status-no-access-notice">
          <Lock className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Este cadastro não libera acesso imediato. Boletins, radar e demais recursos ficam disponíveis apenas após a confirmação do pagamento.</span>
        </div>

        {authError && (
          <div className="mb-6 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive" data-testid="status-auth-error">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{authError}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-8" aria-label="Carregando cadastro">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-11 rounded-md bg-muted/40 animate-pulse" />)}
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
            <AlertCircle className="h-6 w-6 mx-auto text-destructive" />
            <p className="text-sm text-muted-foreground">Não foi possível carregar o cadastro.</p>
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)} data-testid="button-retry">Tentar novamente</Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl">
            {googleEmail ? (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm" data-testid="status-google-verified">
                <BadgeCheck className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-semibold">E-mail verificado pelo Google: {googleEmail}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Esta identidade Google será vinculada à sua conta somente após a confirmação do pagamento. Até lá, nenhum acesso é liberado.
                  </p>
                </div>
              </div>
            ) : googleVerifiedParam ? (
              <div className="mb-6 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>A verificação com Google expirou ou não foi concluída. Tente novamente.</span>
              </div>
            ) : null}

            {!googleEmail && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 font-semibold"
                  disabled={!googleAvailable || redirecting}
                  onClick={() => { setRedirecting(true); window.location.assign(googleStartUrl("register")); }}
                  data-testid="button-google-register"
                >
                  {redirecting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecionando para o Google...</> : "Verificar e-mail com Google"}
                </Button>
                {!googleAvailable && (
                  <p className="mt-2 text-xs text-muted-foreground text-center" data-testid="text-google-unavailable">
                    A verificação com Google está indisponível: a integração ainda não foi configurada. Preencha o cadastro manualmente.
                  </p>
                )}
                <div className="flex items-center gap-3 my-6 text-[11px] uppercase tracking-widest text-muted-foreground/70">
                  <span className="h-px flex-1 bg-border" />ou preencha manualmente<span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.name} className="space-y-1.5">
                    <Label htmlFor={f.name} className="text-sm">{f.label} <span className="text-primary">*</span></Label>
                    <Input
                      id={f.name}
                      type={f.type ?? "text"}
                      placeholder={f.placeholder}
                      className="h-11 bg-muted/30"
                      readOnly={f.name === "email" && !!googleEmail}
                      data-testid={`input-${f.name}`}
                      {...form.register(f.name as Exclude<keyof Values, "allowContact">)}
                    />
                    {errors[f.name] && <p className="text-xs text-red-500">{errors[f.name]?.message as string}</p>}
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label htmlFor="estado" className="text-sm">UF <span className="text-primary">*</span></Label>
                  <Input id="estado" maxLength={2} placeholder="RJ" className="h-11 bg-muted/30 uppercase" data-testid="input-estado" {...form.register("estado")} />
                  {errors.estado && <p className="text-xs text-red-500">{errors.estado.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="planSlug" className="text-sm">Plano <span className="text-primary">*</span></Label>
                  <select
                    id="planSlug"
                    className="h-11 w-full rounded-md border border-input bg-muted/30 px-3 text-sm"
                    data-testid="select-plan"
                    {...form.register("planSlug")}
                  >
                    {Object.entries(PLANS).map(([slug, p]) => (
                      <option key={slug} value={slug}>{p.name} — {p.price}{p.period}</option>
                    ))}
                  </select>
                  {errors.planSlug && <p className="text-xs text-red-500">{errors.planSlug.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="servicesOffered" className="text-sm">Serviços oferecidos <span className="text-primary">*</span></Label>
                <Textarea id="servicesOffered" rows={3} placeholder="Descreva o que sua empresa fornece para o setor de óleo e gás" className="bg-muted/30" data-testid="input-servicesOffered" {...form.register("servicesOffered")} />
                {errors.servicesOffered && <p className="text-xs text-red-500">{errors.servicesOffered.message}</p>}
              </div>

              <label className="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={form.watch("allowContact")}
                  onCheckedChange={(v) => form.setValue("allowContact", v === true)}
                  data-testid="checkbox-allow-contact"
                />
                <span>Autorizo a equipe Petron Radar a entrar em contato por e-mail e WhatsApp sobre este cadastro.</span>
              </label>

              {submitError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive" data-testid="status-submit-error">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{submitError}</span>
                </div>
              )}

              <Button type="submit" size="lg" className="w-full h-12 font-bold" disabled={submitting} data-testid="button-submit-cadastro">
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registrando cadastro...</> : <>Continuar para pagamento — {PLANS[selectedPlan]?.price ?? ""} <ArrowRight className="h-4 w-4 ml-2" /></>}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Acesso liberado somente após pagamento confirmado.
              </p>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
