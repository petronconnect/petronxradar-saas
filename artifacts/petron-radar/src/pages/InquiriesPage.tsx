import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListInquiries,
  getListInquiriesQueryKey,
  useCreateInquiry,
  useConvertInquiryToClient,
  useUpdateInquiryStatus,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus, Mail, Building, User, Activity } from "lucide-react";

const inquiryFormSchema = z.object({
  companyName: z.string().min(2, "Nome da empresa é obrigatório"),
  cnpj: z.string().min(14, "CNPJ inválido"),
  contactName: z.string().min(2, "Nome do responsável é obrigatório"),
  contactRole: z.string().min(2, "Cargo é obrigatório"),
  email: z.string().email("E-mail inválido"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  segment: z.string().min(1, "Segmento é obrigatório"),
  servicesOffered: z.string().min(10, "Descreva os serviços/produtos"),
  hasPetrobrasRegistration: z.enum(["Sim", "Não"]),
  availableDocuments: z.string().optional(),
  interestedInBidding: z.enum(["Sim", "Não", "Analisando"]),
  operationalVolume: z.string().min(1, "Volume operacional é obrigatório"),
  regions: z.string().min(2, "Regiões de atuação obrigatórias"),
  desiredPlan: z.string().min(1, "Plano de interesse é obrigatório"),
  allowContact: z.boolean().refine(val => val === true, {
    message: "Você deve autorizar o contato",
  }),
  notes: z.string().optional(),
});

type InquiryFormValues = z.infer<typeof inquiryFormSchema>;

export default function InquiriesPage() {
  const [activeTab, setActiveTab] = useState("leads");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: inquiries, isLoading } = useListInquiries();
  
  const createInquiry = useCreateInquiry();
  const convertToClient = useConvertInquiryToClient();
  const updateStatus = useUpdateInquiryStatus();

  const form = useForm<InquiryFormValues>({
    resolver: zodResolver(inquiryFormSchema),
    defaultValues: {
      companyName: "",
      cnpj: "",
      contactName: "",
      contactRole: "",
      email: "",
      whatsapp: "",
      segment: "",
      servicesOffered: "",
      hasPetrobrasRegistration: "Não",
      availableDocuments: "",
      interestedInBidding: "Sim",
      operationalVolume: "",
      regions: "",
      desiredPlan: "",
      allowContact: false,
      notes: "",
    },
  });

  const onSubmit = (values: InquiryFormValues) => {
    createInquiry.mutate(
      {
        data: {
          ...values,
          hasPetrobrasRegistration: values.hasPetrobrasRegistration === "Sim",
          interestedInBidding: values.interestedInBidding === "Sim",
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Sucesso!",
            description: "Inquiry criado com sucesso.",
          });
          queryClient.invalidateQueries({ queryKey: getListInquiriesQueryKey() });
          form.reset();
          setActiveTab("leads");
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível criar o inquiry.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleConvert = (id: number) => {
    convertToClient.mutate(
      { id },
      {
        onSuccess: () => {
          toast({
            title: "Sucesso!",
            description: "Lead convertido em cliente com sucesso.",
          });
          queryClient.invalidateQueries({ queryKey: getListInquiriesQueryKey() });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível converter o lead.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleUpdateStatus = (id: number, status: string) => {
    updateStatus.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          toast({
            title: "Status atualizado",
            description: `Status alterado para ${status}.`,
          });
          queryClient.invalidateQueries({ queryKey: getListInquiriesQueryKey() });
        },
        onError: () => {
          toast({
            title: "Erro",
            description: "Não foi possível atualizar o status.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const getScoreColor = (score: number) => {
    if (score <= 40) return "bg-destructive text-destructive-foreground";
    if (score <= 70) return "bg-amber-500 text-amber-950";
    return "bg-green-500 text-green-950";
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "novo":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Novo</Badge>;
      case "em análise":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-amber-950">Em Análise</Badge>;
      case "qualificado":
        return <Badge className="bg-green-500 hover:bg-green-600 text-green-950">Qualificado</Badge>;
      case "convertido":
        return <Badge variant="secondary">Convertido</Badge>;
      case "descartado":
        return <Badge variant="destructive">Descartado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inquiries</h1>
          <p className="text-muted-foreground mt-1">Gestão de leads e captação de clientes</p>
        </div>
        <Button onClick={() => setActiveTab("novo")} data-testid="button-new-inquiry">
          <Plus className="mr-2 h-4 w-4" />
          Novo Inquiry
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="leads" data-testid="tab-leads">Leads Recebidos</TabsTrigger>
          <TabsTrigger value="novo" data-testid="tab-new-inquiry">Novo Inquiry</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Painel de Gestão de Leads</CardTitle>
              <CardDescription>
                Acompanhe e qualifique as empresas interessadas na plataforma Petron Radar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plano Recomendado</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-[40px] rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-[100px] ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : inquiries?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                          Nenhum lead encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      inquiries?.map((inquiry) => (
                        <TableRow key={inquiry.id}>
                          <TableCell>
                            <div className="font-medium">{inquiry.companyName}</div>
                            <div className="text-xs text-muted-foreground">{inquiry.cnpj}</div>
                          </TableCell>
                          <TableCell>
                            <div>{inquiry.contactName}</div>
                            <div className="text-xs text-muted-foreground">{inquiry.email}</div>
                          </TableCell>
                          <TableCell>{inquiry.segment}</TableCell>
                          <TableCell>
                            <Badge className={getScoreColor(inquiry.leadScore)} variant="secondary">
                              {inquiry.leadScore}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(inquiry.status)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{inquiry.recommendedPlan || "-"}</TableCell>
                          <TableCell>{new Date(inquiry.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" data-testid={`button-status-dropdown-${inquiry.id}`}>
                                    <span className="sr-only">Abrir menu</span>
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(inquiry.id, "Novo")}>Novo</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(inquiry.id, "Em Análise")}>Em Análise</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(inquiry.id, "Qualificado")}>Qualificado</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(inquiry.id, "Descartado")}>Descartado</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              
                              {inquiry.status !== "Convertido" && inquiry.status !== "Descartado" && (
                                <Button 
                                  size="sm" 
                                  onClick={() => handleConvert(inquiry.id)}
                                  disabled={convertToClient.isPending}
                                  data-testid={`button-convert-${inquiry.id}`}
                                >
                                  Converter
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="novo" className="mt-6">
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle>Formulário Premium de Captação</CardTitle>
              <CardDescription>
                Cadastre um novo interesse em participar da plataforma Petron Radar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  
                  {/* Dados da Empresa */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary border-b border-border pb-2">
                      <Building className="h-5 w-5" />
                      <h3 className="text-lg font-medium">Dados da Empresa</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome da Empresa *</FormLabel>
                            <FormControl>
                              <Input placeholder="Sua Empresa Ltda" {...field} data-testid="input-company-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cnpj"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CNPJ *</FormLabel>
                            <FormControl>
                              <Input placeholder="00.000.000/0000-00" {...field} data-testid="input-cnpj" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="segment"
                        render={({ field }) => (
                          <FormItem className="col-span-1 md:col-span-2">
                            <FormLabel>Segmento de Atuação *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-segment">
                                  <SelectValue placeholder="Selecione o segmento" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Upstream">Upstream</SelectItem>
                                <SelectItem value="Midstream">Midstream</SelectItem>
                                <SelectItem value="Downstream">Downstream</SelectItem>
                                <SelectItem value="Petroquímica">Petroquímica</SelectItem>
                                <SelectItem value="Serviços O&G">Serviços O&G</SelectItem>
                                <SelectItem value="Tecnologia">Tecnologia</SelectItem>
                                <SelectItem value="Outro">Outro</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Responsável pelo Contato */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary border-b border-border pb-2">
                      <User className="h-5 w-5" />
                      <h3 className="text-lg font-medium">Responsável pelo Contato</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="contactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Completo *</FormLabel>
                            <FormControl>
                              <Input placeholder="João Silva" {...field} data-testid="input-contact-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="contactRole"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cargo / Função *</FormLabel>
                            <FormControl>
                              <Input placeholder="Diretor Comercial" {...field} data-testid="input-contact-role" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail Corporativo *</FormLabel>
                            <FormControl>
                              <Input placeholder="joao@empresa.com.br" type="email" {...field} data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="whatsapp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>WhatsApp *</FormLabel>
                            <FormControl>
                              <Input placeholder="+55 11 99999-9999" {...field} data-testid="input-whatsapp" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Perfil Operacional */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary border-b border-border pb-2">
                      <Activity className="h-5 w-5" />
                      <h3 className="text-lg font-medium">Perfil Operacional</h3>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="servicesOffered"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Serviços/Produtos Oferecidos *</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Descreva os principais produtos ou serviços do seu portfólio..." 
                              className="min-h-[100px]" 
                              {...field} 
                              data-testid="textarea-services"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="hasPetrobrasRegistration"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel>Possui cadastro Petrobras/Petronect? *</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex flex-row space-x-4"
                                data-testid="radio-petrobras-reg"
                              >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="Sim" />
                                  </FormControl>
                                  <FormLabel className="font-normal">Sim</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="Não" />
                                  </FormControl>
                                  <FormLabel className="font-normal">Não</FormLabel>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="interestedInBidding"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormLabel>Interesse em participar de licitações? *</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex flex-col space-y-2"
                                data-testid="radio-bidding"
                              >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl><RadioGroupItem value="Sim" /></FormControl>
                                  <FormLabel className="font-normal">Sim, ativamente</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl><RadioGroupItem value="Não" /></FormControl>
                                  <FormLabel className="font-normal">Não</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl><RadioGroupItem value="Analisando" /></FormControl>
                                  <FormLabel className="font-normal">Ainda analisando o mercado</FormLabel>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="availableDocuments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Documentos disponíveis (Opcional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="CRC, ISO, certificações setoriais, etc." 
                              {...field} 
                              data-testid="textarea-docs"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="operationalVolume"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Volume Operacional *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-volume">
                                  <SelectValue placeholder="Selecione o volume" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Pequeno (até R$500k/ano)">Pequeno (até R$500k/ano)</SelectItem>
                                <SelectItem value="Médio (R$500k–R$5M/ano)">Médio (R$500k–R$5M/ano)</SelectItem>
                                <SelectItem value="Grande (acima de R$5M/ano)">Grande (acima de R$5M/ano)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="regions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Regiões de Atuação *</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Sudeste, Nordeste, RJ" {...field} data-testid="input-regions" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Plano de Interesse */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary border-b border-border pb-2">
                      <Mail className="h-5 w-5" />
                      <h3 className="text-lg font-medium">Plano de Interesse</h3>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="desiredPlan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plano Desejado *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-plan">
                                <SelectValue placeholder="Selecione o plano de interesse" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Radar Starter">Radar Starter (R$890/mês)</SelectItem>
                              <SelectItem value="Radar Pro">Radar Pro (R$2.490/mês)</SelectItem>
                              <SelectItem value="Radar Enterprise">Radar Enterprise (R$5.990/mês)</SelectItem>
                              <SelectItem value="Radar IA Managed">Radar IA Managed (R$12.900/mês)</SelectItem>
                              <SelectItem value="Não sei ainda">Não sei ainda</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Comunicação */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações adicionais (Opcional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Algo mais que devamos saber?" {...field} data-testid="textarea-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="allowContact"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-allow-contact"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Autorizo contato da equipe Petron Radar *
                            </FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Concordo em receber comunicações sobre a plataforma e meus interesses comerciais.
                            </p>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      size="lg" 
                      className="w-full md:w-auto"
                      disabled={createInquiry.isPending}
                      data-testid="button-submit-inquiry"
                    >
                      {createInquiry.isPending ? "Enviando..." : "Enviar Interesse"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
