import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { apiFetch, PETRONECT_URL, resolvePetronectNumero } from "@/lib/api";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Briefcase, ExternalLink, Trash2, Copy, Check, Loader2, Target,
  Save, ArrowRight,
} from "lucide-react";

interface PortfolioItem {
  id: number;
  stage: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  opportunity_id: number;
  title: string;
  sector: string;
  company: string;
  value: number;
  status: string;
  region: string;
  deadline: string | null;
  petronect_id: string | null;
  description: string | null;
  documents_checked: boolean;
}

const STAGES = [
  { value: "avaliando", label: "Avaliando", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { value: "vou_licitar", label: "Vou licitar", color: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  { value: "orcando", label: "Orçando", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { value: "enviada", label: "Proposta enviada", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { value: "descartada", label: "Descartada", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
];

const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.value, s]));

export default function MeuPortfolioPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingNotes, setSavingNotes] = useState<number | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await apiFetch("/api/portfolio")) as PortfolioItem[];
      setItems(data);
      setDraftNotes(Object.fromEntries(data.map((i) => [i.id, i.notes ?? ""])));
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao carregar portfólio.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function updateStage(id: number, stage: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, stage } : i)));
    try {
      await apiFetch(`/api/portfolio/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) });
    } catch {
      toast({ title: "Erro ao atualizar estágio", variant: "destructive" });
      load();
    }
  }

  async function saveNotes(id: number) {
    setSavingNotes(id);
    try {
      await apiFetch(`/api/portfolio/${id}`, { method: "PATCH", body: JSON.stringify({ notes: draftNotes[id] ?? "" }) });
      toast({ title: "Anotações salvas" });
    } catch {
      toast({ title: "Erro ao salvar anotações", variant: "destructive" });
    } finally {
      setSavingNotes(null);
    }
  }

  async function remove(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await apiFetch(`/api/portfolio/${id}`, { method: "DELETE" });
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
      load();
    }
  }

  async function copyNumero(id: number, numero: string) {
    try {
      await navigator.clipboard.writeText(numero);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      toast({ title: "Não foi possível copiar.", variant: "destructive" });
    }
  }

  // O portal público do Petronect abre na busca de licitações (sem link direto
  // por proposta). Ao abrir, copiamos o número para o cliente colar na busca.
  function openPetronect(item: PortfolioItem) {
    const numero = resolvePetronectNumero({
      petronectId: item.petronect_id,
      title: item.title,
      description: item.description,
    });
    if (!numero) return;
    navigator.clipboard?.writeText(numero).then(
      () =>
        toast({
          title: `Número ${numero} copiado`,
          description: "Cole na busca do portal Petronect para localizar esta licitação.",
        }),
      () => {},
    );
  }

  const activeItems = items.filter((i) => i.stage !== "descartada");
  const totalValue = activeItems.reduce((sum, i) => sum + i.value, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Briefcase className="h-7 w-7 text-primary" />
          Meu Portfólio
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Oportunidades que você está acompanhando para licitar e orçar.
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Em acompanhamento</p>
            <p className="text-2xl font-bold">{activeItems.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Valor potencial</p>
            <p className="text-2xl font-bold font-mono">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Propostas enviadas</p>
            <p className="text-2xl font-bold">{items.filter((i) => i.stage === "enviada").length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Vou licitar</p>
            <p className="text-2xl font-bold">{items.filter((i) => i.stage === "vou_licitar").length}</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Target className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium">Seu portfólio está vazio</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
              Adicione oportunidades pelo radar para acompanhar prazos, organizar a documentação e registrar suas propostas.
            </p>
            <Button asChild>
              <Link href="/oportunidades">
                Ver oportunidades
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const stage = STAGE_MAP[item.stage] ?? STAGES[0];
            return (
              <Card key={item.id} className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`${stage.color} text-xs font-semibold`}>{stage.label}</Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${item.documents_checked
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
                        >
                          {item.documents_checked ? "Documentos conferidos" : "Conferência pendente"}
                        </Badge>
                        {item.petronect_id && (
                          <button
                            onClick={() => copyNumero(item.id, item.petronect_id!)}
                            className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedId === item.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            {item.petronect_id}
                          </button>
                        )}
                      </div>
                      <p className="font-medium mt-1.5">{item.title}</p>
                      {item.description?.includes("[RESUMO PROVISÓRIO PETRONECT]") && (
                        <Badge variant="outline" className="mt-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px]">
                          Resumo provisório · conferir edital
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.company} · {item.sector} · {item.region}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold">
                        {item.description?.includes("[RESUMO PROVISÓRIO PETRONECT]")
                          ? "Valor não informado"
                          : formatCurrency(item.value)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <Select value={item.stage} onValueChange={(v) => updateStage(item.id, v)}>
                      <SelectTrigger className="w-full sm:w-[200px] h-9 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2 sm:ml-auto">
                      <Button asChild variant="outline" size="sm" className="h-9">
                        <a href={PETRONECT_URL} target="_blank" rel="noopener noreferrer" onClick={() => openPetronect(item)}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Petronect
                        </a>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-red-500" onClick={() => remove(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Textarea
                      placeholder="Anotações internas: responsável, status da documentação, valor da proposta..."
                      value={draftNotes[item.id] ?? ""}
                      onChange={(e) => setDraftNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      className="min-h-[60px] bg-background text-sm resize-none"
                    />
                    {(draftNotes[item.id] ?? "") !== (item.notes ?? "") && (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => saveNotes(item.id)} disabled={savingNotes === item.id}>
                        {savingNotes === item.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                        Salvar anotações
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
