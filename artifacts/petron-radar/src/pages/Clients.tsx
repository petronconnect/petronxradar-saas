import { useListClients, useCreateClient } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, Search, MoreHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useEffect } from "react";
import { useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Clients() {
  const queryString = useSearch();
  const { data: clients, isLoading } = useListClients();
  const [search, setSearch] = useState(new URLSearchParams(queryString).get("q") || "");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCli = useCreateClient();

  useEffect(() => {
    setSearch(new URLSearchParams(queryString).get("q") || "");
  }, [queryString]);

  const [formData, setFormData] = useState({
    name: "",
    company: "",
    segment: "Operadora",
    plan: "Radar Pro",
    status: "Ativo"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCli.mutate({
      data: {
        name: formData.name,
        company: formData.company,
        segment: formData.segment,
        plan: formData.plan,
        status: formData.status
      }
    }, {
      onSuccess: () => {
        toast({ title: "Sucesso", description: "Cliente cadastrado com sucesso." });
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
        setFormData({ name: "", company: "", segment: "Operadora", plan: "Radar Pro", status: "Ativo" });
      },
      onError: () => {
        toast({ title: "Erro", description: "Falha ao criar cliente.", variant: "destructive" });
      }
    });
  };

  const getStatusColor = (status: string) => {
    if (status === 'Ativo') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (status === 'Inativo') return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-secondary text-secondary-foreground border-border';
  };

  const getPlanBadge = (plan: string) => {
    if (plan.includes('Enterprise') || plan.includes('Managed')) {
      return 'bg-primary/20 text-primary border-primary/30 font-bold';
    }
    return 'bg-secondary text-foreground border-border';
  };

  const filteredClients = clients?.filter(c => 
    search === "" || 
    String(c.id).includes(search) ||
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Clientes B2B
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Gestão de contas, assinaturas e contatos corporativos.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground font-medium">
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Novo Cliente</DialogTitle>
                <DialogDescription>
                  Cadastre um novo cliente B2B na plataforma.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome do Contato</Label>
                  <Input id="name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input id="company" required value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="segment">Segmento</Label>
                    <Select value={formData.segment} onValueChange={v => setFormData({...formData, segment: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Operadora">Operadora</SelectItem>
                        <SelectItem value="Fornecedora">Fornecedora</SelectItem>
                        <SelectItem value="Consultoria">Consultoria</SelectItem>
                        <SelectItem value="Investimentos">Investimentos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="plan">Plano</Label>
                    <Select value={formData.plan} onValueChange={v => setFormData({...formData, plan: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Radar Starter">Radar Starter</SelectItem>
                        <SelectItem value="Radar Pro">Radar Pro</SelectItem>
                        <SelectItem value="Radar Enterprise">Radar Enterprise</SelectItem>
                        <SelectItem value="Radar IA Managed">Radar IA Managed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createCli.isPending}>
                  {createCli.isPending ? "Salvando..." : "Salvar Cliente"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nome ou empresa..."
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar registros comerciais por nome ou empresa"
              data-testid="input-client-search"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <div className="rounded-md border border-transparent overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-medium text-foreground">Cliente</TableHead>
                <TableHead className="font-medium text-foreground">Empresa</TableHead>
                <TableHead className="font-medium text-foreground">Segmento</TableHead>
                <TableHead className="font-medium text-foreground">Plano</TableHead>
                <TableHead className="font-medium text-foreground">Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                  </TableRow>
                ))
              ) : filteredClients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients?.map((client) => (
                  <TableRow key={client.id} className="border-border hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{client.name}</span>
                        {client.email && <span className="text-xs text-muted-foreground font-normal">{client.email}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{client.company}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{client.segment}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${getPlanBadge(client.plan)} text-xs px-2 py-0.5 rounded-sm`}>
                        {client.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${getStatusColor(client.status)} text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm`}>
                        {client.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
