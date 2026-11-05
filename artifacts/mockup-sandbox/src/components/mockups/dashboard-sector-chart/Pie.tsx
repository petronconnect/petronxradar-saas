import "./_group.css";
import { Activity, AlertTriangle, FileText, Target, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const sectors = [
  { sector: "Não informado", count: 287, color: "hsl(var(--chart-1))" },
  { sector: "Upstream", count: 3, color: "hsl(var(--chart-2))" },
  { sector: "Midstream", count: 2, color: "hsl(var(--chart-3))" },
  { sector: "Tecnologia", count: 2, color: "hsl(var(--chart-4))" },
  { sector: "Demais setores", count: 13, color: "hsl(var(--chart-5))" },
];

function MetricCard({ title, value, icon, tint, detail }: {
  title: string; value: string; icon: React.ReactNode; tint: string; detail?: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border bg-card">
      <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-bl-full ${tint}`} />
      <CardHeader className="relative z-10 flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {detail && <p className="mt-1 flex items-center text-xs text-muted-foreground"><TrendingUp className="mr-1 h-3 w-3 text-emerald-500" />{detail}</p>}
      </CardContent>
    </Card>
  );
}

export function Pie() {
  const total = sectors.reduce((sum, item) => sum + item.count, 0);
  const opportunitiesThisMonth = 287;
  const classifiedCount = total - sectors[0]!.count;
  const classifiedSectors = 16;
  const volumePoints = Math.min(total, 40);
  const activityPoints = Math.min(opportunitiesThisMonth, 20) * 1.5;
  const coveragePoints = Math.min(classifiedSectors, 10) * 3 * (total ? classifiedCount / total : 0);
  const proposedScore = Math.min(100, Math.round(volumePoints + activityPoints + coveragePoints));
  let cursor = 0;
  const gradient = sectors.map((item) => {
    const start = cursor;
    cursor += (item.count / total) * 100;
    return `${item.color} ${start}% ${cursor}%`;
  }).join(", ");

  return (
    <main className="dark min-h-screen bg-background p-5 font-sans text-foreground sm:p-7">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Petron Radar · Painel</p>
            <h1 className="text-2xl font-bold tracking-tight">Painel de Controle</h1>
            <p className="mt-1 text-sm text-muted-foreground">Visão global do mercado e oportunidades monitoradas.</p>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground">Snapshot real do ambiente de desenvolvimento</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total Oportunidades" value={total.toLocaleString("pt-BR")} icon={<Target className="h-4 w-4 text-primary" />} tint="bg-primary/5" detail="+287 este mês" />
          <MetricCard title="Total Boletins" value="10" icon={<FileText className="h-4 w-4 text-blue-500" />} tint="bg-blue-500/5" detail="+0 este mês" />
          <MetricCard title="Total Clientes" value="1" icon={<Users className="h-4 w-4 text-indigo-500" />} tint="bg-indigo-500/5" />
          <MetricCard title="Radar Score" value={`${proposedScore}/100`} icon={<Activity className="h-4 w-4 text-amber-500" />} tint="bg-amber-500/5" detail="Inclui a cobertura setorial" />
        </div>

        <Card className="overflow-hidden border-border bg-card">
          <CardHeader className="border-b border-border/70 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Oportunidades por Setor</CardTitle>
                <CardDescription className="mt-1">Participação nas oportunidades monitoradas, por quantidade.</CardDescription>
              </div>
              <div className="rounded-lg border border-border bg-background/70 px-3 py-2 text-right">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total monitorado</p>
                <p className="font-mono text-lg font-semibold tabular-nums">{total.toLocaleString("pt-BR")} <span className="text-xs font-normal text-muted-foreground">oportunidades</span></p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 p-5 sm:grid-cols-[minmax(230px,.9fr)_minmax(0,1.1fr)] sm:items-center sm:p-6">
            <div
              role="img"
              aria-label={`Gráfico de pizza: ${sectors.map(s => `${s.sector}, ${s.count} oportunidades, ${(s.count / total * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por cento`).join("; ")}`}
              className="mx-auto aspect-square w-full max-w-[270px] rounded-full border-[5px] border-card shadow-[0_0_0_1px_hsl(var(--border))]"
              style={{ background: `conic-gradient(from -90deg, ${gradient})` }}
            />
            <div className="space-y-4">
              <div className="space-y-2.5">
                {sectors.map((item) => {
                  const share = (item.count / total) * 100;
                  return (
                    <div key={item.sector} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                        <span className="truncate text-sm text-foreground/90">{item.sector}</span>
                      </div>
                      <div className="flex shrink-0 items-baseline gap-2">
                        <span className="font-mono text-sm font-semibold tabular-nums">{item.count.toLocaleString("pt-BR")}</span>
                        <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{share.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border border-chart-1/30 bg-chart-1/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-chart-1" />
                <p className="text-xs leading-5 text-muted-foreground">
                  <strong className="font-semibold text-foreground">{sectors[0]!.count} de {total} oportunidades</strong> estão sem setor informado. A distribuição usa as contagens atuais; nenhum setor foi inferido.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-foreground">Como o Radar Score é calculado</p>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">Aplicada</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="font-mono text-sm font-semibold tabular-nums">{volumePoints}/40</p><p className="text-[10px] text-muted-foreground">Volume</p></div>
                  <div><p className="font-mono text-sm font-semibold tabular-nums">{activityPoints}/30</p><p className="text-[10px] text-muted-foreground">Este mês</p></div>
                  <div><p className="font-mono text-sm font-semibold tabular-nums">{Math.round(coveragePoints)}/30</p><p className="text-[10px] text-muted-foreground">Cobertura setorial</p></div>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                  A parcela setorial aplica a cobertura ({classifiedCount}/{total}) ao teto de 30 pontos por diversidade.
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">Percentuais com duas casas decimais. As contagens dos grupos somam {total.toLocaleString("pt-BR")} oportunidades.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
