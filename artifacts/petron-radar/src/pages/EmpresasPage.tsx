import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Search, CheckCircle2, XCircle, Plus,
  RefreshCw, CreditCard, Users, Phone, Mail, MapPin, Loader2,
  ClipboardList, Copy, KeyRound, History, ChevronLeft, ChevronRight
} from "lucide-react";
import { formatDate } from "@/lib/formatters";

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

const PLAN_LABELS: Record<string, string> = {
  "radar-lancamento": "Lançamento R$500",
  "radar-starter": "Starter R$890",
  "radar-pro": "Pro R$2.490",
  "radar-enterprise": "Enterprise R$5.990",
  "radar-ia-managed": "IA Managed R$12.900",
};

const PLAN_PRICES: Record<string, number> = {
  "radar-lancamento": 500,
  "radar-starter": 890,
  "radar-pro": 2490,
  "radar-enterprise": 5990,
  "radar-ia-managed": 12900,
};

const STATUS_COLORS: Record<string, string> = {
  ativa: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  suspensa: "bg-red-500/10 text-red-500 border-red-500/20",
  inativa: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const SUBSCRIPTION_STATUS_COLORS: Record<string, string> = {
  ativo: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  trial: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  suspenso: "bg-red-500/10 text-red-500 border-red-500/20",
  inadimplente: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  cancelado: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const paidCompanySchema = z.object({
  razaoSocial: z.string().trim().min(2, "Informe a razão social"),
  nomeFantasia: z.string().trim().min(2, "Informe o nome fantasia"),
  cnpj: z.string().refine(value => value.replace(/\D/g, "").length === 14, "Informe um CNPJ com 14 dígitos"),
  cidade: z.string().trim().min(2, "Informe a cidade"),
  estado: z.string().trim().regex(/^[a-z]{2}$/i, "Use a sigla do estado"),
  email: z.string().trim().email("E-mail inválido"),
  adminName: z.string().trim().min(2, "Informe o nome do administrador"),
  telefone: z.string(),
  segmento: z.string().trim().min(2, "Informe o segmento"),
  planSlug: z.enum(["radar-lancamento", "radar-starter", "radar-pro", "radar-enterprise", "radar-ia-managed"]),
  paymentAmount: z.string().refine(value => Number.isFinite(Number(value)) && Number(value) > 0, "Informe o valor pago"),
  nextBillingAmount: z.string().refine(value => Number.isFinite(Number(value)) && Number(value) > 0, "Informe o valor mensal combinado"),
  renewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de renovação"),
});

type PaidCompanyFormValues = z.infer<typeof paidCompanySchema>;

interface Company {
  id: number; razao_social: string; nome_fantasia: string; cnpj: string;
  cidade: string; estado: string; email: string; telefone: string | null;
  segmento: string; socio_administrador: string | null; capital_social: number | null;
  status: string; notes: string | null; created_at: string;
  plan_slug: string | null; subscription_status: string | null;
  renewal_date: string | null; last_payment_at: string | null;
  last_payment_amount: number | null; next_billing_amount: number | null;
  admin_email: string | null; user_count: string;
  admins: CompanyAdmin[];
}

interface CompanyAdmin {
  id: number;
  nome: string;
  email: string;
}

interface Inquiry {
  id: number; companyName: string; cnpj: string; contactName: string;
  contactRole: string; email: string; whatsapp: string; segment: string;
  status: string; desiredPlan: string; recommendedPlan: string;
  leadScore: number; createdAt: string;
}

interface AdminRecoveryAttempt {
  id: number;
  attemptedAt: string;
  result: string;
}

interface AdminRecoveryHistoryResponse {
  attempts: AdminRecoveryAttempt[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const RECOVERY_HISTORY_PAGE_SIZE = 20;

const RECOVERY_RESULT_LABELS: Record<string, string> = {
  success: "Recuperação concluída",
  invalid_credential: "Credencial inválida",
  rate_limited: "Tentativa bloqueada por limite",
  unavailable: "Conta administrativa indisponível",
  error: "Falha ao concluir",
  in_progress: "Em andamento",
  interrupted: "Interrompida",
};

interface CreatedCredentials {
  companyId: number;
  userId: number;
  temporaryPassword: string;
  adminEmail: string;
  renewalDate: string;
}

interface ReissuedCredentials {
  companyId: number;
  userId: number;
  temporaryPassword: string;
  adminEmail: string;
}

interface ReissueDialogState {
  company: Company;
  selectedAdminId: string;
  credentials?: ReissuedCredentials;
}

interface SeededCredential {
  companyName: string;
  adminEmail: string;
  temporaryPassword: string;
  mustSetPassword: boolean;
}

function defaultRenewalDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function formatBRL(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getInquiryStatus(value: string): string {
  const status = value.toLowerCase();
  if (status === "em análise") return "Em Análise";
  if (status === "qualificado") return "Qualificado";
  if (status === "descartado") return "Descartado";
  return "novo";
}

export default function EmpresasPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<Company | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentRenewal, setPaymentRenewal] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [seedResult, setSeedResult] = useState<SeededCredential[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [recoveryAttempts, setRecoveryAttempts] = useState<AdminRecoveryAttempt[]>([]);
  const [recoveryHistoryPage, setRecoveryHistoryPage] = useState(1);
  const [recoveryHistoryTotal, setRecoveryHistoryTotal] = useState(0);
  const [recoveryHistoryTotalPages, setRecoveryHistoryTotalPages] = useState(0);
  const [recoveryHistoryLoading, setRecoveryHistoryLoading] = useState(true);
  const [recoveryHistoryError, setRecoveryHistoryError] = useState("");
  const [inquiryActionLoading, setInquiryActionLoading] = useState<number | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const [reissueDialog, setReissueDialog] = useState<ReissueDialogState | null>(null);
  const paidCompanyForm = useForm<PaidCompanyFormValues>({
    resolver: zodResolver(paidCompanySchema),
    defaultValues: {
      razaoSocial: "", nomeFantasia: "", cnpj: "", cidade: "", estado: "",
      email: "", adminName: "", telefone: "", segmento: "",
      planSlug: "radar-lancamento", paymentAmount: "500",
      nextBillingAmount: "890", renewalDate: defaultRenewalDate(),
    },
  });

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/companies");
      setCompanies(data as Company[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInquiries = useCallback(async () => {
    setInquiriesLoading(true);
    try {
      const data = await apiFetch("/api/companies/inquiries");
      setInquiries(data as Inquiry[]);
    } catch (error) {
      toast({
        title: "Não foi possível carregar os interessados",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setInquiriesLoading(false);
    }
  }, [toast]);

  const fetchRecoveryHistory = useCallback(async () => {
    setRecoveryHistoryLoading(true);
    setRecoveryHistoryError("");
    try {
      const query = new URLSearchParams({
        page: String(recoveryHistoryPage),
        pageSize: String(RECOVERY_HISTORY_PAGE_SIZE),
      });
      const data = await apiFetch(
        `/api/auth/admin/recovery-history?${query.toString()}`,
      ) as AdminRecoveryHistoryResponse;
      setRecoveryAttempts(data.attempts);
      setRecoveryHistoryTotal(data.total);
      setRecoveryHistoryTotalPages(data.totalPages);
      if (data.totalPages > 0 && recoveryHistoryPage > data.totalPages) {
        setRecoveryHistoryPage(data.totalPages);
      } else if (data.totalPages === 0 && recoveryHistoryPage !== 1) {
        setRecoveryHistoryPage(1);
      }
    } catch (error) {
      setRecoveryHistoryError(error instanceof Error ? error.message : "Tente novamente.");
    } finally {
      setRecoveryHistoryLoading(false);
    }
  }, [recoveryHistoryPage]);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchCompanies();
    void fetchInquiries();
    void fetchRecoveryHistory();
  }, [fetchCompanies, fetchInquiries, fetchRecoveryHistory, isAdmin]);

  function startCompanyRegistration(inquiry?: Inquiry) {
    setSelectedInquiry(inquiry ?? null);
    const recommended = inquiry?.recommendedPlan && inquiry.recommendedPlan in PLAN_PRICES
      ? inquiry.recommendedPlan
      : "radar-lancamento";
    paidCompanyForm.reset({
      razaoSocial: inquiry?.companyName ?? "",
      nomeFantasia: inquiry?.companyName ?? "",
      cnpj: inquiry?.cnpj ?? "",
      cidade: "",
      estado: "",
      email: inquiry?.email ?? "",
      adminName: inquiry?.contactName ?? "",
      telefone: inquiry?.whatsapp ?? "",
      segmento: inquiry?.segment ?? "",
      planSlug: recommended as PaidCompanyFormValues["planSlug"],
      paymentAmount: String(PLAN_PRICES[recommended]),
      nextBillingAmount: String(recommended === "radar-lancamento" ? 890 : PLAN_PRICES[recommended]),
      renewalDate: defaultRenewalDate(),
    });
    setShowCreateModal(true);
  }

  async function handleInquiryStatus(id: number, status: string) {
    setInquiryActionLoading(id);
    try {
      await apiFetch(`/api/inquiries/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await fetchInquiries();
    } catch (error) {
      toast({
        title: "Não foi possível atualizar a solicitação",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setInquiryActionLoading(null);
    }
  }

  async function handleCreatePaidCompany(values: PaidCompanyFormValues) {
    setCreatingCompany(true);
    try {
      const result = await apiFetch("/api/companies", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          inquiryId: selectedInquiry?.id,
          adminEmail: values.email,
          paymentAmount: Number(values.paymentAmount),
          nextBillingAmount: Number(values.nextBillingAmount),
        }),
      }) as CreatedCredentials;
      setCreatedCredentials(result);
      setShowCreateModal(false);
      setSelectedInquiry(null);
      toast({ title: "Conta criada", description: "Copie a senha temporária para entregar o primeiro acesso." });
      await Promise.all([fetchCompanies(), fetchInquiries()]);
    } catch (error) {
      toast({
        title: "Não foi possível cadastrar a empresa",
        description: error instanceof Error ? error.message : "Revise os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCreatingCompany(false);
    }
  }

  async function copyTemporaryCredentials() {
    if (!createdCredentials) return;
    const text = `E-mail: ${createdCredentials.adminEmail}\nSenha temporária: ${createdCredentials.temporaryPassword}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Acesso copiado", description: "Envie esses dados ao administrador da empresa." });
    } catch {
      toast({
        title: "Não foi possível copiar automaticamente",
        description: "Selecione o e-mail e a senha exibidos para copiá-los manualmente.",
      });
    }
  }

  async function handleAccess(id: number, action: "liberar" | "suspender") {
    setActionLoading(id);
    try {
      await apiFetch(`/api/companies/${id}/access`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      await fetchCompanies();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReissueTemporaryPassword() {
    if (!reissueDialog || !reissueDialog.selectedAdminId) return;
    const company = reissueDialog.company;
    setActionLoading(company.id);
    try {
      const credentials = await apiFetch(`/api/companies/${company.id}/temporary-password`, {
        method: "POST",
        body: JSON.stringify({ adminUserId: Number(reissueDialog.selectedAdminId) }),
      }) as ReissuedCredentials;
      setReissueDialog({ company, selectedAdminId: reissueDialog.selectedAdminId, credentials });
      toast({ title: "Senha temporária reemitida", description: "A senha anterior deixou de funcionar." });
    } catch (error) {
      toast({
        title: "Não foi possível reemitir a senha",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function copyReissuedCredentials() {
    if (!reissueDialog?.credentials) return;
    const { adminEmail, temporaryPassword } = reissueDialog.credentials;
    try {
      await navigator.clipboard.writeText(`E-mail: ${adminEmail}\nSenha temporária: ${temporaryPassword}`);
      toast({ title: "Acesso copiado", description: "Entregue os dados ao administrador da empresa." });
    } catch {
      toast({
        title: "Não foi possível copiar automaticamente",
        description: "Selecione o e-mail e a senha exibidos para copiá-los manualmente.",
      });
    }
  }

  async function handleSeed() {
    if (!bootstrapToken) return;
    setSeeding(true);
    try {
      const res = await apiFetch("/api/admin/seed-companies", {
        method: "POST",
        headers: { Authorization: `Bearer ${bootstrapToken}` },
      });
      setSeedResult((res as { results?: SeededCredential[] }).results ?? []);
      setBootstrapToken("");
      await fetchCompanies();
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "";
      const description = errorCode === "bootstrap_unavailable"
        ? "Configure BOOTSTRAP_AUTH_TOKEN como Secret no servidor da API antes de inicializar a base."
        : errorCode === "bootstrap_unauthorized"
          ? "O código informado não foi aceito. Confira o Secret configurado no servidor."
          : errorCode === "already_seeded"
            ? "A base já possui usuários; a inicialização foi bloqueada."
            : "Tente novamente após verificar a configuração da API.";
      toast({ title: "Não foi possível cadastrar as empresas iniciais", description, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  }

  async function copySeedCredentials() {
    const text = seedResult
      .map(({ companyName, adminEmail, temporaryPassword }) =>
        `Empresa: ${companyName}\nE-mail: ${adminEmail}\nSenha temporária: ${temporaryPassword}`,
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Acessos copiados", description: "Entregue cada senha ao administrador correspondente." });
    } catch {
      toast({
        title: "Não foi possível copiar automaticamente",
        description: "Selecione os dados exibidos para copiá-los manualmente.",
      });
    }
  }

  async function handleRegisterPayment() {
    if (!showPaymentModal || !paymentAmount) return;
    const sub = companies.find(c => c.id === showPaymentModal.id);
    if (!sub) return;
    const subRows = await apiFetch("/api/subscriptions");
    const subRecord = (subRows as any[]).find((s: any) => s.company_id === showPaymentModal.id);
    if (!subRecord) return;
    await apiFetch(`/api/subscriptions/${subRecord.id}/payment`, {
      method: "POST",
      body: JSON.stringify({ amount: Number(paymentAmount), renewalDate: paymentRenewal || undefined }),
    });
    setShowPaymentModal(null);
    setPaymentAmount("");
    setPaymentRenewal("");
    await fetchCompanies();
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Acesso restrito ao Admin Petron
      </div>
    );
  }

  const filtered = companies.filter(c =>
    search === "" ||
    c.razao_social.toLowerCase().includes(search.toLowerCase()) ||
    c.nome_fantasia.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Empresas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {companies.length} empresa{companies.length !== 1 ? "s" : ""} cadastrada{companies.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => startCompanyRegistration()} data-testid="button-create-paid-company">
            <Plus className="h-4 w-4 mr-2" />Nova empresa paga
          </Button>
          <Button variant="outline" size="sm" onClick={fetchCompanies}>
            <RefreshCw className="h-4 w-4 mr-2" />Atualizar
          </Button>
        </div>
      </div>

      {companies.length === 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">Inicialização protegida</CardTitle>
            </div>
            <CardDescription>
              Para uma base vazia, configure um BOOTSTRAP_AUTH_TOKEN aleatório (mínimo de 32 bytes) como Secret no servidor da API.
              Informe o mesmo código aqui. Ele será enviado apenas nesta chamada e não ficará salvo no navegador.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 space-y-2">
              <Label htmlFor="bootstrap-token">Código de autorização de bootstrap</Label>
              <Input
                id="bootstrap-token"
                type="password"
                autoComplete="off"
                value={bootstrapToken}
                onChange={(event) => setBootstrapToken(event.target.value)}
                placeholder="Cole o código configurado como Secret"
                disabled={seeding}
              />
            </div>
            <Button
              className="sm:mt-7"
              onClick={handleSeed}
              disabled={seeding || !bootstrapToken}
            >
              {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Cadastrar empresas iniciais
            </Button>
          </CardContent>
        </Card>
      )}

      {seedResult.length > 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-medium text-emerald-500">Acessos iniciais</p>
                <p className="text-xs text-muted-foreground">Copie e entregue as senhas; elas não serão exibidas novamente.</p>
              </div>
              <Button size="sm" variant="outline" onClick={copySeedCredentials}>
                <Copy className="h-4 w-4 mr-2" />Copiar acessos
              </Button>
            </div>
            <div className="space-y-3">
              {seedResult.map((credential) => (
                <div key={credential.adminEmail} className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{credential.companyName}</p>
                  <p>E-mail: {credential.adminEmail}</p>
                  <p>Senha temporária: <span className="font-mono select-all">{credential.temporaryPassword}</span></p>
                  {credential.mustSetPassword && <p>Será necessário definir uma nova senha no primeiro acesso.</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Histórico de recuperação administrativa</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Horário e resultado das tentativas. Tokens e senhas não são armazenados.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRecoveryHistory}
              disabled={recoveryHistoryLoading}
            >
              {recoveryHistoryLoading
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <RefreshCw className="h-4 w-4 mr-2" />}
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recoveryHistoryLoading ? (
            <div className="h-12 rounded-md bg-muted animate-pulse" />
          ) : recoveryHistoryError ? (
            <p className="py-3 text-sm text-destructive">{recoveryHistoryError}</p>
          ) : recoveryAttempts.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Nenhuma tentativa registrada.</p>
          ) : (
            <div className="space-y-3">
              <div className="max-h-72 divide-y overflow-y-auto">
                {recoveryAttempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    data-testid={`recovery-attempt-${attempt.id}`}
                  >
                    <time className="text-sm text-muted-foreground" dateTime={attempt.attemptedAt}>
                      {new Date(attempt.attemptedAt).toLocaleString("pt-BR")}
                    </time>
                    <Badge
                      variant={attempt.result === "success" ? "default" : "outline"}
                      className={attempt.result === "success" ? "bg-emerald-600 hover:bg-emerald-600" : ""}
                    >
                      {RECOVERY_RESULT_LABELS[attempt.result] ?? "Resultado desconhecido"}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground" data-testid="recovery-history-page-status">
                  Exibindo {(recoveryHistoryPage - 1) * RECOVERY_HISTORY_PAGE_SIZE + 1} a{" "}
                  {Math.min(recoveryHistoryPage * RECOVERY_HISTORY_PAGE_SIZE, recoveryHistoryTotal)} de{" "}
                  {recoveryHistoryTotal} tentativas · Página {recoveryHistoryPage} de {recoveryHistoryTotalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="button-recovery-history-previous"
                    disabled={recoveryHistoryLoading || recoveryHistoryPage <= 1}
                    onClick={() => setRecoveryHistoryPage((page) => page - 1)}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="button-recovery-history-next"
                    disabled={recoveryHistoryLoading || recoveryHistoryPage >= recoveryHistoryTotalPages}
                    onClick={() => setRecoveryHistoryPage((page) => page + 1)}
                  >
                    Próxima
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por razão social, CNPJ ou e-mail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Triagem de interessados</CardTitle>
          </div>
          <CardDescription>
            Analise os leads e aprove os clientes pagos para criar a empresa, o acesso e a assinatura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inquiriesLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : inquiries.length === 0 ? (
            <p className="py-5 text-sm text-muted-foreground text-center">Nenhuma solicitação aguardando triagem.</p>
          ) : (
            <div className="space-y-3">
              {inquiries.map(inquiry => (
                <div
                  key={inquiry.id}
                  data-testid={`inquiry-row-${inquiry.id}`}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{inquiry.companyName}</p>
                      <Badge variant="outline" className="text-xs">{inquiry.status}</Badge>
                      <Badge variant="secondary" className="text-xs">{inquiry.leadScore} pts</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {inquiry.contactName} · {inquiry.email} · {inquiry.cnpj}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inquiry.segment} · Plano recomendado: {PLAN_LABELS[inquiry.recommendedPlan] ?? inquiry.recommendedPlan}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={getInquiryStatus(inquiry.status)}
                      onValueChange={status => handleInquiryStatus(inquiry.id, status)}
                      disabled={inquiryActionLoading === inquiry.id}
                    >
                      <SelectTrigger className="w-[150px]" data-testid={`select-inquiry-status-${inquiry.id}`}>
                        <SelectValue placeholder="Triagem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novo">Novo</SelectItem>
                        <SelectItem value="Em Análise">Em análise</SelectItem>
                        <SelectItem value="Qualificado">Qualificado</SelectItem>
                        <SelectItem value="Descartado">Descartado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => startCompanyRegistration(inquiry)}
                      data-testid={`button-approve-inquiry-${inquiry.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />Aprovar e cadastrar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-44 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhuma empresa encontrada</p>
          {companies.length === 0 && (
            <Button className="mt-4" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Cadastrar Empresas Iniciais
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(c => (
            <Card key={c.id} className="bg-card border-border hover:border-muted-foreground/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg">{c.nome_fantasia}</CardTitle>
                      <Badge className={`text-xs border ${STATUS_COLORS[c.status] ?? STATUS_COLORS.inativa}`}>
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </Badge>
                      {c.plan_slug && (
                        <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                          {PLAN_LABELS[c.plan_slug] ?? c.plan_slug}
                        </Badge>
                      )}
                      <Badge className={`text-xs border ${SUBSCRIPTION_STATUS_COLORS[c.subscription_status ?? ""] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                        Assinatura: {c.subscription_status ?? "sem assinatura"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-1">{c.razao_social}</CardDescription>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setReissueDialog({ company: c, selectedAdminId: "" })}
                      disabled={actionLoading === c.id || c.admins.length === 0}
                      data-testid={`button-reissue-password-${c.id}`}
                    >
                      {actionLoading === c.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <KeyRound className="h-3 w-3 mr-1" />}
                      Reemitir senha
                    </Button>
                    {c.status === "ativa" ? (
                      <Button
                        size="sm" variant="outline"
                        className="text-red-500 border-red-500/30 hover:bg-red-500/10 h-8 text-xs"
                        onClick={() => handleAccess(c.id, "suspender")}
                        disabled={actionLoading === c.id}
                      >
                        {actionLoading === c.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                        Suspender
                      </Button>
                    ) : (
                      <Button
                        size="sm" variant="outline"
                        className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 h-8 text-xs"
                        onClick={() => handleAccess(c.id, "liberar")}
                        disabled={actionLoading === c.id}
                      >
                        {actionLoading === c.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                        Liberar
                      </Button>
                    )}
                    <Button
                      size="sm" variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setShowPaymentModal(c)}
                    >
                      <CreditCard className="h-3 w-3 mr-1" />
                      Pagamento
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground/70">CNPJ</p>
                      <p>{c.cnpj}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground/70">Localização</p>
                      <p>{c.cidade} / {c.estado}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground/70">E-mail</p>
                      <p className="truncate max-w-[140px]" title={c.email}>{c.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground/70">Telefone</p>
                      <p>{c.telefone ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground/70">Segmento</p>
                      <p>{c.segmento}</p>
                    </div>
                  </div>
                  {c.admin_email && (
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground/70">Acesso administrador</p>
                        <p className="break-all">{c.admin_email}</p>
                      </div>
                    </div>
                  )}
                  {c.socio_administrador && (
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground/70">Sócio Admin.</p>
                        <p>{c.socio_administrador}</p>
                      </div>
                    </div>
                  )}
                  {c.renewal_date && (
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <CreditCard className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground/70">Renovação</p>
                        <p>{c.renewal_date}</p>
                      </div>
                    </div>
                  )}
                  {c.next_billing_amount != null && (
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <CreditCard className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground/70">Próxima mensalidade</p>
                        <p>{formatBRL(c.next_billing_amount)}</p>
                      </div>
                    </div>
                  )}
                  {c.last_payment_amount != null && (
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground/70">Último valor pago</p>
                        <p>{formatBRL(c.last_payment_amount)}</p>
                      </div>
                    </div>
                  )}
                  {c.last_payment_at && (
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground/70">Último Pagto.</p>
                        <p>{formatDate(c.last_payment_at)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateModal} onOpenChange={open => !open && setShowCreateModal(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedInquiry ? "Aprovar e cadastrar empresa" : "Cadastrar empresa paga"}</DialogTitle>
            <DialogDescription>
              O cadastro cria uma conta ativa, um administrador e uma assinatura. A senha temporária será exibida ao concluir.
            </DialogDescription>
          </DialogHeader>
          <Form {...paidCompanyForm}>
            <form onSubmit={paidCompanyForm.handleSubmit(handleCreatePaidCompany)} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={paidCompanyForm.control}
                  name="razaoSocial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razão social</FormLabel>
                      <FormControl><Input {...field} data-testid="input-company-legal-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paidCompanyForm.control}
                  name="nomeFantasia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome fantasia</FormLabel>
                      <FormControl><Input {...field} data-testid="input-company-trade-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paidCompanyForm.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl><Input {...field} inputMode="numeric" placeholder="00.000.000/0000-00" data-testid="input-company-cnpj" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paidCompanyForm.control}
                  name="segmento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Segmento</FormLabel>
                      <FormControl><Input {...field} data-testid="input-company-segment" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paidCompanyForm.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl><Input {...field} data-testid="input-company-city" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paidCompanyForm.control}
                  name="estado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado (UF)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          maxLength={2}
                          onChange={event => field.onChange(event.target.value.toUpperCase())}
                          data-testid="input-company-state"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paidCompanyForm.control}
                  name="adminName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do administrador</FormLabel>
                      <FormControl><Input {...field} data-testid="input-admin-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paidCompanyForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail de acesso</FormLabel>
                      <FormControl><Input {...field} type="email" data-testid="input-admin-email" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paidCompanyForm.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone / WhatsApp (opcional)</FormLabel>
                      <FormControl><Input {...field} data-testid="input-company-phone" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paidCompanyForm.control}
                  name="planSlug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plano contratado</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={value => {
                          field.onChange(value);
                          paidCompanyForm.setValue("paymentAmount", String(PLAN_PRICES[value]));
                          paidCompanyForm.setValue(
                            "nextBillingAmount",
                            String(value === "radar-lancamento" ? 890 : PLAN_PRICES[value]),
                          );
                        }}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-paid-plan"><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PLAN_LABELS).map(([slug, label]) => (
                            <SelectItem key={slug} value={slug}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paidCompanyForm.control}
                  name="paymentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor recebido (R$)</FormLabel>
                      <FormControl><Input {...field} type="number" min="0.01" step="0.01" data-testid="input-payment-amount" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paidCompanyForm.control}
                  name="nextBillingAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor mensal da renovação (R$)</FormLabel>
                      <FormControl><Input {...field} type="number" min="0.01" step="0.01" data-testid="input-next-billing-amount" /></FormControl>
                      <p className="text-xs text-muted-foreground">
                        Registra o valor acordado, mas não cria cobrança recorrente automaticamente.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paidCompanyForm.control}
                  name="renewalDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Próxima renovação</FormLabel>
                      <FormControl><Input {...field} type="date" data-testid="input-renewal-date" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} disabled={creatingCompany}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={creatingCompany} data-testid="button-submit-paid-company">
                  {creatingCompany ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Criar conta e assinatura
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(createdCredentials)} onOpenChange={open => !open && setCreatedCredentials(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Primeiro acesso criado</DialogTitle>
            <DialogDescription>
              Copie e entregue estes dados ao administrador. A senha só aparece agora e será trocada no primeiro login.
            </DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">E-mail</p>
                  <p className="font-medium break-all" data-testid="text-created-admin-email">{createdCredentials.adminEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Senha temporária</p>
                  <p className="font-mono text-sm break-all select-all" data-testid="text-temporary-password">
                    {createdCredentials.temporaryPassword}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  A empresa #{createdCredentials.companyId} está ativa. A senha não poderá ser recuperada depois que esta janela for fechada.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={copyTemporaryCredentials} data-testid="button-copy-credentials">
                  <Copy className="h-4 w-4 mr-2" />Copiar acesso
                </Button>
                <Button onClick={() => setCreatedCredentials(null)} data-testid="button-close-credentials">Concluir</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reissueDialog)} onOpenChange={open => !open && setReissueDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reissueDialog?.credentials ? "Nova senha temporária" : "Reemitir senha temporária"}
            </DialogTitle>
            <DialogDescription>
              {reissueDialog?.credentials
                ? "A senha anterior foi invalidada. Copie e entregue esta senha agora; ela não será exibida novamente."
                : `Selecione o administrador de ${reissueDialog?.company.nome_fantasia} que receberá a nova senha. A senha atual dessa pessoa deixará de funcionar imediatamente, e a nova exigirá troca no primeiro acesso.`}
            </DialogDescription>
          </DialogHeader>
          {reissueDialog?.credentials ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">E-mail</p>
                  <p className="font-medium break-all" data-testid="text-reissued-admin-email">
                    {reissueDialog.credentials.adminEmail}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Senha temporária</p>
                  <p className="font-mono text-sm break-all select-all" data-testid="text-reissued-temporary-password">
                    {reissueDialog.credentials.temporaryPassword}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Empresa #{reissueDialog.credentials.companyId}. A senha será trocada no primeiro login.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={copyReissuedCredentials} data-testid="button-copy-reissued-credentials">
                  <Copy className="h-4 w-4 mr-2" />Copiar acesso
                </Button>
                <Button onClick={() => setReissueDialog(null)} data-testid="button-close-reissued-credentials">
                  Concluir
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reissue-admin">Administrador que receberá a senha</Label>
                <Select
                  value={reissueDialog?.selectedAdminId ?? ""}
                  onValueChange={selectedAdminId => setReissueDialog(current =>
                    current ? { ...current, selectedAdminId } : current
                  )}
                  disabled={actionLoading === reissueDialog?.company.id}
                >
                  <SelectTrigger id="reissue-admin" data-testid="select-reissue-admin">
                    <SelectValue placeholder="Selecione um administrador" />
                  </SelectTrigger>
                  <SelectContent>
                    {reissueDialog?.company.admins.map(admin => (
                      <SelectItem key={admin.id} value={String(admin.id)}>
                        {admin.nome} — {admin.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReissueDialog(null)} disabled={actionLoading === reissueDialog?.company.id}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleReissueTemporaryPassword}
                  disabled={actionLoading === reissueDialog?.company.id || !reissueDialog?.selectedAdminId}
                  data-testid="button-confirm-reissue-password"
                >
                  {actionLoading === reissueDialog?.company.id
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <KeyRound className="h-4 w-4 mr-2" />}
                  Reemitir senha
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-bold text-lg mb-1">Registrar Pagamento</h2>
            <p className="text-sm text-muted-foreground mb-5">{showPaymentModal.nome_fantasia}</p>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Valor Pago (R$)</Label>
                <Input
                  type="number" placeholder="Ex: 2490"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Nova data de renovação (opcional)</Label>
                <Input
                  type="date"
                  value={paymentRenewal}
                  onChange={e => setPaymentRenewal(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowPaymentModal(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleRegisterPayment} disabled={!paymentAmount}>
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
