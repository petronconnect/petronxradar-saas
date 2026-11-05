import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetPetronectPublicImportRunQueryKey,
  getGetPetronectPublicImportRunsQueryKey,
  getGetPetronectPublicImportStatusQueryKey,
  getGetPetronectPublicOpportunitiesQueryKey,
  getGetPetronectPublicOpportunityChangesQueryKey,
  useApplyPetronectPublicImport,
  useGetPetronectPublicImportRun,
  useGetPetronectPublicImportRuns,
  useGetPetronectPublicImportStatus,
  useGetPetronectPublicOpportunities,
  useGetPetronectPublicOpportunityChanges,
} from "@workspace/api-client-react";
import type {
  PetronectPublicImportPreview,
  PetronectPublicPreviewRow,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileCheck2,
  FileSpreadsheet,
  History,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";

const actionLabels: Record<PetronectPublicPreviewRow["action"], string> = {
  new: "Novo",
  updated: "Atualizado",
  unchanged: "Sem alteração",
  duplicate: "Duplicado",
  invalid: "Inválido",
};
const MAX_CSV_BYTES = 5 * 1024 * 1024;
const IMPORTED_RECORD_LIMIT = 500;

const actionStyles: Record<PetronectPublicPreviewRow["action"], string> = {
  new: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  updated: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  unchanged: "border-border bg-muted text-muted-foreground",
  duplicate: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  invalid: "border-destructive/30 bg-destructive/10 text-destructive",
};

const runStatus: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  failed: { label: "Falhou", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  success: { label: "Concluído", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
};

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

function CountTile({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-background/70 px-3 py-3">
      <div className={`mb-1.5 h-1 w-8 rounded-full ${tone}`} />
      <div className="font-mono text-2xl font-semibold tracking-tight">{count.toLocaleString("pt-BR")}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <p className="font-medium">Não foi possível carregar os dados</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      <Button variant="outline" onClick={onRetry} data-testid="button-retry-load">
        <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
      </Button>
    </div>
  );
}

export default function PetroconnectPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PetronectPublicImportPreview | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const statusQuery = useGetPetronectPublicImportStatus();
  const runsQuery = useGetPetronectPublicImportRuns();
  const importedQuery = useGetPetronectPublicOpportunities(
    { limit: IMPORTED_RECORD_LIMIT },
    { query: { queryKey: getGetPetronectPublicOpportunitiesQueryKey({ limit: IMPORTED_RECORD_LIMIT }) } },
  );
  const changesQuery = useGetPetronectPublicOpportunityChanges();
  const selectedRunQuery = useGetPetronectPublicImportRun(selectedRunId ?? 0, {
    query: {
      enabled: selectedRunId !== null && preview === null,
      queryKey: getGetPetronectPublicImportRunQueryKey(selectedRunId ?? 0),
    },
  });
  const applyMutation = useApplyPetronectPublicImport();

  const retryAll = () => {
    void statusQuery.refetch();
    void runsQuery.refetch();
    void importedQuery.refetch();
    void changesQuery.refetch();
  };

  const displayedPreview = preview ?? selectedRunQuery.data ?? null;
  const activeRunId = preview?.runId ?? selectedRunQuery.data?.id ?? selectedRunId;
  const selectedRun = useMemo(
    () => runsQuery.data?.find((run) => run.id === selectedRunId) ?? null,
    [runsQuery.data, selectedRunId],
  );

  if (authLoading) {
    return (
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8" aria-label="Carregando acesso">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="mx-auto flex min-h-[70dvh] max-w-3xl items-center justify-center p-5">
        <Card className="w-full overflow-hidden border-amber-500/20">
          <div className="h-1.5 bg-amber-500/70" />
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-300">
              <LockKeyhole className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Acesso restrito</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              A importação do espelho público Petronect está disponível somente para Admin Petron.
            </p>
            <Badge variant="outline" className="mt-5">Permissão necessária · Admin Petron</Badge>
          </CardContent>
        </Card>
      </main>
    );
  }

  const previewCsv = async () => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setPreviewError("Selecione um arquivo CSV para continuar.");
      return;
    }
    if (selectedFile.size > MAX_CSV_BYTES) {
      setPreviewError("O arquivo excede o limite de 5 MB. Selecione um CSV menor.");
      return;
    }
    setPreviewing(true);
    setPreviewError("");
    try {
      const csvText = await selectedFile.text();
      const result = await apiFetch("/api/petroconnect/public-import/preview", {
        method: "POST",
        headers: {
          "Content-Type": "text/csv",
          "X-Import-Filename": encodeURIComponent(selectedFile.name),
        },
        body: csvText,
      }) as PetronectPublicImportPreview;
      setPreview(result);
      setSelectedRunId(result.runId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetPetronectPublicImportRunsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetPetronectPublicImportRunQueryKey(result.runId) }),
      ]);
      toast({ title: "Prévia pronta", description: "Revise as classificações antes de confirmar a importação." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível processar o arquivo.";
      await Promise.allSettled([statusQuery.refetch(), runsQuery.refetch()]);
      setPreviewError(message);
      toast({ title: "Falha ao gerar prévia", description: message, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  const openRun = (id: number) => {
    setPreview(null);
    setSelectedRunId(id);
  };

  const applyImport = () => {
    if (!activeRunId) return;
    applyMutation.mutate({ id: activeRunId }, {
      onSuccess: async () => {
        setConfirmOpen(false);
        setPreview(null);
        toast({ title: "Importação aplicada", description: "O espelho público foi atualizado. Os dados calculados do Radar não foram alterados." });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetPetronectPublicImportStatusQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetPetronectPublicImportRunsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetPetronectPublicImportRunQueryKey(activeRunId) }),
          queryClient.invalidateQueries({ queryKey: getGetPetronectPublicOpportunitiesQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetPetronectPublicOpportunityChangesQueryKey() }),
        ]);
      },
      onError: (error) => {
        toast({
          title: "Não foi possível aplicar a importação",
          description: error instanceof Error ? error.message : "Tente novamente; a execução permanece disponível para revisão.",
          variant: "destructive",
        });
      },
    });
  };

  const statuses = [
    { label: "Novos", count: displayedPreview?.newRows ?? 0, tone: "bg-emerald-500" },
    { label: "Atualizados", count: displayedPreview?.updatedRows ?? 0, tone: "bg-sky-500" },
    { label: "Sem alteração", count: displayedPreview?.unchangedRows ?? 0, tone: "bg-muted-foreground/50" },
    { label: "Duplicados", count: displayedPreview?.duplicateRows ?? 0, tone: "bg-amber-500" },
    { label: "Inválidos", count: displayedPreview?.invalidRows ?? 0, tone: "bg-destructive" },
  ];

  const changelogRows = changesQuery.data ?? [];
  const unavailable = (statusQuery.data?.limitations ?? { value: "", sector: "", documents: "" });

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6 p-4 pb-12 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="absolute inset-y-0 right-0 hidden w-[38%] bg-[radial-gradient(ellipse_at_75%_30%,hsl(var(--primary)/.13),transparent_65%)] lg:block" />
        <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between lg:p-9">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Área administrativa · Importação manual
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Espelho público Petronect</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Revise arquivos CSV oficiais e confirme cada execução. Os registros ficam isolados do catálogo calculado de oportunidades do Radar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusQuery.isLoading ? (
              <Skeleton className="h-8 w-36 rounded-full" />
            ) : (
              <Badge variant="outline" className="gap-2 px-3 py-1.5">
                <span className={`h-2 w-2 rounded-full ${statusQuery.data?.status === "success" ? "bg-emerald-500" : statusQuery.data?.status === "failure" ? "bg-destructive" : "bg-amber-500"}`} />
                {statusQuery.data?.status === "success" ? "Última execução concluída" : statusQuery.data?.status === "failure" ? "Última execução com falha" : statusQuery.data?.status === "pending" ? "Execução pendente" : "Aguardando arquivo"}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={retryAll} data-testid="button-refresh-import-data">
              <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
          </div>
        </div>
        <div className="relative grid grid-cols-1 border-t border-border/80 sm:grid-cols-3">
          <div className="flex items-center gap-3 border-b border-border/80 px-5 py-4 sm:border-b-0 sm:border-r sm:px-7">
            <Database className="h-4 w-4 text-primary" />
            <div><p className="text-xs text-muted-foreground">Total de registros no espelho</p><p className="font-mono text-lg font-semibold">{statusQuery.data?.importedCount?.toLocaleString("pt-BR") ?? "—"}</p></div>
          </div>
          <div className="flex items-center gap-3 border-b border-border/80 px-5 py-4 sm:border-b-0 sm:border-r sm:px-7">
            <Clock3 className="h-4 w-4 text-primary" />
            <div><p className="text-xs text-muted-foreground">Último processamento</p><p className="text-sm font-medium">{fmtDate(statusQuery.data?.lastRun?.completedAt ?? statusQuery.data?.lastRun?.createdAt)}</p></div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4 sm:px-7">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            <div><p className="text-xs text-muted-foreground">Origem</p><p className="text-sm font-medium">{statusQuery.data?.source || "Exportação pública Petronect"}</p></div>
          </div>
        </div>
      </section>

      {(statusQuery.isError || runsQuery.isError || importedQuery.isError || changesQuery.isError) && (
        <ErrorPanel
          message="Verifique sua conexão e tente carregar os dados novamente."
          onRetry={retryAll}
        />
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70 bg-muted/25">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Upload className="h-5 w-5" /></div>
              <div>
                <CardTitle className="text-lg">Preparar importação</CardTitle>
                <CardDescription className="mt-1">Selecione um CSV, gere uma prévia e revise cada linha. Nada é aplicado antes da confirmação.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <label htmlFor="petronect-csv" className="mb-2 block text-sm font-medium">Arquivo de exportação CSV</label>
                <input
                  ref={fileInput}
                  id="petronect-csv"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file && file.size > MAX_CSV_BYTES) {
                      setSelectedFile(null);
                      setPreviewError("O arquivo excede o limite de 5 MB. Selecione um CSV menor.");
                      event.target.value = "";
                      return;
                    }
                    setSelectedFile(file);
                    setPreview(null);
                    setSelectedRunId(null);
                    setPreviewError("");
                  }}
                  data-testid="input-public-import-csv"
                />
                <div className="flex min-h-12 items-center gap-3 rounded-lg border border-dashed border-border bg-background px-3 py-2">
                  <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {selectedFile?.name ?? "Nenhum arquivo selecionado"}
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={() => fileInput.current?.click()} data-testid="button-select-csv">
                    Escolher CSV
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Formato .csv, até 5 MB. O nome do arquivo será registrado no histórico da execução.</p>
                <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  Exports de páginas/seções diferentes devem ser importados separadamente. A ausência de um registro no arquivo não o remove do espelho.
                </p>
              </div>
              <Button onClick={previewCsv} disabled={!selectedFile || previewing} className="w-full md:w-auto" data-testid="button-preview-csv">
                {previewing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}
                {previewing ? "Analisando arquivo…" : "Gerar prévia"}
              </Button>
            </div>
            {previewError && <p role="alert" className="flex items-center gap-2 text-sm text-destructive"><CircleAlert className="h-4 w-4" />{previewError}</p>}

            <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium"><FileCheck2 className="h-4 w-4 text-primary" />Campos públicos considerados</div>
              <div className="flex flex-wrap gap-1.5">
                {["petronectId", "title", "subStatus", "company", "scope", "startDate", "endDate", "processType", "deliveryLocation"].map((field) => (
                  <code key={field} className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground">{field}</code>
                ))}
              </div>
              <div className="mt-4 grid gap-2 border-t border-border/70 pt-3 sm:grid-cols-3">
                {[
                  ["Valor", unavailable.value || "Não fornecido pela exportação pública"],
                  ["Setor", unavailable.sector || "Não fornecido pela exportação pública"],
                  ["Documentos", unavailable.documents || "Não fornecidos pela exportação pública"],
                ].map(([label, description]) => (
                  <div key={label} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span><strong className="font-medium text-foreground">{label}:</strong> {description}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-primary/[0.025]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-primary" />Revisão explícita</CardTitle>
            <CardDescription>O fluxo preserva o catálogo calculado e grava apenas no espelho público separado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ["01", "Carregue o CSV", "O arquivo é validado e classificado, sem alteração nos registros."],
              ["02", "Inspecione a prévia", "Confira novos, atualizados, inalterados, duplicados e inválidos."],
              ["03", "Confirme a aplicação", "A atualização acontece somente após sua confirmação deliberada."],
            ].map(([number, title, text]) => (
              <div key={number} className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-primary">{number}</span>
                <div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>
              </div>
            ))}
            <div className="flex items-start gap-2 rounded-lg border border-border bg-background/80 p-3 text-xs leading-5 text-muted-foreground">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Execuções pendentes ou com falha permanecem no histórico e podem ser reabertas para retomar a revisão.
            </div>
          </CardContent>
        </Card>
      </section>

      {displayedPreview && (
        <section aria-labelledby="preview-title" className="scroll-mt-4">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/70">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle id="preview-title" className="text-lg">Prévia da execução #{activeRunId}</CardTitle>
                    {selectedRun && <Badge variant="outline" className={runStatus[selectedRun.status]?.className}>{runStatus[selectedRun.status]?.label ?? selectedRun.status}</Badge>}
                  </div>
                  <CardDescription className="mt-1">{selectedRun?.fileName || selectedFile?.name || "Prévia salva"} · {displayedPreview.totalRows.toLocaleString("pt-BR")} linhas analisadas</CardDescription>
                </div>
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={applyMutation.isPending || Boolean(selectedRun && selectedRun.status === "success") || (displayedPreview.newRows + displayedPreview.updatedRows === 0)}
                  data-testid="button-open-apply-confirmation"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Revisar e aplicar
                </Button>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {statuses.map((item) => <CountTile key={item.label} {...item} />)}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {selectedRunQuery.isLoading && !preview ? (
                <div className="space-y-3 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
              ) : selectedRunQuery.isError && !preview ? (
                <div className="p-5"><ErrorPanel message="Não foi possível recuperar a prévia salva." onRetry={() => void selectedRunQuery.refetch()} /></div>
              ) : !displayedPreview.preview.length ? (
                <div className="p-10 text-center text-sm text-muted-foreground">Esta execução não possui linhas de prévia disponíveis.</div>
              ) : (
                <div className="max-h-[560px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="w-16">Linha</TableHead>
                        <TableHead className="min-w-36">Classificação</TableHead>
                        <TableHead className="min-w-36">ID Petronect</TableHead>
                        <TableHead className="min-w-64">Oportunidade</TableHead>
                        <TableHead className="min-w-36">Empresa</TableHead>
                        <TableHead className="min-w-36">Situação / processo</TableHead>
                        <TableHead className="min-w-36">Período</TableHead>
                        <TableHead className="min-w-40">Local de entrega</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedPreview.preview.map((row) => (
                        <TableRow key={`${row.rowNumber}-${row.petronectId}`} data-testid={`row-preview-${row.rowNumber}`}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{row.rowNumber}</TableCell>
                          <TableCell><Badge variant="outline" className={actionStyles[row.action]}>{actionLabels[row.action]}</Badge>{row.error && <p className="mt-1 max-w-40 text-xs text-destructive">{row.error}</p>}</TableCell>
                          <TableCell className="font-mono text-xs">{row.petronectId || "—"}</TableCell>
                          <TableCell><p className="max-w-sm text-sm font-medium">{row.title || "—"}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.scope || "Escopo não informado"}</p></TableCell>
                          <TableCell className="text-sm">{row.company || "—"}</TableCell>
                          <TableCell><p className="text-sm">{row.subStatus || "—"}</p><p className="mt-1 text-xs text-muted-foreground">{row.processType || "—"}</p></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.startDate || "—"}<span className="px-1">→</span>{row.endDate || "—"}</TableCell>
                          <TableCell className="text-sm">{row.deliveryLocation || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70">
            <div className="flex items-start justify-between gap-3">
              <div><CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5 text-primary" />Histórico de execuções</CardTitle><CardDescription className="mt-1">Pré-visões salvas, concluídas e retomáveis.</CardDescription></div>
              <Badge variant="secondary">{runsQuery.data?.length ?? 0}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {runsQuery.isLoading ? (
              <div className="space-y-3 p-5"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : runsQuery.data?.length ? (
              <div className="divide-y divide-border/70">
                {runsQuery.data.map((run) => (
                  <div key={run.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${selectedRunId === run.id ? "bg-primary/[0.045]" : ""}`} data-testid={`run-item-${run.id}`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="max-w-64 truncate text-sm font-medium">{run.fileName || `Execução #${run.id}`}</p>
                        <Badge variant="outline" className={runStatus[run.status]?.className}>{runStatus[run.status]?.label ?? run.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{fmtDate(run.createdAt)} · {run.totalRows} linhas · {run.newRows} novas · {run.updatedRows} atualizadas</p>
                      {run.errorMessage && <p className="mt-1 line-clamp-1 text-xs text-destructive">{run.errorMessage}</p>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openRun(run.id)} data-testid={`button-resume-run-${run.id}`}>
                      {run.status === "pending" || run.status === "failed" ? "Retomar revisão" : "Ver detalhes"} <ArrowRight className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <div className="mb-3 rounded-xl bg-muted p-3 text-muted-foreground"><History className="h-5 w-5" /></div>
                <p className="text-sm font-medium">Nenhuma execução registrada</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Selecione um arquivo CSV para iniciar uma prévia. Ela ficará salva para revisão.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="flex items-center gap-2 text-lg"><ArrowDownToLine className="h-5 w-5 text-primary" />Registros públicos importados</CardTitle>
            <CardDescription>Até 500 registros exibidos; dados isolados do conjunto calculado pelo Radar.</CardDescription>
          </CardHeader>
          <div className="border-b border-border/70 px-6 py-2">
            <Badge variant="secondary">
              {importedQuery.isLoading ? "Carregando registros…" : importedQuery.isError ? "Lista indisponível" : `Exibindo ${importedQuery.data?.length ?? 0} / ${statusQuery.data?.importedCount ?? "—"}`}
            </Badge>
          </div>
          <CardContent className="p-0">
            {importedQuery.isLoading ? (
              <div className="space-y-3 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
            ) : importedQuery.data?.length ? (
              <div className="max-h-[390px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card"><TableRow><TableHead className="min-w-28">ID Petronect</TableHead><TableHead className="min-w-56">Oportunidade</TableHead><TableHead className="min-w-32">Empresa</TableHead><TableHead className="min-w-36">Situação</TableHead><TableHead className="min-w-36">Atualizado neste espelho</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {importedQuery.data.map((record) => (
                      <TableRow key={record.id} data-testid={`row-imported-${record.id}`}>
                        <TableCell className="font-mono text-xs">{record.petronectId}</TableCell>
                        <TableCell><p className="max-w-sm text-sm font-medium">{record.title}</p><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{record.scope || "Escopo não informado"}</p></TableCell>
                        <TableCell className="text-sm">{record.company || "—"}</TableCell>
                        <TableCell className="text-sm">{record.subStatus || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(record.sourceUpdatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <div className="mb-3 rounded-xl bg-muted p-3 text-muted-foreground"><Database className="h-5 w-5" /></div>
                <p className="text-sm font-medium">O espelho está vazio</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Após revisar e aplicar uma importação, os registros públicos aparecerão aqui.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/70">
          <CardTitle className="flex items-center gap-2 text-lg"><Check className="h-5 w-5 text-primary" />Auditoria de alterações</CardTitle>
          <CardDescription>Campos modificados em cada importação pública, com valores anteriores e atuais.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {changesQuery.isLoading ? (
            <div className="space-y-3 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
          ) : changelogRows.length ? (
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card"><TableRow><TableHead className="min-w-36">Data</TableHead><TableHead className="min-w-32">ID Petronect</TableHead><TableHead className="min-w-24">Tipo</TableHead><TableHead className="min-w-64">Campos alterados</TableHead><TableHead className="min-w-28">Execução</TableHead></TableRow></TableHeader>
                <TableBody>
                  {changelogRows.map((change, index) => {
                    const after = change.after_data ?? {};
                    const before = change.before_data ?? {};
                    const changedFields = Object.keys(after).filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
                    return (
                      <TableRow key={change.id ?? `${change.import_run_id}-${change.petronect_id}-${index}`} data-testid={`row-audit-${change.id ?? index}`}>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(change.changed_at)}</TableCell>
                        <TableCell className="font-mono text-xs">{change.petronect_id || String(after.petronectId ?? "—")}</TableCell>
                        <TableCell><Badge variant="outline" className={change.change_type === "new" ? actionStyles.new : actionStyles.updated}>{change.change_type === "new" ? "Novo" : "Atualizado"}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {changedFields.length ? changedFields.map((field) => (
                              <span key={field} className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                                <span className="font-mono text-foreground">{field}</span>: {String(before[field] ?? "—")} <ArrowRight className="inline h-3 w-3" /> {String(after[field] ?? "—")}
                              </span>
                            )) : <span className="text-xs text-muted-foreground">Sem comparação de campos disponível</span>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">#{change.import_run_id ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <div className="mb-3 rounded-xl bg-muted p-3 text-muted-foreground"><History className="h-5 w-5" /></div>
              <p className="text-sm font-medium">Ainda não há alterações auditadas</p>
              <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">Novos registros e campos alterados ficarão listados aqui após a confirmação de uma importação.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar aplicação do CSV?</DialogTitle>
            <DialogDescription>
              Esta ação aplicará {displayedPreview?.newRows ?? 0} novos e {displayedPreview?.updatedRows ?? 0} atualizados ao espelho público Petronect. Registros calculados pelo Radar não serão alterados.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm leading-5">
            Confirme somente após revisar as classificações e os dados da prévia. Linhas duplicadas e inválidas não serão importadas.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={applyMutation.isPending} data-testid="button-cancel-apply">Voltar à revisão</Button>
            <Button onClick={applyImport} disabled={applyMutation.isPending} data-testid="button-confirm-apply">
              {applyMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {applyMutation.isPending ? "Aplicando…" : "Confirmar e aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
