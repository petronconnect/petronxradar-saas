import { Link } from "wouter";
import { useMemo, useState } from "react";
import { useGetDashboardSummary, useGetDashboardRecentActivity, useGetDashboardSectorBreakdown, useListOpportunities, type Opportunity, type ActivityItem } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Target, FileText, Users, Activity, ArrowUpRight, CircleHelp, Clock3, Radar, Building2 } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { useAuth } from "@/contexts/AuthContext";

const sectorColor = (sector: string) => {
  const hue = [...sector].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 17);
  return `hsl(${hue} 54% 62%)`;
};
const dateValue = (raw?: string | null) => {
  if (!raw) return null;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const value = br
    ? new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 23, 59, 59, 999)
    : isoDate
      ? new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]), 23, 59, 59, 999)
      : new Date(raw);
  return Number.isNaN(value.getTime()) ? null : value;
};
const relative = (raw: string) => {
  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) return null;
  const delta = Date.now() - time;
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} d`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "há 1 mês" : `há ${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? "há 1 ano" : `há ${years} anos`;
};
const isClosed = (status: string) => {
  const normalized = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  return /(closed|cancel|encerr|conclu|finaliz|ganh|perdid|expir|termin|desist|anulad|revog)/i.test(normalized);
};
const getDeadline = (op: Opportunity) => dateValue(op.deadline);

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary, isError: errorSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: loadingActivity, isError: errorActivity, refetch: retryActivity } = useGetDashboardRecentActivity();
  const { data: sectors, isLoading: loadingSectors, isError: errorSectors, refetch: retrySectors } = useGetDashboardSectorBreakdown();
  const { data: opportunities, isLoading: loadingOpps, isError: errorOpps, refetch: retryOpportunities } = useListOpportunities();
  const { isAdmin, user } = useAuth();
  const [activityFilter, setActivityFilter] = useState<"all" | "opportunity" | "bulletin">("all");
  const [showAllActivity, setShowAllActivity] = useState(false);

  const chartSectors = useMemo(() => {
    const grouped = [...(sectors ?? [])].map((s) => ({ sector: s.sector, count: Math.max(0, Math.trunc(s.count ?? 0)) }))
      .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector, "pt-BR"));
    const total = grouped.reduce((n, s) => n + s.count, 0);
    return grouped.map((s) => ({ ...s, percentage: total ? (s.count / total) * 100 : 0, color: sectorColor(s.sector) }));
  }, [sectors]);
  const chartTotal = chartSectors.reduce((n, s) => n + s.count, 0);
  let cursor = 0;
  const chartGradient = chartSectors.map((s) => {
    const start = cursor;
    cursor += chartTotal ? s.count / chartTotal * 100 : 0;
    return `${s.color} ${start}% ${cursor}%`;
  }).join(", ");

  const upcoming = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfWindow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999).getTime();
    return [...(opportunities ?? [])].map((op) => ({ op, deadline: getDeadline(op) }))
      .filter((entry): entry is { op: Opportunity; deadline: Date } => !!entry.deadline && entry.deadline.getTime() >= startToday && entry.deadline.getTime() <= endOfWindow && !isClosed(entry.op.status))
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime()).slice(0, 5);
  }, [opportunities]);

  const visibleActivity = useMemo(() => {
    const rows = (activity ?? []).filter((a) => activityFilter === "all" || a.type === activityFilter);
    return showAllActivity ? rows : rows.slice(0, 5);
  }, [activity, activityFilter, showAllActivity]);
  const latestRecord = useMemo(() => {
    const candidates = [
      ...(activity ?? []).map((a) => a.createdAt),
      ...(opportunities ?? []).map((o) => o.createdAt),
    ].map((raw) => ({ raw, time: new Date(raw).getTime() })).filter((x) => Number.isFinite(x.time));
    candidates.sort((a, b) => b.time - a.time);
    return candidates[0]?.raw;
  }, [activity, opportunities]);

  const metric = (title: string, value: number | undefined, monthValue: number | undefined, icon: typeof Target, href: string, color = "text-primary", helper: string) => (
    <Link href={href} data-testid={`link-metric-${title.toLowerCase().replace(/\s+/g, "-")}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Card className="h-full border-border bg-card transition-colors hover:border-primary/50 hover:bg-card/90">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-foreground/85">{title}</CardTitle>
          {(() => { const Icon = icon; return <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />; })()}
        </CardHeader>
        <CardContent>
          {loadingSummary ? <div className="h-8 w-20 animate-pulse rounded bg-muted" /> : errorSummary ? (
            <span className="text-sm text-foreground/70">Dados indisponíveis agora.</span>
          ) : <>
            <div className="text-2xl font-semibold tabular-nums" data-testid={`value-metric-${title.toLowerCase().replace(/\s+/g, "-")}`}>{(value ?? 0).toLocaleString("pt-BR")}</div>
            <p className="mt-1 text-xs text-muted-foreground">{monthValue === undefined ? helper : monthValue === 0 ? "Sem variação este mês" : `+${monthValue.toLocaleString("pt-BR")} este mês`}</p>
            <p className="mt-2 text-[11px] text-foreground/70">{helper}</p>
          </>}
        </CardContent>
      </Card>
    </Link>
  );

  const activityHref = (item: ActivityItem) => item.type === "opportunity"
    ? `/oportunidades?q=${encodeURIComponent(item.title)}`
    : `/boletins?q=${encodeURIComponent(item.title)}`;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Visão de mercado</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Painel de Controle</h1>
          <p className="mt-1 text-sm text-foreground/70">Catálogo global de oportunidades, sinais recentes e prazos próximos.</p>
        </div>
        <div className="rounded-lg border border-border bg-card/70 px-3 py-2 text-xs text-foreground/75" data-testid="text-radar-freshness">
          <span className="font-medium text-foreground">Último registro no radar</span>
          {latestRecord ? <span className="ml-2">{relative(latestRecord)} · {formatDate(latestRecord)}</span> : <span className="ml-2">Nenhum registro recente disponível</span>}
          <p className="mt-1 text-[11px] text-muted-foreground">Este horário não comprova sincronização com a Petronect.</p>
        </div>
      </header>

      <section className={`grid gap-3 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-4" : "xl:grid-cols-3"}`} aria-label="Indicadores do radar">
        {metric("Oportunidades no catálogo global", summary?.totalOpportunities, summary?.opportunitiesThisMonth, Target, "/oportunidades", "text-primary", "Registros disponíveis no catálogo para consulta.")}
        {metric("Boletins visíveis para você", summary?.totalBulletins, summary?.bulletinsThisMonth, FileText, "/boletins", "text-sky-300", "Boletins públicos e os autorizados à sua empresa.")}
        {isAdmin && metric("Registros comerciais de clientes", summary?.totalClients, undefined, Users, "/clientes", "text-teal-300", "Cadastros comerciais; não representa assinaturas ativas.")}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-foreground/85">Radar Score</CardTitle>
              <TooltipProvider><Tooltip><TooltipTrigger asChild><button aria-label="O que mede o Radar Score?" className="rounded-full text-foreground/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="button-radar-score-help"><CircleHelp className="h-4 w-4" /></button></TooltipTrigger><TooltipContent className="max-w-xs text-sm">Índice determinístico do catálogo global. Não é previsão nem pontuação específica da sua empresa.</TooltipContent></Tooltip></TooltipProvider>
            </div>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? <div className="h-8 w-20 animate-pulse rounded bg-muted" /> : <div className="text-2xl font-semibold tabular-nums text-primary">{summary?.radarScore ?? 0}<span className="text-sm text-muted-foreground">/100</span></div>}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-[width]" style={{ width: `${Math.max(0, Math.min(100, summary?.radarScore ?? 0))}%` }} /></div>
            <p className="mt-2 text-xs leading-relaxed text-foreground/70">Volume global até 40 · atividade mensal até 30 · diversidade de setores até 30, ponderada pela cobertura classificada.</p>
            <Dialog>
              <DialogTrigger asChild><Button variant="link" className="mt-1 h-auto p-0 text-xs text-primary" data-testid="button-radar-score-how-to">Como melhorar</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Como o Radar Score é formado</DialogTitle><DialogDescription className="space-y-2 pt-2 text-left text-foreground/80">
                  <span className="block">O índice determinístico reflete o catálogo global: volume de oportunidades (até 40 pontos), atividade do mês (até 30) e diversidade setorial (até 30), ponderada pela cobertura de setores classificados.</span>
                  <span className="block">Ele descreve o catálogo; não prevê resultados e não mede aderência à sua empresa. O índice cresce quando o catálogo global amplia o volume e a atividade mensal e quando mais registros têm setor classificado. Isso não depende de uma pontuação individual da sua empresa.</span>
                </DialogDescription></DialogHeader>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </section>

      {isAdmin && (summary?.totalClients ?? 0) === 0 && !loadingSummary && (
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><Building2 className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">Nenhum registro comercial de cliente</p><p className="text-sm text-foreground/70">Cadastre e acompanhe contas comerciais em um só lugar.</p></div></div>
            <Link href="/clientes"><Button variant="outline" data-testid="link-empty-clients">Abrir clientes <ArrowUpRight className="ml-2 h-4 w-4" /></Button></Link>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2"><CardTitle>Oportunidades por setor</CardTitle><CardDescription>Distribuição por quantidade de oportunidades — não por valor financeiro.</CardDescription></CardHeader>
          <CardContent>
            {loadingSectors ? <div className="grid gap-5 pt-2 sm:grid-cols-2"><div className="mx-auto aspect-square w-full max-w-[230px] animate-pulse rounded-full bg-muted" /><div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-6 animate-pulse rounded bg-muted" />)}</div></div>
              : errorSectors ? <div className="py-8 text-center"><p className="text-sm text-foreground/70">Não foi possível carregar a distribuição por setor.</p><Button variant="link" onClick={() => void retrySectors()} data-testid="button-retry-sectors">Tentar novamente</Button></div>
              : chartSectors.length ? <div data-testid="chart-sector-breakdown" className="grid gap-5 sm:grid-cols-[minmax(170px,.85fr)_minmax(0,1.15fr)] sm:items-center">
                <div className="mx-auto aspect-square w-full max-w-[230px] rounded-full border-4 border-card" style={{ background: `conic-gradient(from -90deg, ${chartGradient})` }} role="img" aria-label={`Gráfico de setores por quantidade: ${chartSectors.map(s => `${s.sector}, ${s.count} oportunidades`).join("; ")}`} data-testid="chart-sector-pie" />
                <div className="space-y-1">
                  {chartSectors.map((s, i) => <Link key={s.sector} href={`/oportunidades?sector=${encodeURIComponent(s.sector)}`} data-testid={`link-sector-${i}`} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <span className="flex min-w-0 items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} /><span className="truncate text-foreground/90">{s.sector}</span></span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-foreground/80">{s.count.toLocaleString("pt-BR")} <span className="text-muted-foreground">· {s.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span></span>
                  </Link>)}
                </div>
                <p className="text-xs leading-relaxed text-foreground/65 sm:col-span-2">{chartTotal.toLocaleString("pt-BR")} oportunidades na distribuição. {chartSectors.some((sector) => sector.sector.trim().toLocaleLowerCase("pt-BR") === "outros") ? "“Outros” permanece como categoria fornecida pelo catálogo; não é subdividida sem evidência." : "As categorias seguem os setores informados no catálogo."}</p>
              </div>
              : <div className="py-10 text-center text-sm text-foreground/70">Nenhum dado de setor disponível.</div>}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />Prazos próximos</CardTitle><CardDescription>Oportunidades abertas do catálogo com prazo nos próximos 7 dias.</CardDescription></CardHeader>
          <CardContent>
            {loadingOpps ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 animate-pulse rounded bg-muted" />)}</div> : errorOpps ? <div className="py-6 text-center"><p className="text-sm text-foreground/70">Não foi possível verificar prazos agora.</p><Button variant="link" onClick={() => void retryOpportunities()} data-testid="button-retry-deadlines">Tentar novamente</Button></div> : upcoming.length ? <div className="space-y-2">
              {upcoming.map(({ op, deadline }) => {
                const days = Math.ceil((new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate()).getTime() - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()) / 86400000);
                return <Link key={op.id} href={`/oportunidades?q=${encodeURIComponent(op.title)}`} data-testid={`link-deadline-${op.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-background/45 p-3 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{op.title}</span><span className="mt-1 block truncate text-xs text-foreground/65">{op.company} · {op.sector}</span></span>
                  <span className="shrink-0 text-right"><span className="block text-xs font-medium text-primary">{days === 0 ? "Hoje" : days === 1 ? "Amanhã" : `Em ${days} dias`}</span><span className="text-[11px] text-foreground/65">{deadline.toLocaleDateString("pt-BR")}</span></span>
                </Link>;
              })}
            </div> : <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center"><p className="text-sm font-medium">Sem prazos identificados para os próximos 7 dias</p><p className="mt-1 text-xs text-foreground/65">Somente oportunidades com prazo conhecido e status não encerrado aparecem aqui.</p></div>}
            <div className="mt-4 rounded-lg bg-muted/60 p-3">
              <p className="text-xs leading-relaxed text-foreground/75">Este painel ordena prazos; não calcula aderência da empresa. Consulte o Radar 360 para verificar o perfil e a compatibilidade.</p>
              <Link href="/radar-360"><Button variant="link" className="mt-1 h-auto p-0 text-xs" data-testid="link-radar-360-fit"><Radar className="mr-1 h-3 w-3" />Abrir Radar 360</Button></Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div><CardTitle>Atividade recente</CardTitle><CardDescription>Até 50 registros autorizados mais recentes, conforme o acesso da sua conta.</CardDescription></div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar atividade">
              {([["all","Tudo"],["opportunity","Oportunidades"],["bulletin","Boletins"]] as const).map(([value,label]) => <Button key={value} variant={activityFilter === value ? "secondary" : "ghost"} size="sm" onClick={() => { setActivityFilter(value); setShowAllActivity(false); }} data-testid={`button-activity-filter-${value}`} aria-pressed={activityFilter === value}>{label}</Button>)}
            </div>
          </CardHeader>
          <CardContent>
            {loadingActivity ? <div className="space-y-4">{[1,2,3,4].map(i => <div key={i} className="flex gap-3"><div className="h-9 w-9 animate-pulse rounded-full bg-muted" /><div className="flex-1 space-y-2"><div className="h-4 w-3/4 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /></div></div>)}</div>
              : errorActivity ? <div className="py-6 text-center"><p className="text-sm text-foreground/75">Não foi possível carregar a atividade.</p><Button variant="link" onClick={() => void retryActivity()} data-testid="button-retry-activity">Tentar novamente</Button></div>
              : visibleActivity.length ? <div className="divide-y divide-border/70">
                {visibleActivity.map((a, i) => { const bulletin = a.type === "bulletin"; const Icon = bulletin ? FileText : Target; return <Link key={`${a.type}-${a.id}`} href={activityHref(a)} data-testid={`link-activity-${a.id}`} className="flex gap-3 py-3 first:pt-0 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bulletin ? "bg-sky-400/10 text-sky-300" : "bg-primary/10 text-primary"}`}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a.title}</span><span className="mt-1 block truncate text-xs text-foreground/70">{a.description}</span>{a.reference && <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">Referência: {a.reference}</span>}</span>
                  <time className="shrink-0 text-right text-[11px] text-foreground/70" dateTime={a.createdAt} title={formatDate(a.createdAt)}>
                    <span className="block">{relative(a.createdAt) ?? formatDate(a.createdAt)}</span>
                    <span className="block text-[10px] text-muted-foreground">{formatDate(a.createdAt)}</span>
                  </time>
                </Link>; })}
                {(activity?.filter(a => activityFilter === "all" || a.type === activityFilter).length ?? 0) > 5 && <Button variant="link" className="mt-2 px-0 text-primary" onClick={() => setShowAllActivity(v => !v)} data-testid="button-activity-expand">{showAllActivity ? "Mostrar menos" : "Ver tudo (até 50 registros)"}</Button>}
              </div> : <div className="py-8 text-center"><Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" /><p className="text-sm text-foreground/70">Nenhum registro recente disponível.</p></div>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle>Sua empresa</CardTitle><CardDescription>Atalhos da conta autenticada.</CardDescription></CardHeader>
            <CardContent>
              <p className="mb-3 text-sm font-medium" data-testid="text-company-name">{user?.companyName || "Empresa não informada"}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <Link href="/meu-perfil" className="rounded-md border border-border px-3 py-2 text-sm text-foreground/85 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="link-company-profile">Meu perfil <ArrowUpRight className="inline h-3.5 w-3.5" /></Link>
                <Link href="/minha-assinatura" className="rounded-md border border-border px-3 py-2 text-sm text-foreground/85 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="link-company-subscription">Minha assinatura <ArrowUpRight className="inline h-3.5 w-3.5" /></Link>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
            <CardHeader><CardTitle>Catálogo em foco</CardTitle><CardDescription>Consulte registros e refine por setor ou prazo.</CardDescription></CardHeader>
            <CardContent><Link href="/oportunidades"><Button className="w-full" data-testid="button-open-opportunities">Explorar oportunidades <ArrowUpRight className="ml-2 h-4 w-4" /></Button></Link></CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
