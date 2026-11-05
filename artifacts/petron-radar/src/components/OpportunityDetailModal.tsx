import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/formatters";
import { apiFetch, PETRONECT_URL, resolvePetronectNumero } from "@/lib/api";
import {
  analyzeOpportunity,
  HABILITACAO_DOCS,
  type OpportunityLike,
  type ImpactLevel,
} from "@/lib/opportunityAnalysis";
import {
  Copy, Check, ExternalLink, FolderPlus, FileCheck2, Sparkles,
  TrendingUp, AlertTriangle, MinusCircle, Hash, MapPin, Calendar,
  Building2, Loader2, ArrowRight, ListChecks, FolderOpen, FileText,
  FileSpreadsheet, Paperclip, HelpCircle, Download, Trash2, Plus,
  ShieldCheck, CircleAlert,
} from "lucide-react";

export interface OpportunityDetail extends OpportunityLike {
  id: number;
  company: string;
  createdAt: string;
  petronectId?: string | null;
  documentsChecked?: boolean;
}

interface OppDoc {
  id: number;
  opportunityId: number;
  kind: string;
  label: string;
  url: string;
  linkTestedAt: string | null;
  linkTestedByName: string | null;
}

interface DocumentReview {
  status: "pending" | "verified";
  verifiedAt: string | null;
  verifiedByName: string | null;
  sourceDocumentId: number | null;
}

const KIND_OPTIONS = [
  { value: "fonte_oficial", label: "Fonte oficial Petronect" },
  { value: "edital", label: "Edital" },
  { value: "orcamento", label: "Planilha de proposta / orçamento" },
  { value: "anexo", label: "Anexo técnico" },
  { value: "esclarecimento", label: "Esclarecimento / impugnação" },
  { value: "outro", label: "Outro documento" },
] as const;

const KIND_LABEL: Record<string, string> = Object.fromEntries(KIND_OPTIONS.map((k) => [k.value, k.label]));
const KIND_ICON: Record<string, typeof FileText> = {
  fonte_oficial: ExternalLink,
  edital: FileText,
  orcamento: FileSpreadsheet,
  anexo: Paperclip,
  esclarecimento: HelpCircle,
  outro: FileText,
};

const IMPACT_ICON: Record<ImpactLevel, typeof TrendingUp> = {
  positivo: TrendingUp,
  neutro: MinusCircle,
  atencao: AlertTriangle,
};
const IMPACT_COLOR: Record<ImpactLevel, string> = {
  positivo: "text-emerald-500",
  neutro: "text-muted-foreground",
  atencao: "text-amber-500",
};
const LEVEL_STYLE = {
  alta: { bar: "bg-emerald-500", text: "text-emerald-500", badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  media: { bar: "bg-amber-500", text: "text-amber-500", badge: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  baixa: { bar: "bg-red-500", text: "text-red-500", badge: "bg-red-500/10 text-red-500 border-red-500/20" },
} as const;

function AdminDocForm({ opportunityId, onAdded }: { opportunityId: number; onAdded: (doc: OppDoc) => void }) {
  const { toast } = useToast();
  const [kind, setKind] = useState<string>("fonte_oficial");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!label.trim() || !url.trim()) {
      toast({ title: "Preencha nome e link do documento.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const doc = (await apiFetch(`/api/opportunities/${opportunityId}/documents`, {
        method: "POST",
        body: JSON.stringify({ kind, label, url }),
      })) as OppDoc;
      onAdded(doc);
      setLabel("");
      setUrl("");
      toast({ title: "Documento anexado." });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao anexar documento.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-3 space-y-2">
      <p className="text-[11px] uppercase tracking-widest text-primary/80 font-semibold">Equipe Petron — anexar documento</p>
      <div className="grid sm:grid-cols-[180px_1fr] gap-2">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="h-9 bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="h-9 bg-background" placeholder="Nome (ex.: Edital nº 700.../2026)" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Input className="h-9 bg-background" placeholder="https://link-do-documento" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button size="sm" className="h-9 shrink-0" onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Anexar</>}
        </Button>
      </div>
    </div>
  );
}

