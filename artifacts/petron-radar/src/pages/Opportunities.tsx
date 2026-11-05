import { useListOpportunities, useCreateOpportunity, getListOpportunitiesQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Filter, ArrowRight, Target, ShieldCheck, CircleAlert } from "lucide-react";
import { useState } from "react";
import { useEffect, useMemo } from "react";
import { useSearch } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { OpportunityDetailModal, type OpportunityDetail } from "@/components/OpportunityDetailModal";

export default function Opportunities() {
  const queryString = useSearch();
  const initialParams = new URLSearchParams(queryString);
  const [sector, setSector] = useState<string>(initialParams.get("sector") || "all");
  const [status, setStatus] = useState<string>(initialParams.get("status") || "all");
  const [deadlineFilter, setDeadlineFilter] = useState<string>(initialParams.get("deadline") || "all");
  const [search, setSearch] = useState(initialParams.get("q") || "");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<OpportunityDetail | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(queryString);
    const nextQuery = params.get("q") ?? "";
    const nextSector = params.get("sector") ?? "all";
    const nextStatus = params.get("status") ?? "all";
    const nextDeadline = params.get("deadline") ?? "all";
    setSearch(nextQuery);
    setSector(nextSector);
    setStatus(nextStatus);
    setDeadlineFilter(nextDeadline);
  }, [queryString]);

  const { data: opportunities, isLoading } = useListOpportunities({
    sector: sector !== "all" ? sector : undefined,
    status: status !== "all" ? status : undefined,
  });

  const createOp = useCreateOpportunity();

  const filteredOpportunities = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const nextSevenDaysEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7, 23, 59, 59, 999).getTime();
    const dateFromValue = (raw?: string | null) => {
      if (!raw) return null;
      const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const date = match
        ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 23, 59, 59, 999)
        : isoDate
          ? new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]), 23, 59, 59, 999)
          : new Date(raw);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    return (opportunities ?? []).filter((o) => {
      const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
      const query = normalized(search);
      const matchesText = !query || normalized(o.title).includes(query) || normalized(o.company).includes(query)
        || normalized(o.sector).includes(query) || normalized(o.petronectId ?? "").includes(query);
      const matchesSector = sector === "all" || o.sector === sector;
      const matchesStatus = status === "all" || normalized(o.status) === normalized(status);
      const deadlineDate = dateFromValue(o.deadline);
      const matchesDeadline = deadlineFilter === "all"
        || (deadlineFilter === "upcoming" && !!deadlineDate && deadlineDate.getTime() >= todayStart)
        || (deadlineFilter === "next7" && !!deadlineDate && deadlineDate.getTime() >= todayStart && deadlineDate.getTime() <= nextSevenDaysEnd)
        || (deadlineFilter === "expired" && !!deadlineDate && deadlineDate.getTime() < todayStart)
        || (deadlineFilter === "missing" && !deadlineDate);
      return matchesText && matchesSector && matchesStatus && matchesDeadline;
    });
  }, [opportunities, search, sector, status, deadlineFilter]);

  const [formData, setFormData] = useState({
    title: "",
    company: "",
    sector: "Upstream",
    value: "",
    region: "",
    status: "Aberta"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createOp.mutate({
      data: {
        title: formData.title,
        company: formData.company,
        sector: formData.sector,
        value: Number(formData.value) || 0,
        region: formData.region,
        status: formData.status
      }
    }, {
      onSuccess: () => {
        toast({ title: "Sucesso", description: "Oportunidade criada com sucesso." });
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
        setFormData({ title: "", company: "", sector: "Upstream", value: "", region: "", status: "Aberta" });
      },
      onError: () => {
        toast({ title: "Erro", description: "Falha ao criar oportunidade.", variant: "destructive" });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'aberta': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'recebimento de propostas': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'oportunidades agendadas': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'em análise': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'fechada': return 'bg-muted text-muted-foreground border-border';
      case 'ganha': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-7 w-7 text-primary" />
            Oportunidades
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Gestão de oportunidades no setor O&G e Energia.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground font-medium">
              <Plus className="h-4 w-4 mr-2" />
              Nova Oportunidade
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Criar Oportunidade</DialogTitle>
                <DialogDescription>
                  Adicione uma nova oportunidade de negócio ao radar.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="company">Empresa</Label>
                    <Input id="company" required value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sector">Setor</Label>
                    <Select value={formData.sector} onValueChange={v => setFormData({...formData, sector: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Upstream">Upstream</SelectItem>
                        <SelectItem value="Midstream">Midstream</SelectItem>
                        <SelectItem value="Downstream">Downstream</SelectItem>
                        <SelectItem value="Renováveis">Renováveis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="value">Valor (R$)</Label>
                    <Input id="value" type="number" required value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="region">Região</Label>
                    <Input id="region" required value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createOp.isPending}>
                  {createOp.isPending ? "Salvando..." : "Salvar Oportunidade"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por título ou empresa..."
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar oportunidade por título ou empresa"
                data-testid="input-opportunity-search"
              />
            </div>
            <div className="flex w-full flex-wrap gap-2 md:w-auto">
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger className="w-full bg-background sm:w-[160px]" aria-label="Filtrar por setor" data-testid="select-opportunity-sector">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3 w-3 opacity-50" />
                    <SelectValue placeholder="Setor" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Setores</SelectItem>
                  {[...new Set((opportunities ?? []).map((item) => item.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={deadlineFilter} onValueChange={setDeadlineFilter}>
                <SelectTrigger className="w-full bg-background sm:w-[160px]" aria-label="Filtrar por prazo" data-testid="select-deadline-filter"><SelectValue placeholder="Prazo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os prazos</SelectItem>
                  <SelectItem value="upcoming">Prazos futuros</SelectItem>
                  <SelectItem value="next7">Próximos 7 dias</SelectItem>
                  <SelectItem value="expired">Prazo expirado</SelectItem>
                  <SelectItem value="missing">Sem prazo informado</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full bg-background sm:w-[160px]" aria-label="Filtrar por status" data-testid="select-opportunity-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="Aberta">Aberta</SelectItem>
                  <SelectItem value="Em Análise">Em Análise</SelectItem>
                  <SelectItem value="Ganha">Ganha</SelectItem>
                  <SelectItem value="Fechada">Fechada</SelectItem>
                  <SelectItem value="Recebimento de Propostas">Recebimento de Propostas</SelectItem>
                  <SelectItem value="Oportunidades Agendadas">Oportunidades Agendadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <div className="rounded-md border border-transparent overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-medium text-foreground">Oportunidade</TableHead>
                <TableHead className="font-medium text-foreground">Empresa</TableHead>
                <TableHead className="font-medium text-foreground">Setor</TableHead>
                <TableHead className="font-medium text-foreground text-right">Valor (R$)</TableHead>
                <TableHead className="font-medium text-foreground">Região</TableHead>
                <TableHead className="font-medium text-foreground">Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                  </TableRow>
                ))
              ) : filteredOpportunities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Nenhuma oportunidade encontrada com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOpportunities.map((opportunity) => (
                  <TableRow key={opportunity.id} onClick={() => setSelected(opportunity as OpportunityDetail)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(opportunity as OpportunityDetail); } }} tabIndex={0} aria-label={`Abrir oportunidade ${opportunity.title}`} data-testid={`row-opportunity-${opportunity.id}`} className="border-border hover:bg-muted/30 transition-colors group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{opportunity.title}</span>
                        {opportunity.description?.includes("[RESUMO PROVISÓRIO PETRONECT]") && (
                          <Badge variant="outline" className="mt-1 w-fit border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px]">
                            Resumo provisório · conferir edital
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`mt-1 w-fit text-[10px] ${opportunity.documentsChecked
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
                        >
                          {opportunity.documentsChecked
                            ? <><ShieldCheck className="h-3 w-3 mr-1" />Documentos conferidos</>
                            : <><CircleAlert className="h-3 w-3 mr-1" />Documentos pendentes de conferência</>}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-normal">Criado em {formatDate(opportunity.createdAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground uppercase">
                          {opportunity.company.substring(0, 2)}
                        </div>
                        {opportunity.company}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{opportunity.sector || "Não informado"}</TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {opportunity.description?.includes("[RESUMO PROVISÓRIO PETRONECT]")
                        ? "Não informado"
                        : formatCurrency(opportunity.value)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{opportunity.region}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${getStatusColor(opportunity.status)} text-xs font-semibold px-2 py-0.5 rounded-sm`}>
                        {opportunity.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label={`Ver ${opportunity.title}`} data-testid={`button-open-opportunity-${opportunity.id}`} onClick={(e) => { e.stopPropagation(); setSelected(opportunity as OpportunityDetail); }} className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <OpportunityDetailModal
        opportunity={selected}
        onClose={() => setSelected(null)}
        onDocumentsChanged={() => queryClient.invalidateQueries({ queryKey: getListOpportunitiesQueryKey() })}
      />
    </div>
  );
}
