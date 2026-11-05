import { useListBulletins, useCreateBulletin } from "@workspace/api-client-react";
import { formatDate } from "@/lib/formatters";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, FileText, Clock, User } from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { useSearch } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Bulletins() {
  const queryString = useSearch();
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState(new URLSearchParams(queryString).get("q") || "");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setSearch(new URLSearchParams(queryString).get("q") || "");
  }, [queryString]);

  const { data: bulletins, isLoading } = useListBulletins({
    category: category !== "all" ? category : undefined,
  });

  const createBul = useCreateBulletin();

  const [formData, setFormData] = useState({
    title: "",
    category: "Análise de Mercado",
    summary: "",
    author: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBul.mutate({
      data: {
        title: formData.title,
        category: formData.category,
        summary: formData.summary,
        author: formData.author,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Sucesso", description: "Boletim criado com sucesso." });
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/bulletins"] });
        setFormData({ title: "", category: "Análise de Mercado", summary: "", author: "" });
      },
      onError: () => {
        toast({ title: "Erro", description: "Falha ao criar boletim.", variant: "destructive" });
      }
    });
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'análise de mercado': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'regulatório': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      case 'tecnologia': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'm&a': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default: return 'bg-secondary text-secondary-foreground border-border';
    }
  };

  const filteredBulletins = bulletins?.filter(b => 
    search === "" || 
    b.title.toLowerCase().includes(search.toLowerCase()) || 
    b.summary.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Boletins de Inteligência
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Análises setoriais, relatórios e alertas do mercado.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground font-medium">
              <Plus className="h-4 w-4 mr-2" />
              Novo Boletim
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Criar Boletim</DialogTitle>
                <DialogDescription>
                  Adicione um novo boletim de inteligência de mercado.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Análise de Mercado">Análise de Mercado</SelectItem>
                        <SelectItem value="Regulatório">Regulatório</SelectItem>
                        <SelectItem value="Tecnologia">Tecnologia</SelectItem>
                        <SelectItem value="M&A">M&A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="author">Autor</Label>
                    <Input id="author" required value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="summary">Resumo</Label>
                  <Textarea id="summary" className="resize-none" rows={4} required value={formData.summary} onChange={e => setFormData({...formData, summary: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createBul.isPending}>
                  {createBul.isPending ? "Salvando..." : "Salvar Boletim"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar nos boletins..."
            className="pl-9 bg-card border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar boletins"
            data-testid="input-bulletin-search"
          />
        </div>
        <div className="w-full md:w-auto">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full md:w-[200px] bg-card border-border">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              <SelectItem value="Análise de Mercado">Análise de Mercado</SelectItem>
              <SelectItem value="Regulatório">Regulatório</SelectItem>
              <SelectItem value="Tecnologia">Tecnologia</SelectItem>
              <SelectItem value="M&A">M&A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card border-border overflow-hidden h-[300px]">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
              <CardFooter className="absolute bottom-0 w-full pt-4 pb-4 bg-card border-t border-border">
                <div className="flex justify-between w-full">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : filteredBulletins?.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-lg bg-card/50">
          <FileText className="h-12 w-12 text-muted-foreground opacity-20 mb-4" />
          <h3 className="text-lg font-medium text-foreground">Nenhum boletim encontrado</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            Tente ajustar os filtros de busca para encontrar o que você está procurando.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredBulletins?.map((bulletin, index) => (
            <motion.div
              key={bulletin.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4 }}
              className="h-full"
            >
              <Card className="bg-card border-border hover:border-primary/50 transition-colors h-full flex flex-col group cursor-pointer overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <CardHeader className="pb-3 flex-none">
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant="outline" className={`${getCategoryColor(bulletin.category)} text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm uppercase`}>
                      {bulletin.category}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
                    {bulletin.title}
                  </h3>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-muted-foreground text-sm line-clamp-4 leading-relaxed">
                    {bulletin.summary}
                  </p>
                </CardContent>
                <CardFooter className="pt-4 border-t border-border mt-auto bg-muted/20 flex-none">
                  <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      <span className="font-medium truncate max-w-[100px]">{bulletin.author}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(bulletin.publishedAt)}</span>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
