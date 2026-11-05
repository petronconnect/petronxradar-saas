import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Landmark,
  QrCode,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Unlock,
  Lock,
  RotateCcw,
  TrendingUp,
  FileText,
  CreditCard,
  Building2,
  Wallet,
  Star,
  Zap,
  Users,
  ArrowRight,
  ChevronRight,
  Info,
  AlertTriangle,
  Coins,
  BarChart3,
  Package,
  Calendar,
  Copy,
  CheckCheck,
  Eye,
  EyeOff,
  Flame,
  Key,
  Terminal,
  Globe,
  Settings,
  ExternalLink,
  Shield,
  RefreshCw,
  Webhook,
  CheckSquare,
  Radio,
} from "lucide-react";

type Tab = "conta" | "assinaturas" | "faturas" | "credito" | "mercadopago";

function CopyBtn({ text }: { text: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  async function go() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary" onClick={go}>
      {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

function ComplianceBanner({ msg }: { msg: string }) {
  return (
    <div className="flex gap-3 items-start p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-300 leading-relaxed">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
      <p>{msg}</p>
    </div>
  );
}

const MOCK_SUBSCRIPTIONS = [
  {
    id: 1,
    company: "Tavares Construções e Engenharia LTDA",
    code: "BETA-001",
    plan: "Radar Pro",
    planSlug: "radar-pro",
    price: 2490,
    status: "trial",
    trialEnd: "2026-06-19",
    accessEnabled: true,
    invoices: 0,
    nextBilling: "2026-06-19",
    contact: "Eduardo Tavares",
    email: "contato@tavaresengenharia.com.br",
  },
  {
    id: 2,
    company: "Pavanelli Tech LTDA",
    code: "BETA-002",
    plan: "Radar Enterprise",
    planSlug: "radar-enterprise",
    price: 5990,
    status: "trial",
    trialEnd: "2026-06-19",
    accessEnabled: true,
    invoices: 0,
    nextBilling: "2026-06-19",
    contact: "Rodrigo Pavanelli",
    email: "rodrigo@pavanellitech.com.br",
  },
];

const MOCK_FATURAS = [
  { id: "FAT-2026-001", empresa: "Tavares Construções e Engenharia LTDA", plano: "Radar Pro", valor: 2490, vencimento: "2026-06-19", status: "pendente", pix: false },
  { id: "FAT-2026-002", empresa: "Pavanelli Tech LTDA", plano: "Radar Enterprise", valor: 5990, vencimento: "2026-06-19", status: "pendente", pix: false },
];

const STATUS_CONFIG = {
  ativo: { label: "Ativo", icon: CheckCircle2, cls: "text-green-400 bg-green-500/10 border-green-500/20" },
  trial: { label: "Trial / Beta", icon: Clock, cls: "text-primary bg-primary/10 border-primary/20" },
  vencido: { label: "Vencido", icon: XCircle, cls: "text-red-400 bg-red-500/10 border-red-500/20" },
  pendente: { label: "Pendente", icon: Clock, cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  pago: { label: "Pago", icon: CheckCircle2, cls: "text-green-400 bg-green-500/10 border-green-500/20" },
  cancelado: { label: "Cancelado", icon: XCircle, cls: "text-muted-foreground bg-muted/20 border-border" },
} as const;

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["pendente"];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

export default function PetronPayPage() {
  const [tab, setTab] = useState<Tab>("conta");
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [contaSalva, setContaSalva] = useState(false);
  const [subscriptions, setSubscriptions] = useState(MOCK_SUBSCRIPTIONS);
  const [faturas, setFaturas] = useState(MOCK_FATURAS);

  const [conta, setConta] = useState({
    razaoSocial: "Petron Radar Tecnologia LTDA",
    cnpj: "00.000.000/0001-00",
    banco: "Itaú Unibanco",
    agencia: "0001",
    contaCorrente: "12345-6",
    pixTipo: "cnpj",
    pixChave: "00.000.000/0001-00",
    verificado: false,
  });

  function salvarConta() {
    setContaSalva(true);
    toast({ title: "Dados salvos!", description: "Conta recebedora atualizada. Verificação pendente." });
  }

  function toggleAccess(id: number) {
    setSubscriptions((prev) =>
      prev.map((s) => s.id === id ? { ...s, accessEnabled: !s.accessEnabled } : s)
    );
    const sub = subscriptions.find((s) => s.id === id);
    if (sub) {
      toast({
        title: sub.accessEnabled ? "Acesso bloqueado" : "Acesso liberado",
        description: sub.company,
      });
    }
  }

  function gerarFatura(id: number) {
    setFaturas((prev) =>
      prev.map((f) => f.id === id ? { ...f, pix: true } : f)
    );
    toast({ title: "PIX gerado!", description: "Código Pix criado para cobrança. Aguardando pagamento." });
  }

  function marcarPago(id: string) {
    setFaturas((prev) =>
      prev.map((f) => f.id === id ? { ...f, status: "pago" } : f)
    );
    const fat = faturas.find((f) => f.id === id);
    if (fat) {
      setSubscriptions((prev) =>
        prev.map((s) => s.company === fat.empresa ? { ...s, status: "ativo" as any, invoices: s.invoices + 1 } : s)
      );
      toast({ title: "Pagamento confirmado!", description: `${fat.empresa} — acesso ativado automaticamente.` });
    }
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "conta", label: "Conta Recebedora", icon: Landmark },
    { id: "assinaturas", label: "Assinaturas", icon: Users },
    { id: "faturas", label: "Cobranças & Faturas", icon: FileText },
    { id: "mercadopago", label: "Mercado Pago Setup", icon: Settings },
    { id: "credito", label: "Crédito O&G", icon: Coins },
  ];

  const totalMrr = subscriptions.filter((s) => s.status === "ativo").reduce((acc, s) => acc + s.price, 0);
  const totalTrial = subscriptions.filter((s) => s.status === "trial").length;
  const totalAtivo = subscriptions.filter((s) => s.status === "ativo").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Petron Pay Gateway</h1>
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs font-bold">
              Conceitual · Em Desenvolvimento
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Gestão de pagamentos, assinaturas, cobranças Pix e liberação de acesso para empresas do setor O&G.
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="text-center px-4 py-2 rounded-xl border border-border bg-card">
            <p className="text-xs text-muted-foreground">MRR</p>
            <p className="text-lg font-extrabold text-primary">
              {totalMrr > 0 ? `R$ ${totalMrr.toLocaleString("pt-BR")}` : "—"}
            </p>
          </div>
          <div className="text-center px-4 py-2 rounded-xl border border-border bg-card">
            <p className="text-xs text-muted-foreground">Trial</p>
            <p className="text-lg font-extrabold text-amber-400">{totalTrial}</p>
          </div>
          <div className="text-center px-4 py-2 rounded-xl border border-border bg-card">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-lg font-extrabold text-green-400">{totalAtivo}</p>
          </div>
        </div>
      </div>

      {/* Compliance banner principal */}
      <ComplianceBanner msg="AVISO REGULATÓRIO: O Petron Pay Gateway é uma camada de gestão operacional interna. Cobranças reais via Pix, cartão de crédito, split de pagamentos e concessão de crédito a terceiros exigem vínculo com instituição financeira autorizada pelo Banco Central (IP, ITP ou Fintech regulada), KYC/KYB dos clientes, análise de risco, contratos de prestação de serviços financeiros e conformidade com a Resolução BCB nº 1 e regulamentações CVM. Este módulo não realiza transações financeiras reais até integração com parceiro financeiro autorizado." />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ─── CONTA RECEBEDORA ─── */}
        {tab === "conta" && (
          <motion.div key="conta" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="space-y-5">
            <div className="grid lg:grid-cols-2 gap-5">
              {/* Dados PJ */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Empresa Recebedora (PJ)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Razão Social</Label>
                    <Input className="bg-muted/20 border-border" value={conta.razaoSocial} onChange={(e) => setConta({ ...conta, razaoSocial: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">CNPJ</Label>
                    <Input className="bg-muted/20 border-border font-mono" value={conta.cnpj} onChange={(e) => setConta({ ...conta, cnpj: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5 col-span-3 sm:col-span-1">
                      <Label className="text-xs text-muted-foreground">Banco</Label>
                      <Input className="bg-muted/20 border-border" value={conta.banco} onChange={(e) => setConta({ ...conta, banco: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Agência</Label>
                      <Input className="bg-muted/20 border-border font-mono" value={conta.agencia} onChange={(e) => setConta({ ...conta, agencia: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Conta</Label>
                      <Input className="bg-muted/20 border-border font-mono" value={conta.contaCorrente} onChange={(e) => setConta({ ...conta, contaCorrente: e.target.value })} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Chave Pix */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <QrCode className="w-4 h-4" /> Chave Pix
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tipo de chave</Label>
                    <Select value={conta.pixTipo} onValueChange={(v) => setConta({ ...conta, pixTipo: v })}>
                      <SelectTrigger className="bg-muted/20 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="aleatoria">Chave aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Chave</Label>
                    <div className="flex gap-2">
                      <Input
                        className="bg-muted/20 border-border font-mono flex-1"
                        type={showKey ? "text" : "password"}
                        value={conta.pixChave}
                        onChange={(e) => setConta({ ...conta, pixChave: e.target.value })}
                      />
                      <Button size="sm" variant="ghost" className="h-10 w-10 p-0" onClick={() => setShowKey(!showKey)}>
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <CopyBtn text={conta.pixChave} />
                    </div>
                  </div>
                  {/* Verification status */}
                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${conta.verificado ? "border-green-500/20 bg-green-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                    {conta.verificado
                      ? <ShieldCheck className="w-5 h-5 text-green-400 flex-shrink-0" />
                      : <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />}
                    <div className="flex-1">
                      <p className={`text-xs font-semibold ${conta.verificado ? "text-green-400" : "text-amber-400"}`}>
                        {conta.verificado ? "Conta verificada" : "Verificação pendente"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conta.verificado ? "Chave Pix e dados bancários confirmados." : "Documentos PJ e dados bancários aguardando validação com parceiro financeiro."}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" className="w-full" variant="outline" onClick={() => setConta({ ...conta, verificado: !conta.verificado })}>
                    {conta.verificado ? "Desmarcar verificação" : "Marcar como verificado (simulação)"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={salvarConta}>
                {contaSalva ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Salvo</> : <><ShieldCheck className="w-4 h-4 mr-2" /> Salvar Conta Recebedora</>}
              </Button>
            </div>

            {/* Roadmap de integrações */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Petron Pay — Roadmap de Integrações
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { titulo: "Pix QR Code", desc: "Cobrança instantânea via Pix dinâmico", status: "Em desenvolvimento", icon: QrCode },
                  { titulo: "Cartão de Crédito", desc: "Assinaturas via cartão com tokenização segura", status: "Roadmap 2026", icon: CreditCard },
                  { titulo: "Boleto B2B", desc: "Boleto bancário para PJ com prazo estendido", status: "Roadmap 2026", icon: FileText },
                  { titulo: "Split de Pagamentos", desc: "Divisão automática entre parceiros e revendas", status: "Futuro", icon: Coins },
                ].map((item) => (
                  <div key={item.titulo} className="p-4 rounded-xl border border-border bg-muted/10">
                    <item.icon className="w-5 h-5 text-primary mb-2" />
                    <p className="text-sm font-semibold mb-1">{item.titulo}</p>
                    <p className="text-xs text-muted-foreground mb-2">{item.desc}</p>
                    <Badge variant="outline" className="text-xs border-border text-muted-foreground">{item.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ─── ASSINATURAS ─── */}
        {tab === "assinaturas" && (
          <motion.div key="assinaturas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{subscriptions.length} assinaturas · {totalTrial} em trial beta</p>
              <Button size="sm" variant="outline" className="border-border text-xs" disabled title="Em breve — disponível quando a integração Pix/PSP estiver ativa">
                <Package className="w-3.5 h-3.5 mr-1.5" /> Nova assinatura (em breve)
              </Button>
            </div>

            <div className="space-y-3">
              {subscriptions.map((sub) => (
                <Card key={sub.id} className="border-border bg-card">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-bold">{sub.code}</Badge>
                          <StatusBadge status={sub.status as any} />
                          {!sub.accessEnabled && (
                            <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">
                              <Lock className="w-3 h-3 mr-1" /> Acesso bloqueado
                            </Badge>
                          )}
                        </div>
                        <p className="text-base font-bold truncate">{sub.company}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Package className="w-3 h-3" />{sub.plan}</span>
                          <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" />R$ {sub.price.toLocaleString("pt-BR")}/mês</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Próximo: {sub.nextBilling}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{sub.contact}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className={`text-xs h-8 ${sub.accessEnabled ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-green-500/30 text-green-400 hover:bg-green-500/10"}`}
                          onClick={() => toggleAccess(sub.id)}
                        >
                          {sub.accessEnabled
                            ? <><Lock className="w-3 h-3 mr-1.5" /> Bloquear acesso</>
                            : <><Unlock className="w-3 h-3 mr-1.5" /> Liberar acesso</>}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs h-8 text-primary border border-primary/20 hover:bg-primary/10" disabled title="Em breve — disponível quando a integração Pix/PSP estiver ativa">
                          <FileText className="w-3 h-3 mr-1.5" /> Gerar fatura (em breve)
                        </Button>
                      </div>
                    </div>

                    {/* Trial bar */}
                    {sub.status === "trial" && (
                      <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-primary font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Período Trial Beta</span>
                          <span className="text-muted-foreground">Vence: {sub.trialEnd}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: "30%" }} transition={{ duration: 0.6 }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Após vencimento: gere a fatura e confirme pagamento para converter em assinatura ativa.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border bg-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Info className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="text-sm font-semibold">Fluxo de Liberação de Acesso</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  {["Trial/Beta ativo", "→", "Vencimento", "→", "Gerar cobrança Pix", "→", "Pagamento confirmado", "→", "Acesso liberado automaticamente"].map((step, i) => (
                    <span key={i} className={step === "→" ? "text-border" : step.includes("Acesso liberado") ? "text-green-400 font-semibold" : "px-2 py-1 rounded bg-muted/30 border border-border"}>{step}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ─── COBRANÇAS & FATURAS ─── */}
        {tab === "faturas" && (
          <motion.div key="faturas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="space-y-4">
            <ComplianceBanner msg="Cobranças Pix reais dependem de integração com PSP/banco autorizado. Esta tela simula o fluxo operacional para quando a integração estiver ativa. Pagamentos marcados como 'confirmados' aqui são apenas controle interno — não movimentam valores reais sem parceiro financeiro homologado." />

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{faturas.length} cobranças ativas</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-border text-xs" disabled title="Em breve — disponível quando a integração Pix/PSP estiver ativa">
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> Exportar faturas (em breve)
                </Button>
                <Button size="sm" className="bg-primary text-primary-foreground text-xs" disabled title="Em breve — disponível quando a integração Pix/PSP estiver ativa">
                  <QrCode className="w-3.5 h-3.5 mr-1.5" /> Gerar cobrança Pix (em breve)
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {faturas.map((fat) => (
                <Card key={fat.id} className="border-border bg-card">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{fat.id}</span>
                          <StatusBadge status={fat.status as any} />
                        </div>
                        <p className="text-sm font-bold truncate">{fat.empresa}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Package className="w-3 h-3" />{fat.plano}</span>
                          <span className="flex items-center gap-1 font-semibold text-foreground">
                            R$ {fat.valor.toLocaleString("pt-BR")}
                          </span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Venc. {fat.vencimento}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        {fat.status === "pendente" && !fat.pix && (
                          <Button size="sm" className="bg-primary text-primary-foreground text-xs h-8" onClick={() => gerarFatura(fat.id as any)}>
                            <QrCode className="w-3 h-3 mr-1.5" /> Gerar Pix
                          </Button>
                        )}
                        {fat.pix && fat.status === "pendente" && (
                          <div className="space-y-2">
                            <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center border border-border mx-auto">
                              <QrCode className="w-10 h-10 text-black" />
                            </div>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 w-full" onClick={() => marcarPago(fat.id)}>
                              <CheckCircle2 className="w-3 h-3 mr-1.5" /> Confirmar pagamento
                            </Button>
                          </div>
                        )}
                        {fat.status === "pago" && (
                          <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> Pago — acesso liberado
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Histórico stub */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> Histórico de Pagamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum pagamento confirmado ainda.</p>
                  <p className="text-xs mt-1">O histórico aparecerá aqui conforme os clientes pagarem suas faturas.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ─── CRÉDITO O&G ─── */}
        {tab === "credito" && (
          <motion.div key="credito" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="space-y-5">
            {/* Módulo futuro header */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Coins className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-lg font-bold">Crédito Empresarial O&G</h2>
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs font-bold">
                      Módulo Futuro
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Linha de crédito empresarial para empresas O&G que identificam e ganham oportunidades usando o Petron Radar.
                    A inteligência da plataforma valida o pipeline de negócios e serve como base para análise de crédito — conectando oportunidades reais com capital de giro e antecipação.
                  </p>
                </div>
              </div>
            </div>

            {/* Compliance obrigatório */}
            <ComplianceBanner msg="IMPORTANTE — MÓDULO FUTURO SUJEITO A REGULAMENTAÇÃO: A concessão de crédito a pessoas jurídicas no Brasil é atividade privativa de instituições financeiras autorizadas pelo Banco Central (Banco, Cooperativa, Fintech SCD/SEP). A operação deste módulo dependerá de parceria com instituição autorizada, KYB completo dos clientes, análise de risco de crédito, precificação regulatória, contrato de operações de crédito e conformidade com resoluções CMN/BCB. Nenhum crédito é concedido por este sistema sem autorização de parceiro financeiro homologado." />

            {/* Visão do produto */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  titulo: "Limite Disponível",
                  desc: "Baseado no pipeline de oportunidades identificadas pelo Radar e histórico de contratos ganhos.",
                  icon: Wallet,
                  valor: "Até R$ 500K",
                  cor: "text-green-400",
                  bg: "bg-green-500/10",
                  status: "Conceitual",
                },
                {
                  titulo: "Solicitação de Crédito",
                  desc: "Empresa solicita crédito vinculado a oportunidade específica identificada no Radar.",
                  icon: FileText,
                  valor: "Por oportunidade",
                  cor: "text-blue-400",
                  bg: "bg-blue-500/10",
                  status: "Conceitual",
                },
                {
                  titulo: "Análise Documental",
                  desc: "Upload de documentação PJ, balanço, DRE e contratos ativos via plataforma.",
                  icon: ShieldCheck,
                  valor: "KYB completo",
                  cor: "text-purple-400",
                  bg: "bg-purple-500/10",
                  status: "Conceitual",
                },
                {
                  titulo: "Status da Solicitação",
                  desc: "Acompanhamento em tempo real: análise → aprovação → liberação → uso.",
                  icon: BarChart3,
                  valor: "Tempo real",
                  cor: "text-primary",
                  bg: "bg-primary/10",
                  status: "Conceitual",
                },
                {
                  titulo: "Uso Previsto",
                  desc: "Crédito vinculado ao projeto: capital de giro, mobilização de equipe, equipamentos.",
                  icon: Building2,
                  valor: "Capital de giro",
                  cor: "text-amber-400",
                  bg: "bg-amber-500/10",
                  status: "Conceitual",
                },
                {
                  titulo: "Antecipação de Recebíveis",
                  desc: "Antecipe contratos e notas fiscais do setor O&G com base em garantias documentais.",
                  icon: TrendingUp,
                  valor: "Recebíveis O&G",
                  cor: "text-orange-400",
                  bg: "bg-orange-500/10",
                  status: "Futuro",
                },
              ].map((item) => (
                <div key={item.titulo} className="rounded-xl border border-border bg-card p-4">
                  <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center mb-3`}>
                    <item.icon className={`w-4.5 h-4.5 ${item.cor}`} style={{ width: 18, height: 18 }} />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold">{item.titulo}</p>
                    <Badge variant="outline" className="text-xs border-border text-muted-foreground">{item.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{item.desc}</p>
                  <p className={`text-xs font-bold ${item.cor}`}>{item.valor}</p>
                </div>
              ))}
            </div>

            {/* Cases de uso */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Star className="w-4 h-4" /> Exemplo de Uso — Beta Clients
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    empresa: "Tavares Construções e Engenharia LTDA",
                    oportunidade: "Contrato de obra onshore Petrobras — R$ 2,1M",
                    credito: "Solicitação: R$ 300K para mobilização de equipe",
                    status: "Em análise conceitual",
                  },
                  {
                    empresa: "Pavanelli Tech LTDA",
                    oportunidade: "Projeto de automação SCADA em refinaria — R$ 850K",
                    credito: "Solicitação: R$ 150K antecipação de recebíveis",
                    status: "Em análise conceitual",
                  },
                ].map((c) => (
                  <div key={c.empresa} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/10">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-1">{c.empresa}</p>
                      <p className="text-xs text-muted-foreground mb-0.5">📋 {c.oportunidade}</p>
                      <p className="text-xs text-primary">💰 {c.credito}</p>
                    </div>
                    <Badge variant="outline" className="text-xs border-border text-muted-foreground flex-shrink-0">{c.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Parceiros para futura integração */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Flame className="w-4 h-4 text-primary" /> Parceiros Financeiros para Futura Integração
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                  {[
                    { tipo: "SCD (Sociedade de Crédito Direto)", ex: "Bari, Geru, Creditas B2B" },
                    { tipo: "SEP (Sociedade de Empréstimo entre Pessoas)", ex: "Nexoos, Kavod" },
                    { tipo: "Fintech B2B / Antecipação de Recebíveis", ex: "Capital Empreendedor, Monkey" },
                    { tipo: "Banco Comercial com API aberta", ex: "BV, BTG, Sicoob Open" },
                  ].map((p) => (
                    <div key={p.tipo} className="p-3 rounded-lg border border-border bg-muted/10">
                      <p className="font-semibold text-foreground mb-0.5">{p.tipo}</p>
                      <p>{p.ex}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  A implementação exige due diligence, contrato de parceria, homologação técnica e conformidade regulatória com o Banco Central do Brasil.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ─── MERCADO PAGO SETUP ─── */}
        {tab === "mercadopago" && (
          <motion.div key="mercadopago" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="space-y-5">

            {/* Fluxo visual de pagamento */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" /> Fluxo de Pagamento — Petron Radar + Mercado Pago
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { label: "Cliente escolhe plano", sub: "Landing / Checkout", icon: Users, cor: "text-blue-400", bg: "bg-blue-500/10" },
                    null,
                    { label: "Gera cobrança Pix", sub: "API Mercado Pago", icon: QrCode, cor: "text-primary", bg: "bg-primary/10" },
                    null,
                    { label: "Pagamento confirmado", sub: "Webhook MP → servidor", icon: CheckCircle2, cor: "text-green-400", bg: "bg-green-500/10" },
                    null,
                    { label: "Acesso liberado", sub: "Petron Radar automático", icon: Unlock, cor: "text-amber-400", bg: "bg-amber-500/10" },
                  ].map((step, i) =>
                    step === null ? (
                      <ArrowRight key={i} className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mx-1" />
                    ) : (
                      <div key={i} className={`flex-1 min-w-[110px] rounded-xl border border-border ${step.bg} p-3 text-center`}>
                        <div className={`w-8 h-8 rounded-lg ${step.bg} flex items-center justify-center mx-auto mb-2 border border-white/10`}>
                          <step.icon className={`w-4 h-4 ${step.cor}`} />
                        </div>
                        <p className={`text-xs font-bold ${step.cor} mb-0.5`}>{step.label}</p>
                        <p className="text-xs text-muted-foreground">{step.sub}</p>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Ambiente */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Radio className="w-4 h-4" /> Ambiente de Operação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { id: "sandbox", label: "Sandbox", desc: "Testes sem transações reais. Use credenciais de teste do painel MP.", cor: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", recomendado: true },
                    { id: "producao", label: "Produção", desc: "Cobranças reais via Pix e cartão. Só ativar após testes aprovados.", cor: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", recomendado: false },
                  ].map((env) => (
                    <div key={env.id} className={`flex items-start gap-3 p-3 rounded-lg border ${env.border} ${env.bg} cursor-pointer`}>
                      <div className={`w-4 h-4 rounded-full border-2 ${env.border} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        {env.id === "sandbox" && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold ${env.cor}`}>{env.label}</p>
                          {env.recomendado && <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">Ativo agora</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{env.desc}</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    Mude para Produção somente após realizar ao menos 3 transações Pix de teste com sucesso.
                  </p>
                </CardContent>
              </Card>

              {/* Status geral */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Status da Integração
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {[
                    { label: "Access Token configurado", status: "pendente", desc: "Configure via Replit Secrets" },
                    { label: "Client ID configurado", status: "pendente", desc: "Configure via Replit Secrets" },
                    { label: "Webhook registrado no MP", status: "pendente", desc: "URL pública necessária" },
                    { label: "Pix habilitado na conta MP", status: "pendente", desc: "Ativar no painel Mercado Pago" },
                    { label: "Teste sandbox aprovado", status: "pendente", desc: "Realizar após credenciais" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs flex-shrink-0">Pendente</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Credenciais — segurança */}
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Credenciais de Segurança — Configurar no Replit Secrets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3 items-start p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300 leading-relaxed">
                    <strong>NUNCA exponha o Access Token, Client Secret ou Webhook Secret em código-fonte, commit Git ou tela pública.</strong> Essas credenciais dão acesso financeiro à sua conta do Mercado Pago. Configure exclusivamente via Replit Secrets (aba "Secrets" no painel do Replit), onde são injetadas como variáveis de ambiente seguras no servidor.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      envVar: "MERCADO_PAGO_ACCESS_TOKEN",
                      label: "Access Token",
                      desc: "Token principal de autenticação da API. Obtido em: Mercado Pago → Seu negócio → Credenciais",
                      onde: "mpago.com.br/developers → Credenciais de produção",
                      tipo: "Token de acesso",
                    },
                    {
                      envVar: "MP_PUBLIC_KEY",
                      label: "Public Key",
                      desc: "Chave pública para inicializar o SDK no frontend. Não precisa ser secreta.",
                      onde: "mpago.com.br/developers → Credenciais",
                      tipo: "Chave pública",
                    },
                    {
                      envVar: "MP_CLIENT_ID",
                      label: "Client ID",
                      desc: "Identificador do seu aplicativo no Mercado Pago.",
                      onde: "mpago.com.br/developers → Suas integrações",
                      tipo: "Identificador",
                    },
                    {
                      envVar: "MP_WEBHOOK_SECRET",
                      label: "Webhook Secret",
                      desc: "Usado para validar assinatura das notificações de pagamento recebidas pelo servidor.",
                      onde: "mpago.com.br/developers → Webhooks → Segredo",
                      tipo: "Secret de validação",
                    },
                  ].map((cred) => (
                    <div key={cred.envVar} className="p-4 rounded-xl border border-border bg-card">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Key className="w-3.5 h-3.5 text-primary" />
                            <span className="text-sm font-bold">{cred.label}</span>
                            <Badge variant="outline" className="text-xs border-border text-muted-foreground">{cred.tipo}</Badge>
                          </div>
                          <code className="text-xs text-primary font-mono mt-1 block">{cred.envVar}</code>
                        </div>
                        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs flex-shrink-0">Não configurado</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{cred.desc}</p>
                      <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> {cred.onde}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-primary" /> Como configurar no Replit
                  </p>
                  <ol className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2"><span className="text-primary font-bold flex-shrink-0">1.</span> Abra o painel do Replit → clique em "Secrets" (cadeado) na barra lateral esquerda</li>
                    <li className="flex items-start gap-2"><span className="text-primary font-bold flex-shrink-0">2.</span> Clique em "+ New Secret" para cada variável acima</li>
                    <li className="flex items-start gap-2"><span className="text-primary font-bold flex-shrink-0">3.</span> Cole o nome exato da variável (ex: MERCADO_PAGO_ACCESS_TOKEN) e o valor do painel do Mercado Pago</li>
                    <li className="flex items-start gap-2"><span className="text-primary font-bold flex-shrink-0">4.</span> Reinicie o servidor após adicionar cada secret</li>
                    <li className="flex items-start gap-2"><span className="text-primary font-bold flex-shrink-0">5.</span> No servidor Express, acesse via <code className="text-primary">process.env.MERCADO_PAGO_ACCESS_TOKEN</code></li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            {/* Webhook */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Webhook — Confirmação Automática de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O webhook é uma URL no servidor Petron Radar que o Mercado Pago aciona automaticamente quando um pagamento é confirmado. Com ele, o sistema libera o acesso do cliente instantaneamente, sem intervenção manual.
                </p>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">URL do webhook a registrar no Mercado Pago:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-primary font-mono flex-1 bg-muted/30 rounded px-2 py-1.5 border border-border">
                      https://[seu-domínio-replit]/api/webhooks/mercadopago
                    </code>
                    <CopyBtn text="https://[seu-domínio-replit]/api/webhooks/mercadopago" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { titulo: "Evento a ouvir", valor: "payment → approved", desc: "Filtre apenas pagamentos aprovados para evitar falsos positivos" },
                    { titulo: "Validação de segurança", valor: "HMAC-SHA256", desc: "Valide a assinatura usando MP_WEBHOOK_SECRET antes de liberar acesso" },
                    { titulo: "Tempo de resposta", valor: "< 200ms obrigatório", desc: "O MP reenvia o evento se o servidor não responder com 200 em tempo" },
                    { titulo: "Liberação de acesso", valor: "Automática pós-aprovação", desc: "Marque a assinatura como ativa e habilite o login do cliente" },
                  ].map((item) => (
                    <div key={item.titulo} className="p-3 rounded-lg border border-border bg-muted/10">
                      <p className="text-xs text-muted-foreground mb-0.5">{item.titulo}</p>
                      <p className="text-sm font-bold text-primary mb-1">{item.valor}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Planos vinculados */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" /> Planos Petron Radar — Vinculação Mercado Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {[
                    { nome: "Radar Starter", preco: "R$ 890", periodo: "mês", mp: "Pix mensal", mpRecorrente: false, status: "pendente" },
                    { nome: "Radar Pro", preco: "R$ 2.490", periodo: "mês", mp: "Pix mensal + Assinatura recorrente", mpRecorrente: true, status: "pendente" },
                    { nome: "Radar Enterprise", preco: "R$ 5.990", periodo: "mês", mp: "Pix mensal + Cartão recorrente", mpRecorrente: true, status: "pendente" },
                    { nome: "Radar IA Managed", preco: "R$ 12.900", periodo: "mês", mp: "Boleto + Cartão — negociação direta", mpRecorrente: false, status: "pendente" },
                  ].map((plan) => (
                    <div key={plan.nome} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/10 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{plan.nome}</p>
                        <p className="text-xs text-muted-foreground">{plan.mp}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-primary">{plan.preco}<span className="text-xs text-muted-foreground font-normal">/{plan.periodo}</span></p>
                        {plan.mpRecorrente && (
                          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs mt-0.5">Recorrente</Badge>
                        )}
                      </div>
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs flex-shrink-0">Não vinculado</Badge>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    Após configurar o Access Token, cada plano precisará de um ID de preferência ou plano de assinatura criado via API Mercado Pago.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Guia de setup rápido */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Roteiro de Ativação — Passo a Passo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { n: "01", titulo: "Criar conta PJ no Mercado Pago", desc: "mpago.com.br → Criar conta → Pessoa jurídica. Use o CNPJ da empresa recebedora.", link: "https://mpago.com.br", status: "fazer" },
                    { n: "02", titulo: "Habilitar Pix na conta", desc: "Painel Mercado Pago → Seu dinheiro → Pix → Ativar e registrar chave.", link: null, status: "fazer" },
                    { n: "03", titulo: "Obter credenciais de desenvolvimento", desc: "Developers → Suas integrações → Criar aplicação → Copiar Access Token sandbox e produção.", link: null, status: "fazer" },
                    { n: "04", titulo: "Configurar Replit Secrets", desc: "Adicione as 4 variáveis de ambiente no Replit Secrets. Nunca no código.", link: null, status: "fazer" },
                    { n: "05", titulo: "Implementar rota de webhook no servidor", desc: "Criar endpoint POST /api/webhooks/mercadopago no Express que valida assinatura e libera acesso.", link: null, status: "desenvolvimento" },
                    { n: "06", titulo: "Testar fluxo completo em Sandbox", desc: "Gere um Pix de teste, pague com cartão/conta test no ambiente sandbox, confirme webhook recebido.", link: null, status: "fazer" },
                    { n: "07", titulo: "Publicar em produção", desc: "Troque as credenciais sandbox pelas de produção no Replit Secrets. Faça primeiro pagamento real.", link: null, status: "fazer" },
                  ].map((step) => (
                    <div key={step.n} className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${step.status === "desenvolvimento" ? "border-primary/20 bg-primary/5" : "border-border bg-muted/10"}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs ${step.status === "desenvolvimento" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {step.n}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold mb-0.5">{step.titulo}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {step.status === "desenvolvimento" ? (
                          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">A desenvolver</Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">Pendente</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
