import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  Lock,
  Target,
  Briefcase,
  FileText,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Rocket,
} from "lucide-react";
import { useLocation } from "wouter";
import { trackEvent } from "@/lib/analytics";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

const TOUR_STEPS = [
  {
    icon: Target,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    title: "Radar de Oportunidades",
    description:
      "Monitore licitações ativas da Petrobras/Petronect filtradas por setor, região e prazo. Cada oportunidade tem análise Petron Radar com score e próximos passos.",
  },
  {
    icon: Briefcase,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    title: "Meu Portfólio",
    description:
      'Adicione as oportunidades que pretende disputar. Acompanhe cada estágio — Avaliando, Vou Licitar, Orçando, Enviada — com notas da equipe.',
  },
  {
    icon: FileText,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    title: "Boletins de Inteligência",
    description:
      "Receba boletins exclusivos com análise de mercado O&G, tendências Petronect e curadoria de oportunidades estratégicas para a sua empresa.",
  },
];

export function WelcomeOnboarding() {
  const { user, refreshUser } = useAuth();
  const [location, navigate] = useLocation();
  // Keep the page the user was heading to; only the bare home goes to bulletins.
  const finishTarget = location && location !== "/" ? null : "/boletins";
  const [step, setStep] = useState(0);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  // Capture once on mount so the step list stays stable even after the user's
  // mustSetPassword / onboarding flags flip mid-flow (otherwise the array would
  // shrink and the current step index would point past the end → blank modal).
  const [needsPassword] = useState(() => user?.mustSetPassword ?? false);
  const isPetronAdmin = user?.role === "ADMIN_PETRON";
  const [showTour] = useState(() => {
    const isClient =
      user?.role === "CLIENTE_ADMIN" || user?.role === "USUARIO_CLIENTE";
    return isClient && !(user?.onboardingCompleted ?? false);
  });
  const companyName = user?.companyName ?? "";

  const STEPS = [
    "welcome",
    ...(needsPassword ? ["password"] : []),
    ...(showTour ? TOUR_STEPS.map((_, i) => `tour-${i}`) : []),
    "done",
  ];
  const totalSteps = STEPS.length;
  const currentId = STEPS[step];

  async function handleSetPassword() {
    if (password.length < 8) {
      setPwError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setPwError("As senhas não coincidem.");
      return;
    }
    setPwError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      trackEvent("onboarding_password_set");
      await refreshUser();
      setStep((s) => s + 1);
    } catch (e: any) {
      setPwError(e.message ?? "Erro ao definir senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFinish() {
    setLoading(true);
    setFinishError(null);
    try {
      await apiFetch("/api/auth/complete-onboarding", { method: "POST" });
      trackEvent("client_onboarding_completed");
      await refreshUser();
      if (finishTarget) navigate(finishTarget, { replace: true });
    } catch (e: any) {
      setFinishError(e?.message && !/^HTTP \d+$/.test(e.message) ? e.message : "Não foi possível concluir a configuração. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (step < totalSteps - 1) setStep((s) => s + 1);
  }

  const tourIndex = currentId?.startsWith("tour-") ? parseInt(currentId.split("-")[1]) : -1;
  const tourStep = tourIndex >= 0 ? TOUR_STEPS[tourIndex] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentId}
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Progress bar */}
          <div className="h-1 bg-border">
            <div
              className="h-1 bg-primary transition-all duration-500"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>

          <div className="p-8">
            {/* Step: Boas-vindas */}
            {currentId === "welcome" && (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <Rocket className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    Bem-vindo ao Petron Radar!
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {companyName ? (
                      <>
                        A <strong className="text-foreground">{companyName}</strong> agora tem acesso
                        à inteligência de licitações Petronect. Vamos configurar sua conta em 2 minutos.
                      </>
                    ) : (
                      isPetronAdmin
                        ? "Seu acesso administrativo foi recuperado. Antes de continuar, você precisa substituir a senha temporária."
                        : "Sua conta está ativa. Vamos configurar tudo em 2 minutos."
                    )}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs text-center">
                  {[
                    { icon: ShieldCheck, label: "Acesso seguro" },
                    { icon: Target, label: "Radar ativo" },
                    { icon: FileText, label: "Boletins exclusivos" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="bg-muted/30 rounded-xl p-3 space-y-2">
                      <Icon className="w-5 h-5 text-primary mx-auto" />
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={next} size="lg" className="w-full h-12 font-bold">
                  Vamos começar <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Step: Definir senha */}
            {currentId === "password" && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-7 h-7 text-amber-400" />
                  </div>
                  <h2 className="text-xl font-bold mb-1">Defina sua senha</h2>
                  <p className="text-sm text-muted-foreground">
                    {isPetronAdmin
                      ? "Este acesso usa uma senha temporária de recuperação. Defina uma senha pessoal segura para continuar."
                      : "Criamos sua conta automaticamente. Defina uma senha pessoal segura."}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Nova senha</Label>
                    <div className="relative">
                      <Input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setPwError(null); }}
                        placeholder="Mínimo 8 caracteres"
                        className="h-11 pr-10 bg-muted/30 border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Confirmar senha</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPwError(null); }}
                      placeholder="Repita a senha"
                      className="h-11 bg-muted/30 border-border"
                    />
                  </div>
                  {pwError && (
                    <p className="text-xs text-red-400">{pwError}</p>
                  )}
                </div>

                <Button
                  onClick={handleSetPassword}
                  disabled={loading || !password || !confirmPassword}
                  size="lg"
                  className="w-full h-12 font-bold"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Salvar senha <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Tour steps */}
            {tourStep && (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
                    Funcionalidade {tourIndex + 1} de {TOUR_STEPS.length}
                  </p>
                  <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-5 ${tourStep.bg}`}>
                    <tourStep.icon className={`w-7 h-7 ${tourStep.color}`} />
                  </div>
                  <h2 className="text-xl font-bold mb-3">{tourStep.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {tourStep.description}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-1.5">
                    {TOUR_STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          i === tourIndex ? "w-6 bg-primary" : "w-1.5 bg-border"
                        }`}
                      />
                    ))}
                  </div>
                  <Button onClick={next} className="gap-2">
                    Próximo <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Done */}
            {currentId === "done" && (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">Tudo pronto!</h2>
                  <p className="text-sm text-muted-foreground">
                    Seu primeiro boletim personalizado já está disponível. Vamos lá?
                  </p>
                </div>
                {finishError && (
                  <p className="text-xs text-red-400" data-testid="text-onboarding-error">{finishError}</p>
                )}
                <Button
                  onClick={handleFinish}
                  disabled={loading}
                  size="lg"
                  className="w-full h-12 font-bold"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 mr-2" />
                  )}
                  {finishTarget ? "Ver meu primeiro boletim" : "Continuar para a página solicitada"}
                </Button>
              </div>
            )}
          </div>

          {/* Step counter */}
          <div className="px-8 pb-4 text-center">
            <p className="text-xs text-muted-foreground/50">
              {step + 1} de {totalSteps}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
