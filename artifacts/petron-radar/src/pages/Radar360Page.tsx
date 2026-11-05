import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListRadar360ProfilesQueryKey,
  getGetRadar360ReconciliationQueryKey,
  getGetRadar360SourceStatusQueryKey,
  getListRadar360EventsQueryKey,
  getListRadar360ImportsQueryKey,
  getListRadar360RunsQueryKey,
  getGetRadar360RunQueryKey,
  getListRadar360FilesQueryKey,
  getGetRadar360RunImageUrl,
  getDownloadRadar360FileUrl,
  useListRadar360Profiles,
  useCreateRadar360Profile,
  useBootstrapRadar360References,
  useUpdateRadar360Profile,
  useLinkRadar360Profile,
  useGetRadar360Reconciliation,
  useGetRadar360SourceStatus,
  useListRadar360Events,
  useListRadar360Imports,
  usePreviewRadar360Import,
  useApplyRadar360Import,
  useListRadar360Runs,
  useCreateRadar360Run,
  useGetRadar360Run,
  useResumeRadar360Run,
  usePublishRadar360Run,
  useListRadar360Files,
  useRequestRadar360FileUpload,
  useCompleteRadar360FileUpload,
  useVerifyRadar360CapabilityFile,
} from "@workspace/api-client-react";
import type { Radar360Profile, Radar360SourceStatus, Radar360RunSummary } from "@workspace/api-client-react";
import {
  Activity, AlertCircle, ArrowDownToLine, ArrowRight, BadgeCheck, Building2,
  CalendarClock, Check, ChevronDown, CircleDashed, FileCheck2, FileImage,
  FileText, Filter, Gauge, Globe2, Layers3, Link2, LockKeyhole, Plus, Radar,
  RefreshCw, Search, ShieldCheck, Sparkles, Upload, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const panel = "rounded-xl border border-[#dce3ec] bg-white shadow-[0_8px_24px_rgba(17,38,65,.035)]";
const inputClass = "w-full rounded-lg border border-[#d6deea] bg-[#fbfcfe] px-3 py-2.5 text-sm text-[#102748] outline-none transition focus:border-[#b28a32] focus:ring-2 focus:ring-[#d4b45d]/20";

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "gold" | "green" | "red" | "blue" }) {
  const tones = {
    neutral: "border-[#dce3ec] bg-[#f5f7fa] text-[#63738a]",
    gold: "border-[#e9d69f] bg-[#fbf5e5] text-[#87681d]",
    green: "border-[#c8e5d7] bg-[#eef8f2] text-[#317251]",
    red: "border-[#efd1ce] bg-[#fff2f0] text-[#a64c43]",
    blue: "border-[#c9d8ec] bg-[#eef4fb] text-[#3c5d83]",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.09em]", tones[tone])}>{children}</span>;
}

function SectionHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.19em] text-[#a18030]">{eyebrow}</p><h2 className="font-serif text-xl font-extrabold tracking-[-.035em] text-[#102748]">{title}</h2>{detail && <p className="mt-1 text-xs text-[#718097]">{detail}</p>}</div>
    {action}
  </div>;
}

function StatusText({ status }: { status: string }) {
  const map: Record<string, [string, "green" | "gold" | "red" | "neutral"]> = {
    success: ["Disponível", "green"], pending: ["Pendente", "gold"], not_configured: ["Não configurada", "neutral"], failure: ["Falha", "red"],
    incomplete: ["Perfil incompleto", "gold"], ready: ["Pronto", "green"], suggested: ["Correspondência sugerida", "gold"],
    linked: ["Conta vinculada", "green"], draft: ["Rascunho", "neutral"], validation: ["Em validação", "gold"],
    published: ["Publicado", "green"], failed: ["Falhou", "red"],
  };
  const [label, tone] = map[status] ?? [status.replaceAll("_", " "), "neutral"];
  return <Tag tone={tone}>{label}</Tag>;
}

function splitList(value: string) {
  return value.split(/[,;\n]/).map((part) => part.trim()).filter(Boolean);
}

