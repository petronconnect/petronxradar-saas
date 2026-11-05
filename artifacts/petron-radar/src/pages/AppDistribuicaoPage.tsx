import { motion } from "framer-motion";
import {
  Globe,
  Smartphone,
  CheckCircle2,
  Clock,
  Apple,
  Monitor,
  Download,
  Share2,
  ArrowRight,
  Star,
  Zap,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { InstallButton } from "@/components/pwa/InstallButton";

const CHANNELS = [
  {
    id: "web",
    icon: Globe,
    name: "Web App",
    description: "Acesso via navegador em qualquer dispositivo. Sem instalação obrigatória.",
    status: "ativo",
    statusLabel: "Ativo",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    badge: "bg-green-500/15 text-green-400 border-green-500/30",
    url: typeof window !== "undefined" ? window.location.origin + import.meta.env.BASE_URL : "",
    actions: ["Compartilhar link", "Enviar por e-mail"],
  },
  {
    id: "pwa",
    icon: Smartphone,
    name: "PWA Instalável",
    description: "Instale o Petron Radar na tela inicial do celular ou desktop — funciona offline e abre como app nativo.",
    status: "ativo",
    statusLabel: "Disponível",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    features: ["Funciona offline (cache básico)", "Tela inicial do celular", "Sem loja de apps", "Atualizações automáticas"],
  },
  {
    id: "android",
    icon: Smartphone,
    name: "Google Play",
    description: "App Android nativo publicado na Google Play Store. Distribuição via TWA (Trusted Web Activity) derivado da PWA.",
    status: "futuro",
    statusLabel: "Em breve",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    features: ["TWA + Play Store", "Push notifications nativas", "Google Sign-In", "Play Billing opcional"],
  },
  {
    id: "windows",
    icon: Monitor,
    name: "Microsoft Store",
    description: "App Windows instalável via Microsoft Store. Derivado da PWA com integração MSIX.",
    status: "futuro",
    statusLabel: "Em breve",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    features: ["MSIX via PWABuilder", "Atalho no menu Iniciar", "Notificações Windows", "Auto-update via Store"],
  },
  {
    id: "ios",
    icon: Apple,
    name: "App Store (iOS)",
    description: "App iOS nativo. Requer conta Apple Developer, build React Native ou Capacitor, e aprovação da App Store.",
    status: "planejado",
    statusLabel: "Futuro",
    color: "text-muted-foreground",
    bg: "bg-muted/30 border-border",
    badge: "bg-muted/50 text-muted-foreground border-border",
    features: ["React Native ou Capacitor", "Apple Developer Account", "App Store Review", "In-App Purchase iOS"],
  },
];

const ROADMAP = [
  { step: 1, label: "Web App", done: true, desc: "SaaS B2B rodando em produção" },
  { step: 2, label: "PWA instalável", done: true, desc: "Manifest + Service Worker configurados" },
  { step: 3, label: "Google Play (TWA)", done: false, desc: "Publicar no Play Store via TWA" },
  { step: 4, label: "Microsoft Store", done: false, desc: "Publicar via PWABuilder + MSIX" },
  { step: 5, label: "App Store iOS", done: false, desc: "App nativo React Native / Capacitor" },
];

export default function AppDistribuicaoPage() {
  const appUrl = typeof window !== "undefined"
    ? window.location.origin + import.meta.env.BASE_URL
    : "";

  function copyUrl() {
    navigator.clipboard.writeText(appUrl).catch(() => {});
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold">Distribuição do App</h1>
            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
              2 canais ativos
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Status dos canais de distribuição do Petron Radar Premium. Estratégia progressiva:
            Web → PWA → Google Play → Microsoft Store → App Store iOS.
          </p>
        </div>
        <InstallButton variant="default" size="default" className="bg-primary text-primary-foreground hover:bg-primary/90" />
      </div>

      {/* Roadmap */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Roadmap de Distribuição
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {ROADMAP.map((r, i) => (
              <div key={r.step} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold ${
                    r.done
                      ? "bg-green-500/10 border-green-500/50 text-green-400"
                      : "bg-muted/30 border-border text-muted-foreground"
                  }`}>
                    {r.done ? <CheckCircle2 className="w-4 h-4" /> : r.step}
                  </div>
                  <p className="text-xs font-medium text-center leading-tight">{r.label}</p>
                  <p className="text-[10px] text-muted-foreground text-center leading-tight max-w-[90px]">{r.desc}</p>
                </div>
                {i < ROADMAP.length - 1 && (
                  <div className={`h-0.5 w-6 mx-1 rounded-full flex-shrink-0 ${
                    r.done && ROADMAP[i + 1].done ? "bg-green-500/50" : "bg-border"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Channels grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {CHANNELS.map((ch, i) => {
          const Icon = ch.icon;
          return (
            <motion.div
              key={ch.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <Card className={`border h-full ${ch.bg}`}>
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${ch.bg}`}>
                        <Icon className={`w-5 h-5 ${ch.color}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{ch.name}</p>
                      </div>
                    </div>
                    <Badge className={`text-[11px] font-medium border ${ch.badge}`}>
                      {ch.statusLabel}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {ch.description}
                  </p>

                  {ch.features && (
                    <ul className="space-y-1.5 mb-4">
                      {ch.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className={`w-1 h-1 rounded-full flex-shrink-0 ${ch.color.replace("text-", "bg-")}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  {ch.id === "web" && (
                    <div className="mt-auto space-y-2">
                      <div className="flex items-center gap-2 bg-background/40 rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground overflow-hidden">
                        <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{appUrl}</span>
                      </div>
                      <Button variant="outline" size="sm" className="w-full gap-1.5 border-border" onClick={copyUrl}>
                        <Share2 className="w-3.5 h-3.5" />
                        Copiar link de acesso
                      </Button>
                    </div>
                  )}

                  {ch.id === "pwa" && (
                    <div className="mt-auto">
                      <InstallButton
                        variant="default"
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      />
                      <div className="flex items-center gap-3 mt-3">
                        {[
                          { icon: Zap, label: "Acesso rápido" },
                          { icon: Shield, label: "Seguro" },
                          { icon: Star, label: "Offline" },
                        ].map(({ icon: I, label }) => (
                          <div key={label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <I className="w-3 h-3 text-blue-400" />
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(ch.id === "android" || ch.id === "windows") && (
                    <div className="mt-auto">
                      <Button variant="outline" size="sm" className="w-full border-border gap-1.5 text-muted-foreground" disabled>
                        <Clock className="w-3.5 h-3.5" />
                        Em desenvolvimento
                      </Button>
                    </div>
                  )}

                  {ch.id === "ios" && (
                    <div className="mt-auto">
                      <Button variant="outline" size="sm" className="w-full border-border gap-1.5 text-muted-foreground" disabled>
                        <ArrowRight className="w-3.5 h-3.5" />
                        Planejado para 2025
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* PWA install guide */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            Como instalar a PWA agora
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                title: "Android / Chrome",
                steps: ["Abra o Petron Radar no Chrome", "Toque no menu ⋮ (três pontos)", 'Toque em "Adicionar à tela inicial"', "Confirme a instalação"],
              },
              {
                title: "iPhone / Safari",
                steps: ["Abra o Petron Radar no Safari", "Toque no ícone de Compartilhar ⬆", '"Adicionar à Tela de Início"', "Toque em Adicionar"],
              },
              {
                title: "Desktop Chrome / Edge",
                steps: ['Clique em "Instalar App" na barra de endereço', "Ou use o botão Instalar no app", "Confirme a instalação", "Acesse pelo atalho criado"],
              },
            ].map((guide) => (
              <div key={guide.title} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{guide.title}</p>
                <ol className="space-y-1">
                  {guide.steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator className="opacity-30" />
      <p className="text-xs text-muted-foreground">
        A PWA usa service worker com cache inteligente — carregamento rápido mesmo com conexão lenta.
        Google Play e Microsoft Store serão lançados a partir do mesmo código (TWA / PWABuilder), sem reescrita.
      </p>
    </div>
  );
}
