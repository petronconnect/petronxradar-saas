import { useListBetaClients, useUpdateBetaClientChecklistItem, getGetBetaClientQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, MapPin, Mail, Phone, Building2, CheckCircle2, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

function BetaClientCard({ client }: { client: any }) {
  const queryClient = useQueryClient();
  const updateChecklist = useUpdateBetaClientChecklistItem();
  const [isOpen, setIsOpen] = useState(false);

  const completedSteps = client.checklist?.filter((item: any) => item.completed).length || 0;
  const totalSteps = client.checklist?.length || 0;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const handleToggleChecklist = (itemId: number, completed: boolean) => {
    updateChecklist.mutate(
      {
        betaClientId: client.id,
        id: itemId,
        data: { completed }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBetaClientQueryKey(client.id) });
        }
      }
    );
  };

  return (
    <Card className="flex flex-col h-full bg-card border-card-border overflow-hidden">
      <CardHeader className="pb-4 border-b border-border bg-muted/30">
        <div className="flex justify-between items-start mb-2">
          <Badge className="bg-primary text-primary-foreground font-bold" data-testid={`badge-beta-${client.code}`}>
            {client.code}
          </Badge>
          <div className="flex gap-2">
            <Badge variant="outline" className="border-primary/50 text-primary" data-testid={`badge-status-${client.code}`}>
              {client.clientStatus}
            </Badge>
            {client.priority === "Alta" && (
              <Badge variant="destructive" data-testid={`badge-priority-${client.code}`}>
                Prioridade Alta
              </Badge>
            )}
          </div>
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">{client.tradeName}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground mt-1">{client.companyName}</CardDescription>
        
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="secondary" className="bg-secondary/50">{client.onboardingStatus}</Badge>
          {client.commercialReady && (
            <Badge className="bg-green-500/20 text-green-500 border-green-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Pronto para Validação
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-6 space-y-6">
        {/* Contact Info */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Contato
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground">Responsável</span>
              <p className="font-medium text-foreground">{client.contactName || <span className="text-muted/50">— a confirmar</span>}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">E-mail</span>
              <p className="font-medium text-foreground">{client.email || <span className="text-muted/50">— a confirmar</span>}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp</span>
              <p className="font-medium text-foreground">{client.whatsapp || <span className="text-muted/50">— a confirmar</span>}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Localização</span>
              <p className="font-medium text-foreground">
                {client.city && client.state ? `${client.city}/${client.state}` : <span className="text-muted/50">— a confirmar</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Collapsible Cadastral Data */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-md p-4 bg-muted/20">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Dados Cadastrais
            </h4>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0 h-8 w-8 hover:bg-transparent" data-testid={`btn-toggle-data-${client.code}`}>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="mt-4 grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
            <div><span className="text-muted-foreground block mb-1">CNPJ</span><span className="font-medium">{client.cnpj}</span></div>
            <div><span className="text-muted-foreground block mb-1">Segmento</span><span className="font-medium">{client.segment}</span></div>
            <div><span className="text-muted-foreground block mb-1">Porte</span><span className="font-medium">{client.size}</span></div>
            <div><span className="text-muted-foreground block mb-1">Natureza Jurídica</span><span className="font-medium">{client.legalNature}</span></div>
            <div><span className="text-muted-foreground block mb-1">Simples Nacional</span><span className="font-medium">{client.simplesNacional ? "Sim" : "Não"}</span></div>
            <div><span className="text-muted-foreground block mb-1">Matriz/Filial</span><span className="font-medium">{client.isHeadquarters ? "Matriz" : "Filial"}</span></div>
            <div><span className="text-muted-foreground block mb-1">Abertura</span><span className="font-medium">{new Date(client.openedAt).toLocaleDateString('pt-BR')}</span></div>
            <div><span className="text-muted-foreground block mb-1">Capital Social</span><span className="font-medium">{Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(client.capital)}</span></div>
            <div>
              <span className="text-muted-foreground block mb-1">Situação Cadastral</span>
              <Badge variant="outline" className={client.cadastralStatus === "Ativa" ? "text-green-500 border-green-500" : ""}>{client.cadastralStatus}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Cadastro Petrobras</span>
              {client.petrobrasRegistration ? (
                <Badge className="bg-primary/20 text-primary border-primary/30 flex items-center gap-1 w-fit">
                  <ShieldCheck className="w-3 h-3" />
                  Ativo
                </Badge>
              ) : (
                <span className="font-medium">Não</span>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Checklist */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Checklist de Onboarding
            </h4>
            <span className="text-xs font-medium text-muted-foreground">{completedSteps} / {totalSteps} etapas concluídas</span>
          </div>
          
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-in-out" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="space-y-3 mt-4">
            {client.checklist?.map((item: any) => (
              <div key={item.id} className="flex items-start space-x-3">
                <Checkbox 
                  id={`check-${item.id}`} 
                  checked={item.completed}
                  onCheckedChange={(checked) => handleToggleChecklist(item.id, checked as boolean)}
                  className="mt-0.5"
                  data-testid={`checkbox-item-${item.id}`}
                />
                <label 
                  htmlFor={`check-${item.id}`}
                  className={`text-sm leading-tight cursor-pointer ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                >
                  {item.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {client.notes && (
          <div className="bg-primary/5 border border-primary/20 rounded-md p-4">
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Observações</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BetaClientsPage() {
  const { data: clients, isLoading } = useListBetaClients();

  return (
    <div className="container py-8 max-w-7xl space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes Beta</h1>
          <p className="text-muted-foreground mt-1">Gestão e acompanhamento das empresas no programa Beta 01 e 02.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[600px] rounded-xl" />
          <Skeleton className="h-[600px] rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {clients?.map((client) => (
            <BetaClientCard key={client.id} client={client} />
          ))}
        </div>
      )}

      {/* Summary Section */}
      {!isLoading && clients && (
        <Card className="bg-muted/30 border-border mt-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Resumo do Programa Beta
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Total de Empresas</span>
                <p className="text-3xl font-bold text-foreground">{clients.length}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Progresso Médio</span>
                <p className="text-3xl font-bold text-primary">
                  {Math.round(clients.reduce((acc, c) => {
                    const steps = c.checklist?.length || 1;
                    const comp = c.checklist?.filter((i:any) => i.completed).length || 0;
                    return acc + (comp / steps);
                  }, 0) / (clients.length || 1) * 100)}%
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Prontas para Comercial</span>
                <p className="text-3xl font-bold text-foreground">
                  {clients.filter(c => c.commercialReady).length} / {clients.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