function formatDate(value?: string | null) {
  if (!value) return "Pendente";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Pendente" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function eventLabel(value: string) {
  const labels: Record<string, string> = {
    import_preview: "Prévia de importação",
    import_apply_started: "Aplicação iniciada",
    import_applied: "Importação aplicada",
    import_failed: "Falha na importação",
    run_started: "Varredura iniciada",
    run_resumed: "Varredura retomada",
    run_ready: "Edição validada",
    run_draft: "Rascunho salvo",
    run_failed: "Falha na varredura",
    run_published: "Edição publicada",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="flex items-center justify-between gap-4 rounded-lg border border-[#efd1ce] bg-[#fff5f3] p-4 text-sm text-[#98483f]" data-testid="status-load-error"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{message}</span><button onClick={retry} data-testid="button-retry-load" className="rounded-md border border-[#e9c5c0] px-3 py-1.5 text-xs font-semibold hover:bg-white">Tentar novamente</button></div>;
}

export default function Radar360Page() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const canManageProfile = isAdmin || user?.role === "CLIENTE_ADMIN";
  const profilesQuery = useListRadar360Profiles();
  const reconciliationQuery = useGetRadar360Reconciliation({ query: { enabled: isAdmin, queryKey: getGetRadar360ReconciliationQueryKey() } });
  const sourceQuery = useGetRadar360SourceStatus();
  const profiles = profilesQuery.data ?? [];
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0];
  const profileId = selectedProfile?.id;
  const importsQuery = useListRadar360Imports(profileId ? { profileId } : undefined);
  const eventsQuery = useListRadar360Events(profileId ? { profileId } : undefined);
  const runsQuery = useListRadar360Runs(profileId ? { profileId } : undefined);
  const filesQuery = useListRadar360Files({ profileId: profileId ?? 0 }, { query: { enabled: !!profileId, queryKey: getListRadar360FilesQueryKey({ profileId: profileId ?? 0 }) } });
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const runSummaries = runsQuery.data ?? [];
  const activeRunId = selectedRunId ?? runSummaries[0]?.id ?? 0;
  const runQuery = useGetRadar360Run(activeRunId, { query: { enabled: !!activeRunId, queryKey: getGetRadar360RunQueryKey(activeRunId) } });
  const activeRun = runQuery.data;

  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<Record<number, string>>({});
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [newCompanyId, setNewCompanyId] = useState("");
  const [sourceKinds, setSourceKinds] = useState<string[]>(["catalog"]);
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [importSource, setImportSource] = useState("");
  const [capabilityLabel, setCapabilityLabel] = useState("");
  const [uploadKind, setUploadKind] = useState<"logo" | "capability_document" | "source_document">("capability_document");
  const [busyFile, setBusyFile] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const invalidateProfiles = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListRadar360ProfilesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetRadar360ReconciliationQueryKey() }),
    ]);
  };
  const invalidateProfileData = async (id?: number) => {
    await Promise.all([
      invalidateProfiles(),
      queryClient.invalidateQueries({ queryKey: getListRadar360ImportsQueryKey(id ? { profileId: id } : undefined) }),
      queryClient.invalidateQueries({ queryKey: getListRadar360RunsQueryKey(id ? { profileId: id } : undefined) }),
      queryClient.invalidateQueries({ queryKey: getListRadar360EventsQueryKey(id ? { profileId: id } : undefined) }),
      id ? queryClient.invalidateQueries({ queryKey: getListRadar360FilesQueryKey({ profileId: id }) }) : Promise.resolve(),
    ]);
  };

  const bootstrap = useBootstrapRadar360References({ mutation: { onSuccess: async (result) => { await invalidateProfiles(); toast({ title: "Referências revisadas", description: `${result.insertedCount} referências históricas adicionadas. Nenhuma conta foi vinculada automaticamente.` }); } } });
  const createProfile = useCreateRadar360Profile({ mutation: { onSuccess: async (profile) => { await invalidateProfiles(); setSelectedProfileId(profile.id); setCreateOpen(false); toast({ title: "Perfil criado", description: "A conta foi vinculada por ação explícita." }); } } });
  const updateProfile = useUpdateRadar360Profile({ mutation: { onSuccess: async () => { await invalidateProfiles(); setEditOpen(false); toast({ title: "Perfil atualizado" }); } } });
  const linkProfile = useLinkRadar360Profile({ mutation: { onSuccess: async () => { await invalidateProfiles(); toast({ title: "Vínculo confirmado" }); } } });
  const previewImport = usePreviewRadar360Import({ mutation: { onSuccess: async (entry) => { await invalidateProfileData(entry.profileId); } } });
  const applyImport = useApplyRadar360Import({ mutation: { onSuccess: async (entry) => { await invalidateProfileData(entry.profileId); previewImport.reset(); toast({ title: "Importação aplicada", description: "Os registros revisados foram incorporados." }); } } });
  const createRun = useCreateRadar360Run({ mutation: { onSuccess: async (run) => { setSelectedRunId(run.id); await invalidateProfileData(run.profileId); toast({ title: "Edição criada", description: "A edição permanece privada até publicação." }); } } });
  const resumeRun = useResumeRadar360Run({ mutation: { onSuccess: async (run) => { setSelectedRunId(run.id); await invalidateProfileData(run.profileId); toast({ title: "Edição retomada" }); } } });
  const publishRun = usePublishRadar360Run({ mutation: { onSuccess: async (run) => { await Promise.all([invalidateProfileData(run.profileId), queryClient.invalidateQueries({ queryKey: getGetRadar360RunQueryKey(run.id) })]); toast({ title: "Edição publicada", description: "Disponível na área privada da empresa." }); } } });
  const requestUpload = useRequestRadar360FileUpload();
  const completeUpload = useCompleteRadar360FileUpload();
  const verifyFile = useVerifyRadar360CapabilityFile({ mutation: { onSuccess: async (file) => { await Promise.all([queryClient.invalidateQueries({ queryKey: getListRadar360FilesQueryKey({ profileId: file.profileId }) }), queryClient.invalidateQueries({ queryKey: getListRadar360ProfilesQueryKey() })]); toast({ title: "Evidência revisada" }); } } });

  const reconciliationByProfile = useMemo(() => new Map((reconciliationQuery.data?.references ?? []).map((entry) => [entry.profileId, entry])), [reconciliationQuery.data]);
  const matchedCompanyIds = useMemo(
    () => new Set((reconciliationQuery.data?.references ?? []).flatMap((entry) => entry.candidateAccounts.map((account) => account.id))),
    [reconciliationQuery.data],
  );
  const availableSources = sourceQuery.data ?? [];
  const profileRuns = runSummaries;
  const openEdit = (profile: Radar360Profile) => {
    setSelectedProfileId(profile.id);
    setEditDraft({
      displayName: profile.displayName,
      aliases: profile.aliases.join(", "),
      focusAreas: profile.focusAreas.join(", "),
      declaredCapabilities: profile.declaredCapabilities.join(", "),
      regions: profile.regions.join(", "),
      keywords: profile.keywords.join(", "),
      exclusions: profile.exclusions.join(", "),
      exclusionsReviewed: profile.exclusionsReviewed ? "true" : "false",
      cadence: profile.cadence,
    });
    setEditOpen(true);
  };
  const saveEdit = () => {
    if (!selectedProfile) return;
    updateProfile.mutate({ id: selectedProfile.id, data: {
      ...(isAdmin ? { displayName: editDraft.displayName.trim() } : {}),
      aliases: splitList(editDraft.aliases),
      focusAreas: splitList(editDraft.focusAreas),
      declaredCapabilities: splitList(editDraft.declaredCapabilities),
      regions: splitList(editDraft.regions),
      keywords: splitList(editDraft.keywords),
      exclusions: splitList(editDraft.exclusions),
      exclusionsReviewed: editDraft.exclusionsReviewed === "true",
      cadence: editDraft.cadence as "manual" | "daily" | "weekly",
    } });
  };
  const submitPreview = () => {
    if (!profileId || !csvText.trim() || !importSource.trim()) return;
    previewImport.mutate({ data: csvText, params: { profileId, sourceName: importSource, fileName: csvFileName || "importacao.csv" } });
  };
  const uploadSelectedFile = async (file?: File) => {
    if (!file || !profileId) return;
    const isLogo = uploadKind === "logo";
    const limit = isLogo ? 4 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > limit) { toast({ title: "Arquivo acima do limite", description: isLogo ? "O limite de logo é 4 MB." : "O limite é 20 MB.", variant: "destructive" }); return; }
    if (uploadKind === "capability_document" && !capabilityLabel.trim()) { toast({ title: "Capacidade pendente", description: "Informe qual capacidade este documento pretende comprovar.", variant: "destructive" }); return; }
    setBusyFile(true);
    try {
      const response = await requestUpload.mutateAsync({ data: { profileId, kind: uploadKind, fileName: file.name, fileSize: file.size, contentType: file.type || "application/octet-stream", ...(uploadKind === "capability_document" ? { capabilityLabel: capabilityLabel.trim() } : {}) } });
      const uploaded = await fetch(response.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!uploaded.ok) throw new Error("O envio direto do arquivo não foi concluído.");
      await completeUpload.mutateAsync({ id: response.fileId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListRadar360FilesQueryKey({ profileId }) }),
        queryClient.invalidateQueries({ queryKey: getListRadar360ProfilesQueryKey() }),
      ]);
      toast({ title: "Arquivo enviado", description: "O status da evidência foi atualizado." });
    } catch (error) {
      toast({ title: "Falha no envio", description: error instanceof Error ? error.message : "Não foi possível enviar o arquivo.", variant: "destructive" });
    } finally { setBusyFile(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  const startRun = () => {
    if (!profileId || sourceKinds.length === 0) return;
    createRun.mutate({ data: { profileId, sourceKinds: sourceKinds as ("catalog" | "petronect_public_csv" | "client_import")[], idempotencyKey: `radar360-${profileId}-${Date.now()}` } });
  };
  const toggleSource = (kind: string) => setSourceKinds((old) => old.includes(kind) ? old.filter((item) => item !== kind) : [...old, kind]);
  const refreshAll = () => {
    void Promise.all([profilesQuery.refetch(), isAdmin ? reconciliationQuery.refetch() : Promise.resolve(), sourceQuery.refetch(), importsQuery.refetch(), eventsQuery.refetch(), runsQuery.refetch(), filesQuery.refetch()]);
  };

  const profileLoading = profilesQuery.isLoading || (isAdmin && reconciliationQuery.isLoading) || sourceQuery.isLoading;
  const profileError = profilesQuery.isError || (isAdmin && reconciliationQuery.isError) || sourceQuery.isError;
  if (profileLoading) return <div className="min-h-[70vh] bg-[#f4f6f9] p-5 md:p-9"><div className="mx-auto max-w-[1440px] animate-pulse"><div className="h-9 w-72 rounded bg-[#e4e9f0]" /><div className="mt-3 h-4 w-[28rem] max-w-full rounded bg-[#e4e9f0]" /><div className="mt-8 grid gap-4 md:grid-cols-3"><div className="h-32 rounded-xl bg-white" /><div className="h-32 rounded-xl bg-white" /><div className="h-32 rounded-xl bg-white" /></div><div className="mt-6 h-96 rounded-xl bg-white" /></div></div>;

  return <main className="min-h-[100dvh] bg-[#f4f6f9] px-4 py-6 text-[#102748] md:px-8 md:py-9">
    <div className="mx-auto max-w-[1440px]">
      <header className="radar-enter relative mb-7 overflow-hidden rounded-2xl bg-[#102748] px-6 py-7 text-white md:px-9 md:py-8">
        <div className="absolute -right-16 -top-28 h-80 w-80 rounded-full border border-[#d8b65b]/20" /><div className="absolute -right-3 -top-16 h-56 w-56 rounded-full border border-[#d8b65b]/20" /><div className="absolute right-12 top-8 h-24 w-24 rounded-full border border-[#d8b65b]/35" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#e2c56f]"><Radar className="h-4 w-4" />Petron Radar <span className="text-white/35">/</span> Premium</div>
            <h1 className="font-serif text-3xl font-extrabold tracking-[-.045em] md:text-[42px]">Varredura 360</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#cad4e2]">Oportunidades relevantes para engenharia, energia e infraestrutura — com origem, cobertura e pendências à vista.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden border-r border-white/15 pr-4 text-right sm:block"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#b9c6d7]">Cobertura</p><p className="mt-1 text-xs text-white">Fontes disponíveis, sem cobertura integral</p></div>
            <button onClick={refreshAll} data-testid="button-refresh-radar" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 text-xs font-semibold transition hover:bg-white/10"><RefreshCw className="h-3.5 w-3.5" />Atualizar</button>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-[11px] text-[#d2dbe6]">
          <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-[#e2c56f]" />Fatos e dados pendentes são separados</span>
          <span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5 text-[#e2c56f]" />Edições privadas até publicação</span>
          <span className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-[#e2c56f]" />Sem envio externo ou agendamento automático</span>
        </div>
      </header>

      {profileError && <div className="mb-5"><ErrorState message="Não foi possível carregar todos os dados do Radar 360." retry={refreshAll} /></div>}

      <section className="radar-enter-delay mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Building2} label="Perfis visíveis" value={profiles.length} note="No escopo desta sessão" />
        <Metric icon={Link2} label="Referências vinculadas" value={profiles.filter((p) => p.reconciliationStatus === "linked").length} note="Vínculo confirmado explicitamente" />
        <Metric icon={Layers3} label="Edições registradas" value={profileRuns.length} note="Rascunhos e publicações" />
        <Metric icon={Globe2} label="Fontes listadas" value={availableSources.length} note="Disponibilidade pode variar" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.8fr)]">
        <section className={cn(panel, "p-5 md:p-6")}>
          <SectionHeading eyebrow="01 / Identidade e escopo" title="Perfis de varredura" detail={isAdmin ? "Referências históricas não representam contas vinculadas até confirmação explícita." : "Perfil e boletins restritos à empresa desta sessão."} action={isAdmin ? <div className="flex flex-wrap gap-2"><button onClick={() => setCreateOpen(true)} data-testid="button-open-create-profile" className="inline-flex items-center gap-2 rounded-lg bg-[#17395f] px-3 py-2 text-xs font-bold text-white hover:bg-[#214c79]"><Plus className="h-3.5 w-3.5" />Criar / vincular perfil</button><button onClick={() => bootstrap.mutate()} disabled={bootstrap.isPending} data-testid="button-bootstrap-references" className="inline-flex items-center gap-2 rounded-lg border border-[#d8c17f] bg-[#fcf7e9] px-3 py-2 text-xs font-bold text-[#765d20] hover:bg-[#f8efd6] disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" />{bootstrap.isPending ? "Revisando…" : "Revisar referências"}</button></div> : undefined} />
          {!profiles.length ? <div className="rounded-xl border border-dashed border-[#ccd6e3] bg-[#fafbfd] px-6 py-10 text-center" data-testid="empty-profiles"><CircleDashed className="mx-auto h-8 w-8 text-[#aab7c7]" /><h3 className="mt-3 text-sm font-bold">Nenhum perfil disponível</h3><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#718097]">Não há perfis no escopo retornado. As referências históricas são carregadas por ação explícita e não criam vínculos automaticamente.</p></div> :
            <div className="space-y-2.5">{profiles.map((profile) => {
              const reconciled = reconciliationByProfile.get(profile.id);
              return <article key={profile.id} className={cn("rounded-xl border p-4 transition", selectedProfile?.id === profile.id ? "border-[#c7a650] bg-[#fffdf7]" : "border-[#e3e8ef] bg-white hover:border-[#cbd5e1]")} data-testid={`card-profile-${profile.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button onClick={() => { setSelectedProfileId(profile.id); setSelectedRunId(null); }} data-testid={`button-select-profile-${profile.id}`} className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold text-[#142c4a]">{profile.displayName}</h3><StatusText status={profile.profileStatus} /><StatusText status={profile.reconciliationStatus} /></div>
                    <p className="mt-1 text-[11px] text-[#78869a]">{isAdmin ? <>Referência {profile.referenceKey} <span className="px-1.5 text-[#c2cad4]">/</span></> : null}Empresa vinculada: {profile.companyName || "Pendente"}</p>
                  </button>
                  {canManageProfile && <button onClick={() => openEdit(profile)} data-testid={`button-edit-profile-${profile.id}`} className="rounded-md border border-[#dce3ec] px-2.5 py-1.5 text-[11px] font-semibold text-[#536780] hover:bg-[#f4f7fa]">Editar perfil</button>}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">{profile.focusAreas.length ? profile.focusAreas.map((area) => <span key={area} className="rounded-md bg-[#eef3f8] px-2 py-1 text-[10px] font-medium text-[#52677f]">{area}</span>) : <span className="text-[10px] text-[#a3722c]">Áreas de foco: Pendente</span>}</div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0f4] pt-3">
                  <p className="text-[10px] text-[#7c8a9d]">Região: <strong className="font-semibold text-[#52677f]">{profile.regions.length ? profile.regions.join(", ") : "Pendente"}</strong><span className="mx-2 text-[#ccd3dc]">·</span>Capacidades comprovadas: <strong className="font-semibold text-[#a3722c]">{profile.verifiedCapabilities.length ? profile.verifiedCapabilities.join(", ") : "Pendente"}</strong></p>
                  {isAdmin && profile.reconciliationStatus !== "linked" && reconciled?.candidateAccounts?.length ? <div className="flex flex-wrap items-center gap-2">
                    <select value={linkTarget[profile.id] ?? ""} onChange={(event) => setLinkTarget((old) => ({ ...old, [profile.id]: event.target.value }))} data-testid={`select-account-match-${profile.id}`} className="max-w-[210px] rounded-md border border-[#dce3ec] bg-white px-2 py-1.5 text-[11px] text-[#344a64]">
                      <option value="">Correspondências candidatas ({reconciled.candidateAccounts.length})</option>{reconciled.candidateAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · cadastro {account.accountStatus} · assinatura {account.subscriptionStatus} · acesso {account.hasActiveClientUser ? "ativo" : "pendente"}</option>)}
                    </select>
                    <button onClick={() => { const id = Number(linkTarget[profile.id]); if (id) linkProfile.mutate({ id: profile.id, data: { companyId: id } }); }} disabled={!linkTarget[profile.id] || linkProfile.isPending} data-testid={`button-link-account-${profile.id}`} className="inline-flex items-center gap-1 rounded-md bg-[#17395f] px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-[#214c79] disabled:opacity-40"><Link2 className="h-3 w-3" />Confirmar vínculo</button>
                  </div> : isAdmin && profile.reconciliationStatus !== "linked" ? <span className="text-[10px] text-[#a3722c]">Correspondência: Pendente</span> : null}
                </div>
                {isAdmin && reconciled?.legacyRecords?.length ? <div className="mt-3 rounded-lg bg-[#f3f6f9] px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#8090a3]">Histórico legado · não é vínculo de conta</p><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">{reconciled.legacyRecords.map((record, index) => <span key={`${record.company}-${index}`} className="text-[10px] text-[#586c84]">{record.company} <span className="text-[#9aa7b7]">/ {record.status || "Status pendente"}</span></span>)}</div></div> : null}
              </article>;
            })}</div>}
          {isAdmin && reconciliationQuery.data && <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#f7f8fa] px-3 py-2.5 text-[10px] leading-4 text-[#718097]"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a18030]" />Histórico de perfil e correspondência de conta são estados distintos. Sugestões nunca são vinculadas sem confirmação humana.</div>}
        </section>

        <section className={cn(panel, "p-5 md:p-6")}>
          <SectionHeading eyebrow="02 / Proveniência" title="Fontes e cobertura" detail="Disponibilidade atual retornada pela plataforma." />
          {sourceQuery.isError ? <ErrorState message="Status das fontes indisponível." retry={() => void sourceQuery.refetch()} /> :
            <div className="space-y-2">{availableSources.length ? availableSources.map((source: Radar360SourceStatus) => <div key={source.kind} className="rounded-lg border border-[#e6ebf1] p-3.5" data-testid={`source-status-${source.kind}`}>
              <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-[#29415e]">{source.label}</p><p className="mt-1 text-[10px] text-[#8794a5]">{source.recordCount} registros observados <span className="mx-1.5">·</span> Verificado: {formatDate(source.lastCheckedAt)}</p></div><StatusText status={source.status} /></div>
              {source.limitations.length ? <ul className="mt-2 space-y-1 border-t border-[#eef1f5] pt-2">{source.limitations.map((limitation, index) => <li key={index} className="flex gap-1.5 text-[10px] leading-4 text-[#748398]"><span className="text-[#b18b35]">•</span>{limitation}</li>)}</ul> : <p className="mt-2 border-t border-[#eef1f5] pt-2 text-[10px] text-[#a3722c]">Limitações: Pendente</p>}
            </div>) : <EmptyInline label="Nenhuma fonte reportada pela plataforma." />}</div>}
          <div className="mt-4 rounded-lg border border-[#eadcb6] bg-[#fdf9ed] p-3.5"><p className="flex items-center gap-2 text-[11px] font-bold text-[#735c25]"><ShieldCheck className="h-4 w-4" />Cobertura transparente</p><p className="mt-1.5 text-[10px] leading-4 text-[#7e704d]">A presença de fontes não significa cobertura completa do Petronect. Campos de região, comprovação e origem ausentes permanecem como pendentes.</p></div>
        </section>
      </div>

      <section className={cn(panel, "mt-6 p-5 md:p-6")}>
        <SectionHeading eyebrow="03 / Entrada de dados" title="Importação CSV revisável" detail="Validar primeiro. Aplicar somente após conferir as linhas e pendências." />
        {!selectedProfile ? <EmptyInline label="Selecione ou crie um perfil antes de importar." /> : !canManageProfile ? <EmptyInline label="A prévia e aplicação de listas é restrita ao administrador da empresa." /> : <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
          <div className="space-y-3">
            <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-[#6e7f94]">Fonte declarada<input value={importSource} onChange={(event) => setImportSource(event.target.value)} placeholder="Informe a fonte consultada" data-testid="input-import-source" className={cn(inputClass, "mt-1.5")} /></label>
            <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-[#6e7f94]">Nome do arquivo<input value={csvFileName} onChange={(event) => setCsvFileName(event.target.value)} placeholder="oportunidades.csv" data-testid="input-import-filename" className={cn(inputClass, "mt-1.5")} /></label>
            <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-[#6e7f94]">Conteúdo CSV<textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="Cole o CSV recebido. Nenhum dado de exemplo é preenchido." data-testid="input-import-csv" rows={5} className={cn(inputClass, "mt-1.5 min-h-[116px] font-mono text-[11px]")} /></label>
            <button onClick={submitPreview} disabled={!csvText.trim() || !importSource.trim() || previewImport.isPending} data-testid="button-preview-import" className="inline-flex items-center gap-2 rounded-lg bg-[#17395f] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#214c79] disabled:cursor-not-allowed disabled:opacity-45"><Search className="h-3.5 w-3.5" />{previewImport.isPending ? "Validando arquivo…" : "Pré-visualizar importação"}</button>
          </div>
          <div className="min-w-0">
            {previewImport.error && <div className="mb-3"><ErrorState message="Não foi possível validar o CSV. Confira o conteúdo e tente novamente." retry={submitPreview} /></div>}
            {previewImport.data ? <div className="overflow-hidden rounded-xl border border-[#dce3ec]" data-testid="import-preview">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf3] bg-[#f8fafc] p-4"><div><p className="text-xs font-bold">Prévia da importação <span className="ml-1 text-[10px] font-medium text-[#8290a2]">#{previewImport.data.id}</span></p><p className="mt-1 text-[10px] text-[#748398]">{previewImport.data.totalRows} linhas · origem {previewImport.data.sourceName}</p></div><button onClick={() => applyImport.mutate({ id: previewImport.data!.id })} disabled={applyImport.isPending || previewImport.data.status !== "pending"} data-testid="button-apply-import" className="inline-flex items-center gap-1.5 rounded-md bg-[#b18b35] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#9b7626] disabled:opacity-45"><Check className="h-3.5 w-3.5" />{applyImport.isPending ? "Aplicando…" : "Aplicar linhas válidas"}</button></div>
              <div className="grid grid-cols-4 divide-x divide-[#edf0f4] border-b border-[#edf0f4]">{[["Novas", previewImport.data.newRows], ["Duplicadas", previewImport.data.duplicateRows], ["Inválidas", previewImport.data.invalidRows], ["Total", previewImport.data.totalRows]].map(([label, value]) => <div key={label} className="px-2 py-3 text-center"><p className="text-base font-extrabold text-[#1a3557]">{value}</p><p className="text-[9px] uppercase tracking-wider text-[#8492a4]">{label}</p></div>)}</div>
              <div className="max-h-72 overflow-auto"><table className="w-full text-left text-[10px]"><thead className="sticky top-0 bg-white text-[9px] uppercase tracking-wider text-[#8b98a8]"><tr><th className="px-3 py-2">Objeto</th><th className="px-3 py-2">Região</th><th className="px-3 py-2">Prazo</th><th className="px-3 py-2">Status / pendências</th></tr></thead><tbody>{previewImport.data.previewRows.map((row, i) => <tr key={`${row.sourceKey}-${i}`} className="border-t border-[#eef1f5]"><td className="max-w-[240px] px-3 py-2.5 font-medium text-[#344b66]">{row.object}<div className="text-[9px] text-[#8996a7]">{row.processNumber || "Número pendente"}</div></td><td className="px-3 py-2.5 text-[#64768d]">{row.region || "Pendente"}</td><td className="px-3 py-2.5 text-[#64768d]">{row.deadlineText || "Pendente"}</td><td className="px-3 py-2.5"><Tag tone={row.action === "new" ? "green" : row.action === "invalid" ? "red" : "neutral"}>{row.action}</Tag><div className="mt-1 text-[#a3722c]">{row.missingFields.length ? row.missingFields.join(", ") : row.status || "Dados declarados"}</div></td></tr>)}</tbody></table></div>
            </div> : <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-[#d5dde8] bg-[#fafbfd] px-6 text-center"><FileCheck2 className="h-8 w-8 text-[#9eacbd]" /><p className="mt-3 text-xs font-bold text-[#52677f]">A prévia aparece aqui</p><p className="mt-1 max-w-sm text-[10px] leading-4 text-[#8492a4]">Sem aplicação automática. A origem, linhas duplicadas, inválidas e campos ausentes serão apresentados para revisão.</p></div>}
          </div>
        </div>}
        {!!(importsQuery.data?.length) && <div className="mt-5 border-t border-[#edf0f4] pt-4"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.13em] text-[#7a899c]">Histórico recente</p><div className="flex flex-wrap gap-2">{importsQuery.data.slice(0, 5).map((entry) => <div key={entry.id} data-testid={`import-history-${entry.id}`} className="rounded-lg border border-[#e6ebf1] px-3 py-2"><span className="text-[10px] font-semibold text-[#435b76]">{entry.fileName}</span><span className="ml-2 text-[9px] text-[#8391a3]">{entry.newRows} novas · {entry.invalidRows} inválidas</span><span className="ml-2"><StatusText status={entry.status} /></span></div>)}</div></div>}
      </section>

      <section className={cn(panel, "mt-6 p-5 md:p-6")}>
        <SectionHeading eyebrow="04 / Edições" title="Gerar, revisar e publicar" detail="Uma edição nasce privada. Publicação só é habilitada para status pronto." action={<div className="inline-flex items-center gap-2 rounded-lg border border-[#e4e9ef] bg-[#fafbfd] px-3 py-2 text-[10px] text-[#7b899b]"><CalendarClock className="h-3.5 w-3.5" />Cadência: configurável · agenda desativada</div>} />
        {!selectedProfile ? <EmptyInline label="Selecione um perfil para criar ou consultar edições." /> : <div className="grid gap-5 xl:grid-cols-[minmax(240px,.55fr)_minmax(0,1.45fr)]">
          <div className="space-y-3">
            <div className="rounded-xl border border-[#e5eaf0] bg-[#fafbfd] p-4"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#6f8095]">Fontes desta varredura</p>
              {[
                ["catalog", "Catálogo disponível"], ["petronect_public_csv", "Petronect · CSV público"], ["client_import", "Importações da empresa"],
              ].map(([kind, label]) => {
                const source = availableSources.find((item: Radar360SourceStatus) => item.kind === kind);
                return <label key={kind} className="mb-2 flex cursor-pointer items-start gap-2 rounded-lg border border-[#e8edf3] bg-white p-2.5">
                  <input type="checkbox" checked={sourceKinds.includes(kind)} onChange={() => toggleSource(kind)} data-testid={`checkbox-source-${kind}`} className="mt-0.5 accent-[#b18b35]" />
                  <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-[#425a75]">{label}</span><span className="mt-0.5 block text-[9px] text-[#8895a6]">{source ? `${source.recordCount} registros · ${source.status === "success" ? "disponível" : source.status.replaceAll("_", " ")}` : "Status da fonte: Pendente"}</span></span>
                </label>;
              })}
              <button onClick={startRun} disabled={!sourceKinds.length || createRun.isPending} data-testid="button-create-edition" className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#17395f] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#214c79] disabled:opacity-45"><Plus className="h-4 w-4" />{createRun.isPending ? "Criando edição…" : "Criar edição privada"}</button>
            </div>
            {runsQuery.isError && <ErrorState message="Não foi possível carregar as edições." retry={() => void runsQuery.refetch()} />}
            <div className="space-y-2">{profileRuns.length ? profileRuns.map((run: Radar360RunSummary) => <button key={run.id} onClick={() => setSelectedRunId(run.id)} data-testid={`button-select-edition-${run.id}`} className={cn("w-full rounded-lg border p-3 text-left transition", activeRunId === run.id ? "border-[#c7a650] bg-[#fffdf7]" : "border-[#e5eaf0] hover:bg-[#fafbfd]")}>
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-[#354c67]">Edição #{run.id}</span><StatusText status={run.status} /></div><p className="mt-1.5 text-[10px] text-[#8492a4]">{formatDate(run.createdAt)} · {run.itemCount} oportunidades</p>{run.pendingFields.length > 0 && <p className="mt-1 text-[9px] text-[#a3722c]">{run.pendingFields.length} campos pendentes</p>}
            </button>) : <EmptyInline label="Nenhuma edição foi criada para este perfil." />}</div>
          </div>
          <div className="min-w-0">
            {runQuery.isLoading && <div className="h-80 animate-pulse rounded-xl bg-[#f0f3f7]" />}
            {runQuery.isError && <ErrorState message="Detalhes da edição indisponíveis." retry={() => void runQuery.refetch()} />}
            {!activeRun && !runQuery.isLoading ? <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-[#d5dde8] bg-[#fafbfd]"><Gauge className="h-8 w-8 text-[#aab7c7]" /><p className="mt-3 text-xs font-bold text-[#52677f]">Escolha uma edição para revisar</p></div> : null}
            {activeRun && <div className="overflow-hidden rounded-xl border border-[#dce3ec]" data-testid={`edition-detail-${activeRun.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf3] bg-[#f9fafc] p-4">
                <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">Edição {activeRun.id} <span className="font-normal text-[#8a97a7]">/ {activeRun.profileName}</span></h3><StatusText status={activeRun.status} /></div><p className="mt-1 text-[10px] text-[#8090a3]">Data-base {formatDate(activeRun.baseDate)} · versão de critérios {activeRun.scoreVersion}</p></div>
                <div className="flex flex-wrap gap-2">
                  {activeRun.status === "failed" && <button onClick={() => resumeRun.mutate({ id: activeRun.id })} disabled={resumeRun.isPending} data-testid={`button-resume-edition-${activeRun.id}`} className="inline-flex items-center gap-1.5 rounded-md border border-[#dce3ec] bg-white px-3 py-2 text-[10px] font-bold text-[#344e6c] disabled:opacity-50"><RefreshCw className="h-3 w-3" />Retomar</button>}
                  {activeRun.status === "ready" && <button onClick={() => publishRun.mutate({ id: activeRun.id })} disabled={publishRun.isPending} data-testid={`button-publish-edition-${activeRun.id}`} className="inline-flex items-center gap-1.5 rounded-md bg-[#b18b35] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50"><BadgeCheck className="h-3.5 w-3.5" />{publishRun.isPending ? "Publicando…" : "Publicar edição"}</button>}
                </div>
              </div>
              <div className="grid gap-0 divide-y divide-[#edf0f4] lg:grid-cols-[.85fr_1.15fr] lg:divide-x lg:divide-y-0">
                <div className="space-y-4 p-4">
                  <div><p className="mb-2 text-[9px] font-bold uppercase tracking-[.14em] text-[#8794a5]">Cobertura de origem</p>{activeRun.sourceCoverage.length ? <div className="space-y-1.5">{activeRun.sourceCoverage.map((coverage) => <div key={coverage.kind} className="flex items-center justify-between gap-2 rounded-md bg-[#f8fafc] px-2.5 py-2"><div><p className="text-[10px] font-semibold text-[#4d627b]">{coverage.label}</p><p className="text-[9px] text-[#8b98a8]">{coverage.recordCount} registros · {formatDate(coverage.checkedAt)}</p></div><StatusText status={coverage.status} /></div>)}</div> : <p className="text-[10px] text-[#a3722c]">Cobertura: Pendente</p>}</div>
                  <div><p className="mb-2 text-[9px] font-bold uppercase tracking-[.14em] text-[#8794a5]">Critérios de pontuação</p><div className="space-y-1.5">{Object.entries(activeRun.scoreWeights).length ? Object.entries(activeRun.scoreWeights).map(([criterion, weight]) => <div key={criterion} className="flex justify-between rounded-md border border-[#edf0f4] px-2.5 py-2 text-[10px]"><span className="text-[#52677f]">{criterion.replaceAll("_", " ")}</span><strong className="font-mono text-[#29415e]">{weight}%</strong></div>) : <p className="text-[10px] text-[#a3722c]">Critérios: Pendente</p>}</div></div>
                  {(activeRun.warnings.length > 0 || activeRun.pendingFields.length > 0) && <div className="rounded-lg border border-[#eadcb6] bg-[#fdf9ed] p-3"><p className="text-[10px] font-bold text-[#735c25]">Pendências e avisos</p><ul className="mt-1.5 space-y-1 text-[9px] leading-4 text-[#806f48]">{[...activeRun.pendingFields.map((field) => `Pendente: ${field}`), ...activeRun.warnings].map((warning, i) => <li key={i}>· {warning}</li>)}</ul></div>}
                </div>
                <div className="min-w-0 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#8794a5]">Visualização privada</p><div className="flex gap-2"><a href={activeRun.imageReady ? getGetRadar360RunImageUrl(activeRun.id) : undefined} download={`petron-radar-360-${activeRun.id}.svg`} aria-disabled={!activeRun.imageReady} data-testid={`link-download-edition-image-${activeRun.id}`} className={cn("inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[9px] font-semibold", activeRun.imageReady ? "border-[#dce3ec] bg-white text-[#455d78] hover:bg-[#f5f7fa]" : "pointer-events-none border-[#e9edf2] bg-[#f7f8fa] text-[#a8b2bf]")}><ArrowDownToLine className="h-3 w-3" />SVG</a><a href={activeRun.editionText ? `data:text/plain;charset=utf-8,${encodeURIComponent(activeRun.editionText)}` : undefined} download={`petron-radar-360-${activeRun.id}.txt`} aria-disabled={!activeRun.editionText} data-testid={`link-download-edition-text-${activeRun.id}`} className={cn("inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[9px] font-semibold", activeRun.editionText ? "border-[#dce3ec] bg-white text-[#455d78] hover:bg-[#f5f7fa]" : "pointer-events-none border-[#e9edf2] bg-[#f7f8fa] text-[#a8b2bf]")}><ArrowDownToLine className="h-3 w-3" />Texto</a></div></div>
                  {activeRun.imageReady ? <div className="mb-4 flex min-h-[160px] items-center justify-center overflow-hidden rounded-lg border border-[#e6ebf1] bg-[#f8fafc] p-2"><img src={getGetRadar360RunImageUrl(activeRun.id)} alt={`Arte SVG privada da edição ${activeRun.id}`} data-testid={`img-edition-preview-${activeRun.id}`} className="max-h-[210px] max-w-full object-contain" /></div> : <div className="mb-4 flex min-h-[90px] items-center justify-center gap-2 rounded-lg border border-dashed border-[#d8e0e9] bg-[#fafbfd] text-[10px] text-[#8a97a7]"><FileImage className="h-4 w-4" />Imagem: Pendente</div>}
                  <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-[#102748] p-3 font-mono text-[9px] leading-4 text-[#d9e2ed]" data-testid={`text-edition-content-${activeRun.id}`}>{activeRun.editionText || "Texto da edição: Pendente"}</pre>
                </div>
              </div>
              <div className="border-t border-[#e8edf3] bg-[#fcfdfe] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#8794a5]">Oportunidades avaliadas</p><p className="mt-1 text-[10px] text-[#8290a2]">{activeRun.items.length} itens · dados apresentados conforme fonte</p></div><Filter className="h-4 w-4 text-[#a1adbb]" /></div>
                {activeRun.items.length ? <div className="space-y-2">{activeRun.items.map((item) => <details key={item.id} className="group rounded-lg border border-[#e6ebf1] bg-white" data-testid={`opportunity-item-${item.id}`}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-bold text-[#344d69]">{item.object}</span><Tag tone={item.category === "gold" ? "gold" : item.category === "complementary" ? "blue" : "neutral"}>{item.category}</Tag>{item.expired && <Tag tone="red">Expirada</Tag>}</div><p className="mt-1 text-[9px] text-[#8693a4]">{item.contractor || "Contratante pendente"} · {item.region || "Região pendente"} · prazo {item.deadlineText || "Pendente"}</p></div><div className="text-right"><p className="font-mono text-sm font-bold text-[#284362]">{item.fitScore === null ? "Pendente" : `${item.fitScore} pts`}</p><p className="text-[9px] text-[#8896a7]">{item.status || "Status pendente"}</p></div><ChevronDown className="h-3.5 w-3.5 text-[#8a97a7] transition group-open:rotate-180" /></summary>
                  <div className="grid gap-3 border-t border-[#eef1f5] p-3 md:grid-cols-[1fr_1fr]"><div><p className="text-[9px] font-bold uppercase tracking-wider text-[#8996a7]">Justificativa</p><p className="mt-1 text-[10px] leading-4 text-[#596e86]">{item.justification || "Justificativa: Pendente"}</p><p className="mt-2 text-[9px] text-[#a3722c]">Campos pendentes: {item.pendingFields.length ? item.pendingFields.join(", ") : "Nenhum reportado"}</p>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" data-testid={`link-source-item-${item.id}`} className="mt-2 inline-flex items-center gap-1 text-[9px] font-semibold text-[#45688e] hover:underline">Abrir fonte <ArrowRight className="h-3 w-3" /></a> : <p className="mt-2 text-[9px] text-[#a3722c]">URL da fonte: Pendente</p>}</div><div><p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-[#8996a7]">Critérios do score</p>{item.scoreBreakdown.length ? item.scoreBreakdown.map((line, index) => <div key={index} className="mb-1 flex items-center justify-between gap-2 rounded bg-[#f8fafc] px-2 py-1.5 text-[9px]"><span className="text-[#5e7188]">{line.criterion}</span><span className="font-mono text-[#415b77]">{line.points}/{line.weight}</span><StatusText status={line.state} /></div>) : <p className="text-[9px] text-[#a3722c]">Critérios: Pendente</p>}</div></div>
                </details>)}</div> : <EmptyInline label="Nenhuma oportunidade nesta edição." />}
              </div>
            </div>}
          </div>
        </div>}
      </section>

      <section className={cn(panel, "mt-6 p-5 md:p-6")}>
        <SectionHeading eyebrow="05 / Evidências privadas" title="Arquivos do perfil" detail="Logo e documentação permanecem privados; revisão de capacidade é explícita." />
        {!selectedProfile ? <EmptyInline label="Selecione um perfil para consultar evidências." /> : <div className="grid gap-5 lg:grid-cols-[minmax(240px,.7fr)_1.3fr]">
          <div className="rounded-xl border border-[#e5eaf0] bg-[#fafbfd] p-4">
            <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-[#6e7f94]">Tipo de arquivo<select value={uploadKind} onChange={(event) => setUploadKind(event.target.value as typeof uploadKind)} data-testid="select-upload-kind" className={cn(inputClass, "mt-1.5")}>
              <option value="capability_document">Comprovação de capacidade</option><option value="logo">Logo da empresa</option><option value="source_document">Documento de origem</option>
            </select></label>
            {uploadKind === "capability_document" && <label className="mt-3 block text-[10px] font-bold uppercase tracking-[.12em] text-[#6e7f94]">Capacidade a comprovar<input value={capabilityLabel} onChange={(event) => setCapabilityLabel(event.target.value)} maxLength={160} placeholder="Ex.: manutenção industrial" data-testid="input-capability-label" className={cn(inputClass, "mt-1.5")} /></label>}
            <input ref={fileInput} type="file" accept={uploadKind === "logo" ? "image/png,image/jpeg,image/webp" : ".pdf,.doc,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.webp"} onChange={(event) => void uploadSelectedFile(event.target.files?.[0])} data-testid="input-profile-file" className="sr-only" />
            {canManageProfile ? <button onClick={() => fileInput.current?.click()} disabled={!profileId || busyFile || (uploadKind === "capability_document" && !capabilityLabel.trim())} data-testid="button-upload-profile-file" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#d8c17f] bg-[#fcf7e9] px-3 py-2.5 text-xs font-bold text-[#765d20] hover:bg-[#f8efd6] disabled:opacity-50"><Upload className="h-4 w-4" />{busyFile ? "Enviando arquivo…" : "Selecionar arquivo privado"}</button> : <p className="mt-3 text-[10px] text-[#8a97a7]">Envio restrito ao administrador da empresa.</p>}
            <p className="mt-2 text-[9px] leading-4 text-[#8794a5]">{uploadKind === "logo" ? "PNG, JPEG ou WebP · até 4 MB." : "PDF, Office, CSV ou imagem · até 20 MB. O conteúdo segue para URL privada temporária."}</p>
          </div>
          <div>{filesQuery.isLoading ? <div className="h-32 animate-pulse rounded-lg bg-[#f0f3f7]" /> : filesQuery.isError ? <ErrorState message="Não foi possível carregar os arquivos." retry={() => void filesQuery.refetch()} /> : filesQuery.data?.length ? <div className="space-y-2">{filesQuery.data.map((file) => <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e6ebf1] p-3" data-testid={`file-row-${file.id}`}>
             <div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef3f8] text-[#57708b]">{file.kind === "logo" ? <FileImage className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</div><div className="min-w-0"><p className="truncate text-[11px] font-bold text-[#435a75]">{file.originalName}</p><p className="text-[9px] text-[#8996a7]">{file.kind.replaceAll("_", " ")}{file.capabilityLabel ? ` · ${file.capabilityLabel}` : ""} · {(file.fileSize / 1024).toFixed(0)} KB · {formatDate(file.createdAt)}</p></div></div>
             <div className="flex items-center gap-2"><StatusText status={file.status} />{["ready", "verified"].includes(file.status) && <a href={getDownloadRadar360FileUrl(file.id)} data-testid={`link-download-file-${file.id}`} download={file.originalName} className="rounded-md border border-[#dce3ec] p-2 text-[#58708c] hover:bg-[#f5f7fa]" aria-label={`Baixar ${file.originalName}`}><ArrowDownToLine className="h-3.5 w-3.5" /></a>}{isAdmin && file.kind === "capability_document" && <button onClick={() => verifyFile.mutate({ id: file.id, data: { verified: file.status !== "verified" } })} disabled={verifyFile.isPending || file.status === "pending"} data-testid={`button-verify-file-${file.id}`} className="rounded-md border border-[#dce3ec] px-2.5 py-1.5 text-[9px] font-bold text-[#4a617c] hover:bg-[#f5f7fa] disabled:opacity-50">{file.status === "verified" ? "Retirar verificação" : "Marcar revisada"}</button>}</div>
          </div>)}</div> : <div className="flex min-h-[110px] items-center justify-center rounded-xl border border-dashed border-[#d5dde8] bg-[#fafbfd] text-center text-[10px] text-[#8492a4]" data-testid="empty-profile-files"><div><FileCheck2 className="mx-auto mb-2 h-5 w-5 text-[#aab7c7]" />Nenhum arquivo privado cadastrado.<p className="mt-1 text-[#a3722c]">Comprovação: Pendente</p></div></div>}</div>
        </div>}
      </section>
      <section className={cn(panel, "mt-6 p-5 md:p-6")}>
        <SectionHeading eyebrow="06 / Histórico" title="Execuções e erros" detail="Registro privado de prévias, importações, varreduras, retomadas e publicações." />
        {!selectedProfile ? <EmptyInline label="Selecione um perfil para consultar o histórico." /> :
          eventsQuery.isLoading ? <div className="h-24 animate-pulse rounded-lg bg-[#f0f3f7]" /> :
            eventsQuery.isError ? <ErrorState message="Histórico indisponível." retry={() => void eventsQuery.refetch()} /> :
              eventsQuery.data?.length ? <div className="space-y-2" data-testid="radar360-event-log">
                {eventsQuery.data.map((event) => <article key={event.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[#e6ebf1] bg-white px-3.5 py-3" data-testid={`event-row-${event.id}`}>
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[11px] font-bold text-[#405771]">{eventLabel(event.eventType)}</p>{event.runId != null && <span className="text-[9px] text-[#8a97a7]">Edição #{event.runId}</span>}{event.importId != null && <span className="text-[9px] text-[#8a97a7]">Importação #{event.importId}</span>}</div><p className="mt-1 text-[10px] leading-4 text-[#718097]">{event.message}</p></div>
                  <div className="flex shrink-0 items-center gap-2"><StatusText status={event.status} /><time className="text-[9px] text-[#8a97a7]">{formatDate(event.createdAt)}</time></div>
                </article>)}
              </div> : <EmptyInline label="Nenhuma execução registrada para este perfil." />}
      </section>
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#dfe5ed] py-4 text-[9px] text-[#8492a4]"><span>Petron Radar Premium · Varredura 360</span><span>Dados observados não substituem validação na fonte oficial.</span></footer>
    </div>

    {isAdmin && createOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a1d33]/55 p-4" role="dialog" aria-modal="true" aria-labelledby="create-profile-heading">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl md:p-7">
        <div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a18030]">Vínculo manual</p><h2 id="create-profile-heading" className="mt-1 font-serif text-xl font-extrabold">Criar perfil para uma conta</h2><p className="mt-1 text-[10px] text-[#7b899b]">A seleção abaixo cria um perfil e vincula somente a conta escolhida.</p></div><button onClick={() => setCreateOpen(false)} data-testid="button-close-create-profile" aria-label="Fechar criação" className="rounded-md p-2 text-[#748398] hover:bg-[#f1f4f7]"><X className="h-4 w-4" /></button></div>
        <label className="block text-[10px] font-bold uppercase tracking-[.1em] text-[#6e7f94]">Conta existente<select value={newCompanyId} onChange={(event) => setNewCompanyId(event.target.value)} data-testid="select-create-profile-company" className={cn(inputClass, "mt-1.5")}>
          <option value="">Selecione uma conta sem referência correspondente</option>{(reconciliationQuery.data?.accounts ?? []).filter((account) => !matchedCompanyIds.has(account.id)).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.segment || "segmento pendente"} · cadastro {account.accountStatus} · assinatura {account.subscriptionStatus} · acesso {account.hasActiveClientUser ? "ativo" : "pendente"}</option>)}
        </select></label>
        {!(reconciliationQuery.data?.accounts?.filter((account) => !matchedCompanyIds.has(account.id)).length) && <p className="mt-2 text-[10px] text-[#a3722c]">As contas existentes correspondem a perfis históricos; revise e vincule esses perfis para evitar duplicação.</p>}
        <div className="mt-6 flex justify-end gap-2"><button onClick={() => setCreateOpen(false)} data-testid="button-cancel-create-profile" className="rounded-lg border border-[#dce3ec] px-4 py-2 text-xs font-semibold text-[#63738a]">Cancelar</button><button onClick={() => { const companyId = Number(newCompanyId); if (companyId) createProfile.mutate({ data: { companyId } }); }} disabled={!newCompanyId || createProfile.isPending} data-testid="button-confirm-create-profile" className="rounded-lg bg-[#17395f] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{createProfile.isPending ? "Criando…" : "Criar e vincular"}</button></div>
      </div>
    </div>}
    {canManageProfile && editOpen && selectedProfile && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a1d33]/55 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-profile-heading">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl md:p-7">
        <div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a18030]">Configuração explícita</p><h2 id="edit-profile-heading" className="mt-1 font-serif text-xl font-extrabold">Editar perfil de varredura</h2></div><button onClick={() => setEditOpen(false)} data-testid="button-close-edit-profile" aria-label="Fechar edição" className="rounded-md p-2 text-[#748398] hover:bg-[#f1f4f7]"><X className="h-4 w-4" /></button></div>
        <div className="grid gap-3 sm:grid-cols-2">{[
          ...(isAdmin ? [["displayName", "Nome de exibição"]] : []), ["aliases", "Nomes alternativos"], ["focusAreas", "Setores e áreas de foco"], ["declaredCapabilities", "Capacidades declaradas"], ["regions", "Regiões"], ["keywords", "Palavras-chave"], ["exclusions", "Exclusões"],
        ].map(([key, label]) => <label key={key} className="block text-[10px] font-bold uppercase tracking-[.1em] text-[#6e7f94]">{label}<input value={editDraft[key] ?? ""} onChange={(event) => setEditDraft((old) => ({ ...old, [key]: event.target.value }))} data-testid={`input-profile-${key}`} className={cn(inputClass, "mt-1.5")} placeholder={key === "regions" ? "Pendente se não informado" : "Separe itens por vírgula"} /></label>)}
          <label className="flex items-start gap-2 rounded-lg border border-[#e5eaf0] bg-[#fafbfd] p-3 text-[10px] text-[#596e86] sm:col-span-2"><input type="checkbox" checked={editDraft.exclusionsReviewed === "true"} onChange={(event) => setEditDraft((old) => ({ ...old, exclusionsReviewed: event.target.checked ? "true" : "false" }))} data-testid="checkbox-exclusions-reviewed" className="mt-0.5 accent-[#b18b35]" /><span><strong>Revisei as exclusões deste perfil.</strong><span className="mt-1 block text-[9px] text-[#8794a5]">Marque mesmo quando não houver termos a excluir; isso não habilita oportunidades automaticamente.</span></span></label>
          <label className="block text-[10px] font-bold uppercase tracking-[.1em] text-[#6e7f94]">Cadência desejada<select value={editDraft.cadence ?? "manual"} onChange={(event) => setEditDraft((old) => ({ ...old, cadence: event.target.value }))} data-testid="select-profile-cadence" className={cn(inputClass, "mt-1.5")}><option value="manual">Manual</option><option value="daily">Diária desejada</option><option value="weekly">Semanal desejada</option></select><span className="mt-1 block text-[9px] font-normal normal-case text-[#a3722c]">Agendamento continua desativado; a cadência é apenas uma preferência.</span></label>
        </div>
        <div className="mt-6 flex justify-end gap-2"><button onClick={() => setEditOpen(false)} data-testid="button-cancel-edit-profile" className="rounded-lg border border-[#dce3ec] px-4 py-2 text-xs font-semibold text-[#63738a]">Cancelar</button><button onClick={saveEdit} disabled={updateProfile.isPending} data-testid="button-save-profile" className="rounded-lg bg-[#17395f] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{updateProfile.isPending ? "Salvando…" : "Salvar perfil"}</button></div>
      </div>
    </div>}
  </main>;
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof Building2; label: string; value: number; note: string }) {
  return <div className="rounded-xl border border-[#dce3ec] bg-white p-4 shadow-[0_8px_24px_rgba(17,38,65,.025)]" data-testid={`metric-${label.toLowerCase().replaceAll(" ", "-")}`}><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#8794a5]">{label}</p><p className="mt-2 font-serif text-2xl font-extrabold tracking-[-.04em] text-[#163454]">{value}</p></div><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f7f2e5] text-[#9a792b]"><Icon className="h-4 w-4" /></span></div><p className="mt-1 text-[9px] text-[#8b98a8]">{note}</p></div>;
}

function EmptyInline({ label }: { label: string }) {
  return <div className="rounded-lg border border-dashed border-[#d8e0e9] bg-[#fafbfd] px-4 py-5 text-center text-[10px] text-[#8693a4]" data-testid="empty-inline">{label}</div>;
}