export function OpportunityDetailModal({
  opportunity,
  onClose,
  onDocumentsChanged,
}: {
  opportunity: OpportunityDetail | null;
  onClose: () => void;
  onDocumentsChanged?: () => void;
}) {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [docs, setDocs] = useState<OppDoc[]>([]);
  const [openedDocIds, setOpenedDocIds] = useState<Set<number>>(new Set());
  const [review, setReview] = useState<DocumentReview>({
    status: "pending",
    verifiedAt: null,
    verifiedByName: null,
    sourceDocumentId: null,
  });
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);

  const opportunityId = opportunity?.id;

  useEffect(() => {
    setAdded(false);
    setCopied(false);
    setOpenedDocIds(new Set());
    if (opportunityId == null) {
      setDocs([]);
      setReview({ status: "pending", verifiedAt: null, verifiedByName: null, sourceDocumentId: null });
      return;
    }
    let cancelled = false;
    setDocsError(false);
    setDocsLoading(true);
    apiFetch(`/api/opportunities/${opportunityId}/documents`)
      .then((state) => {
        if (cancelled) return;
        const data = state as { documents: OppDoc[]; review: DocumentReview };
        setDocs(data.documents);
        setReview(data.review);
      })
      .catch(() => {
        if (!cancelled) {
          setDocs([]);
          setDocsError(true);
          setReview({ status: "pending", verifiedAt: null, verifiedByName: null, sourceDocumentId: null });
        }
      })
      .finally(() => { if (!cancelled) setDocsLoading(false); });
    return () => { cancelled = true; };
  }, [opportunityId]);

  if (!opportunity) return null;

  const analysis = analyzeOpportunity(opportunity);
  const isProvisional = opportunity.description?.includes("[RESUMO PROVISÓRIO PETRONECT]") ?? false;
  const style = LEVEL_STYLE[analysis.level];
  const numero = resolvePetronectNumero(opportunity);
  const canMarkReviewed = docs.length > 0
    && docs.every((doc) => Boolean(doc.linkTestedAt))
    && docs.some((doc) => doc.kind === "fonte_oficial");

  async function copyNumero() {
    if (!numero) return;
    try {
      await navigator.clipboard.writeText(numero);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Não foi possível copiar o número.", variant: "destructive" });
    }
  }

  // O portal público do Petronect abre na busca de licitações (não há link
  // direto por proposta). Ao abrir, copiamos o número para o cliente colar na
  // busca e localizar a licitação de imediato.
  function openPetronect() {
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

  async function addToPortfolio() {
    if (!opportunity) return;
    setAdding(true);
    try {
      await apiFetch("/api/portfolio", {
        method: "POST",
        body: JSON.stringify({ opportunityId: opportunity.id }),
      });
      setAdded(true);
      toast({ title: "Adicionada ao portfólio", description: "Acompanhe o andamento em Meu Portfólio." });
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Falha ao adicionar ao portfólio.",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  }

  async function removeDoc(docId: number) {
    try {
      await apiFetch(`/api/opportunities/documents/${docId}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      setReview({ status: "pending", verifiedAt: null, verifiedByName: null, sourceDocumentId: null });
      onDocumentsChanged?.();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao remover documento.", variant: "destructive" });
    }
  }

  async function markLinkTested(docId: number) {
    try {
      const tested = (await apiFetch(`/api/opportunities/documents/${docId}/test`, { method: "POST" })) as OppDoc;
      setDocs((prev) => prev.map((doc) => doc.id === docId ? tested : doc));
      setOpenedDocIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
      toast({ title: "Teste do link registrado." });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao registrar o teste.", variant: "destructive" });
    }
  }

  async function markDocumentsReviewed() {
    if (opportunityId == null) return;
    const source = docs.find((doc) => doc.kind === "fonte_oficial" && doc.linkTestedAt);
    if (!source) return;
    setReviewSaving(true);
    try {
      const result = (await apiFetch(`/api/opportunities/${opportunityId}/documents/review`, {
        method: "POST",
        body: JSON.stringify({ sourceDocumentId: source.id }),
      })) as DocumentReview;
      setReview(result);
      onDocumentsChanged?.();
      toast({ title: "Documentos oficiais conferidos." });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao confirmar a conferência.", variant: "destructive" });
    } finally {
      setReviewSaving(false);
    }
  }

  return (
    <Dialog open={!!opportunity} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[660px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <Badge
            variant="outline"
            className={`${isProvisional ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : style.badge} text-xs font-semibold w-fit`}
          >
            {isProvisional ? "Resumo provisório · validar no edital" : analysis.levelLabel}
          </Badge>
          <DialogTitle className="text-xl leading-snug pr-6">{opportunity.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Detalhes da oportunidade, análise de aderência, documentos e ações no Petronect.
          </DialogDescription>
        </DialogHeader>

        {isProvisional && (
          <div role="note" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-900 dark:text-amber-200">
            Esta oportunidade foi importada de uma listagem resumida da Petronect. O título pode estar abreviado; valor, setor e anexos não vieram no arquivo. Confirme os dados e o edital oficial antes de decidir participar.
          </div>
        )}

        {/* Metadados */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-4 w-4 shrink-0" /><span className="text-foreground truncate">{opportunity.company}</span></div>
          <div className="flex items-center gap-2 text-muted-foreground"><Hash className="h-4 w-4 shrink-0" /><span className="text-foreground">{opportunity.sector}</span></div>
          <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" /><span className="text-foreground">{opportunity.region}</span></div>
          <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4 shrink-0" /><span className="text-foreground">{analysis.prazoLabel}</span></div>
          <div className="col-span-2 font-mono font-bold text-lg text-foreground">
            {isProvisional ? "Valor não informado" : formatCurrency(opportunity.value)}
          </div>
        </div>

        {opportunity.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{opportunity.description}</p>
        )}

        {/* Número da oportunidade */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold mb-1">Número da oportunidade (Petronect)</p>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-lg font-bold tracking-wide">{numero || "Não informado"}</span>
            {numero && (
              <Button variant="outline" size="sm" onClick={copyNumero} className="h-8 gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            )}
          </div>
          {numero && (
            <p className="mt-2 text-[11px] text-muted-foreground/70 leading-snug">
              No Petronect a busca é por número: copie este número e cole na busca ao abrir o portal para localizar esta licitação.
            </p>
          )}
        </div>

        <Separator />

        {/* Dados parciais não sustentam uma nota de aderência confiável. */}
        {isProvisional ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            A análise de aderência será disponibilizada depois da conferência do objeto completo, do edital e dos requisitos da oportunidade.
          </div>
        ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Análise Petron Radar</h3>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold">Índice de aderência</p>
                <p className={`text-3xl font-bold ${style.text}`}>{analysis.score}<span className="text-base text-muted-foreground font-normal">/100</span></p>
              </div>
              <Badge variant="outline" className={`${style.badge} text-xs font-semibold`}>{analysis.levelLabel}</Badge>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${style.bar} transition-all`} style={{ width: `${analysis.score}%` }} />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{analysis.recommendation}</p>
          </div>

          <div className="space-y-2">
            {analysis.factors.map((f, i) => {
              const Icon = IMPACT_ICON[f.impact];
              return (
                <div key={i} className="flex items-start gap-2.5 text-sm">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${IMPACT_COLOR[f.impact]}`} />
                  <div>
                    <span className="font-medium">{f.label}: </span>
                    <span className="text-muted-foreground">{f.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Próximos passos */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5 text-primary" />Próximos passos</p>
            <ol className="space-y-1.5">
              {analysis.nextSteps.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="text-[11px] text-muted-foreground/60 italic">
            Análise baseada nos dados estruturados da oportunidade. Consulte sempre o edital completo no Petronect antes de decidir participar.
          </p>
        </div>
        )}

        <Separator />

        {/* Documentos & downloads */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Documentos & downloads</h3>
          </div>

          <div className={`rounded-lg border p-3 text-sm ${docsError ? "border-red-500/30 bg-red-500/5" : review.status === "verified" ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
            {docsError ? (
              <p className="flex items-start gap-2 text-red-800 dark:text-red-200">
                <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Não foi possível carregar o estado dos documentos. Tente novamente antes de decidir.</span>
              </p>
            ) : review.status === "verified" ? (
              <p className="flex items-start gap-2 text-emerald-800 dark:text-emerald-200">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Documentos oficiais conferidos pela equipe Petron
                  {review.verifiedAt && ` em ${new Date(review.verifiedAt).toLocaleString("pt-BR")}`}
                  {review.verifiedByName && ` por ${review.verifiedByName}`}.
                </span>
              </p>
            ) : (
              <p className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Documentos oficiais ainda não foram conferidos pela equipe Petron.</span>
              </p>
            )}
          </div>

          {docsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando documentos…</div>
          ) : docs.length > 0 ? (
            <div className="space-y-1.5">
              {docs.map((d) => {
                const Icon = KIND_ICON[d.kind] ?? FileText;
                return (
                  <div key={d.id} className="flex items-center gap-2.5 rounded-md border border-border p-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{d.label}</p>
                      <p className="text-[11px] text-muted-foreground">{KIND_LABEL[d.kind] ?? "Documento"}</p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 shrink-0">
                      <a href={d.url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" />Abrir</a>
                    </Button>
                    {isAdmin && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpenedDocIds((prev) => new Set(prev).add(d.id))}
                          >
                            Testar link
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => markLinkTested(d.id)}
                          disabled={!d.linkTestedAt && !openedDocIds.has(d.id)}
                        >
                          {d.linkTestedAt ? "Testado" : openedDocIds.has(d.id) ? "Registrar teste" : "Abra para testar"}
                        </Button>
                      </div>
                    )}
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-500" onClick={() => removeDoc(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {docsError ? "Falha ao carregar os links curados." : "Nenhum link curado pela equipe Petron para esta oportunidade."}
            </p>
          )}

          {/* Fallback honesto: documentos oficiais ficam no portal Petronect */}
          <a
            href={PETRONECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openPetronect}
            className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border p-2.5 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Edital oficial, planilha de proposta e anexos no portal Petronect</span>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </a>

          {isAdmin && (
            <>
              <p className="text-xs text-muted-foreground">
                Abra cada link, confira se pertence a esta oportunidade e registre o teste. A fonte oficial deve ser um endereço do domínio Petronect.
              </p>
              <AdminDocForm
                opportunityId={opportunity.id}
                onAdded={(doc) => {
                  setDocs((prev) => [...prev, doc]);
                  setReview({ status: "pending", verifiedAt: null, verifiedByName: null, sourceDocumentId: null });
                  onDocumentsChanged?.();
                }}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={markDocumentsReviewed}
                disabled={!canMarkReviewed || reviewSaving}
              >
                {reviewSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Confirmar conferência dos documentos oficiais
              </Button>
              {!canMarkReviewed && (
                <p className="text-xs text-muted-foreground">
                  Para confirmar, adicione e teste a fonte oficial Petronect e teste todos os links desta oportunidade.
                </p>
              )}
            </>
          )}
        </div>

        <Separator />

        {/* Documentos de habilitação */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Documentos para habilitação</h3>
          </div>
          <div className="space-y-3">
            {HABILITACAO_DOCS.map((group) => (
              <div key={group.grupo}>
                <p className="text-xs font-semibold text-foreground mb-1.5">{group.grupo}</p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500/70" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/60 italic">
            Checklist de referência para licitações Petrobras. Os documentos exigidos podem variar por edital.
          </p>
        </div>

        <Separator />

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild variant="outline" className="flex-1">
            <a href={PETRONECT_URL} target="_blank" rel="noopener noreferrer" onClick={openPetronect}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir no Petronect
            </a>
          </Button>
          {added ? (
            <Button asChild className="flex-1 bg-emerald-600 hover:bg-emerald-600/90 text-white">
              <Link href="/meu-portfolio">
                <Check className="h-4 w-4 mr-2" />
                No portfólio — ver
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          ) : (
            <Button onClick={addToPortfolio} disabled={adding} className="flex-1 bg-primary text-primary-foreground">
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderPlus className="h-4 w-4 mr-2" />}
              Adicionar ao meu portfólio
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
