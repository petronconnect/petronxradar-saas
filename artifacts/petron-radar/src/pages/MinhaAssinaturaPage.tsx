import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  CheckCircle2, Calendar, Building2, CreditCard, ArrowUpRight,
  Zap, Sparkles, Building, Loader2, Phone, Mail, MapPin, Users
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const PLAN_INFO: Record<string, { name: string; color: string; icon: any; features: string[] }> = {
  "radar-lancamento": {
    name: "Condição de Lançamento", color: "text-amber-400",
    icon: Sparkles,
    features: ["50 oportunidades/mês", "4 boletins/mês", "2 usuários", "Suporte prioritário WhatsApp", "Onboarding guiado (3 sessões)", "Selo Empresa Fundadora"],
  },
  "radar-starter": {
    name: "Radar Starter", color: "text-zinc-400",
    icon: Zap,
    features: ["10 oportunidades/mês", "5 boletins/mês", "1 usuário", "Filtros por setor e região", "Exportação CSV"],
  },
  "radar-pro": {
    name: "Radar Pro", color: "text-primary",
    icon: Sparkles,
    features: ["50 oportunidades/mês", "30 boletins/mês", "5 usuários", "IA proprietária", "Alertas automáticos", "Dashboard analytics completo"],
  },
  "radar-enterprise": {
    name: "Radar Enterprise", color: "text-indigo-400",
    icon: Building,
    features: ["Oportunidades ilimitadas", "Boletins ilimitados", "Usuários ilimitados", "API de integração", "Relatórios customizados", "SLA 99,5%", "Gerente de conta exclusivo"],
  },
  "radar-ia-managed": {
    name: "Radar IA Managed", color: "text-amber-500",
    icon: Sparkles,
    features: ["Gestão operacional pela equipe Petron", "Curadoria ativa de oportunidades", "Relatórios executivos mensais", "Reuniões de estratégia mensais", "SLA 99,9%", "Suporte 24/7"],
  },
};

const STATUS_BADGES: Record<string, string> = {
  ativo: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  suspenso: "bg-red-500/10 text-red-500 border-red-500/20",
  inativo: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

interface Subscription {
  id: number; company_id: number; plan_slug: string; status: string;
  start_date: string; renewal_date: string; last_payment_at: string | null;
  last_payment_amount: number | null; next_billing_amount: number | null;
  razao_social: string; nome_fantasia: string; cnpj: string;
}

interface Company {
  id: number; razao_social: string; nome_fantasia: string; cnpj: string;
  cidade: string; estado: string; email: string; telefone: string | null;
  segmento: string; socio_administrador: string | null; capital_social: number | null;
  status: string;
}

export default function MinhaAssinaturaPage() {
  const { user } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/subscriptions/my").catch(() => null),
      apiFetch(`/api/companies/${user?.companyId}`).catch(() => null),
    ]).then(([subData, compData]) => {
      setSub(subData as Subscription | null);
      setCompany(compData as Company | null);
    }).finally(() => setLoading(false));
  }, [user?.companyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const planInfo = sub ? (PLAN_INFO[sub.plan_slug] ?? null) : null;
  const PlanIcon = planInfo?.icon ?? CreditCard;

  const today = new Date();
  const renewal = sub ? new Date(sub.renewal_date) : null;
  const daysLeft = renewal ? Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Minha Assinatura</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Detalhes do plano e dados da sua empresa
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Plano Atual */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <PlanIcon className={`h-5 w-5 ${planInfo?.color ?? "text-muted-foreground"}`} />
              <CardTitle className="text-base">Plano Atual</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {sub ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${planInfo?.color ?? "text-foreground"}`}>
                    {planInfo?.name ?? sub.plan_slug}
                  </span>
                  <Badge className={`text-xs border ${STATUS_BADGES[sub.status] ?? STATUS_BADGES.inativo}`}>
                    {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Início</p>
                    <p className="font-medium mt-0.5">{sub.start_date}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${daysLeft !== null && daysLeft <= 7 ? "bg-amber-500/10" : "bg-secondary/50"}`}>
                    <p className="text-xs text-muted-foreground">Renovação</p>
                    <p className={`font-medium mt-0.5 ${daysLeft !== null && daysLeft <= 7 ? "text-amber-500" : ""}`}>
                      {sub.renewal_date}
                      {daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && (
                        <span className="block text-xs">{daysLeft} dia{daysLeft !== 1 ? "s" : ""}</span>
                      )}
                    </p>
                  </div>
                </div>

                {sub.last_payment_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Último pagamento: R$ {sub.last_payment_amount?.toLocaleString("pt-BR") ?? "—"}</span>
                  </div>
                )}

                <Link href="/planos">
                  <Button variant="outline" className="w-full justify-between mt-2">
                    <span>Fazer Upgrade de Plano</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhuma assinatura ativa</p>
                <Link href="/planos">
                  <Button size="sm" className="mt-3">Ver Planos</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dados da Empresa */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Dados da Empresa</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {company ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Razão Social</p>
                  <p className="font-medium mt-0.5">{company.razao_social}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Nome Fantasia</p>
                    <p className="font-medium mt-0.5">{company.nome_fantasia}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">CNPJ</p>
                    <p className="font-medium mt-0.5">{company.cnpj}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{company.cidade} / {company.estado}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{company.email}</span>
                </div>
                {company.telefone && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{company.telefone}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{company.segmento}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Dados não disponíveis</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Benefícios do Plano */}
      {planInfo && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Benefícios Inclusos no Plano</CardTitle>
            <CardDescription>{planInfo.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {planInfo.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suporte */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Suporte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.open("https://wa.me/5513998035663?text=Olá!%20Preciso%20de%20suporte%20no%20Petron%20Radar.", "_blank")}
            >
              WhatsApp Suporte
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <a href="mailto:suporte@petronradar.com.br">E-mail Suporte</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
