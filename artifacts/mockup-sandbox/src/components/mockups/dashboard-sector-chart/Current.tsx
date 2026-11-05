import "./_group.css";
import { Activity, FileText, Target, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const sectors = [
  { sector: "Não informado", count: 287 },
  { sector: "Upstream", count: 3 },
  { sector: "Midstream", count: 2 },
  { sector: "Tecnologia", count: 2 },
  { sector: "Downstream", count: 1 },
  { sector: "Engenharia / Dutos", count: 1 },
  { sector: "Outros", count: 11 },
];

const colors = ["#1e6091", "#2980b9", "#1abc9c", "#f39c12", "#e67e22", "#8e44ad", "#7f8c8d"];

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

export function Current() {
  const total = sectors.reduce((sum, item) => sum + item.count, 0);
  return (
    <main className="dark min-h-screen bg-background p-5 font-sans text-foreground sm:p-7">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Petron Radar · Painel</p>
            <h1 className="text-2xl font-bold tracking-tight">Painel de Controle</h1>
            <p className="mt-1 text-sm text-muted-foreground">Visão geral do mercado e desempenho da sua conta.</p>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground">Snapshot real do ambiente de desenvolvimento</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total Oportunidades" value="307" icon={<Target className="h-4 w-4 text-primary" />} tint="bg-primary/5" detail="+287 este mês" />
          <MetricCard title="Total Boletins" value="10" icon={<FileText className="h-4 w-4 text-blue-500" />} tint="bg-blue-500/5" detail="+0 este mês" />
          <MetricCard title="Total Clientes" value="1" icon={<Users className="h-4 w-4 text-indigo-500" />} tint="bg-indigo-500/5" />
          <MetricCard title="Radar Score" value="100/100" icon={<Activity className="h-4 w-4 text-amber-500" />} tint="bg-amber-500/5" />
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle>Oportunidades por Setor</CardTitle>
            <CardDescription>Distribuição de valor no mercado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {sectors.map((item, index) => {
              const percent = Math.round((item.count / total) * 100);
              const color = colors[index % colors.length];
              return (
                <div key={item.sector} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span className="truncate text-xs text-foreground/80">{item.sector}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground">{item.count} op.</span>
                      <span className="w-9 text-right text-xs font-semibold tabular-nums" style={{ color }}>{percent}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full" style={{ width: `${(item.count / total) * 100}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-[11px] text-muted-foreground/70">+ 11 outros setores agrupados em “Outros”</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
