import { useListPlans } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, CreditCard, Sparkles, Zap, Building2, MessageCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { trackEvent } from "@/lib/analytics";

const WHATSAPP_NUMBER = "5513998035663";

function getPlanAction(slug: string, name: string): { type: "checkout" | "whatsapp"; label?: string } {
  if (slug === "radar-enterprise" || slug === "radar-ia-managed") {
    return { type: "whatsapp" };
  }
  return { type: "checkout" };
}

function openWhatsApp(planName: string) {
  const msg = encodeURIComponent(
    `Olá! Tenho interesse no plano ${planName} do Petron Radar. Poderia me dar mais informações?`
  );
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
}

export default function Plans() {
  const { data: plans, isLoading } = useListPlans();
  const [, navigate] = useLocation();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  const getPlanIcon = (name: string) => {
    if (name.includes('Lançamento') || name.includes('Especial')) return <Sparkles className="h-5 w-5 text-amber-400" />;
    if (name.includes('Starter')) return <Zap className="h-5 w-5 text-zinc-400" />;
    if (name.includes('Pro')) return <Sparkles className="h-5 w-5 text-primary" />;
    if (name.includes('Enterprise')) return <Building2 className="h-5 w-5 text-indigo-400" />;
    if (name.includes('Managed')) return <div className="h-5 w-5 text-amber-500 font-bold font-serif text-lg leading-none">IA</div>;
    return <CreditCard className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-12 pb-16">
      <div className="text-center max-w-3xl mx-auto pt-8">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Escolha o poder do seu Radar</h1>
        <p className="text-lg text-muted-foreground">
          Planos desenvolvidos para diferentes escalas de operação no mercado de Petróleo, Óleo e Gás. 
          Evolua conforme sua necessidade de inteligência.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 px-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-[600px] bg-card border-border flex flex-col">
              <CardHeader>
                <Skeleton className="h-6 w-24 mb-2" />
                <Skeleton className="h-10 w-40 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <Skeleton className="h-px w-full" />
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="flex gap-2 items-center">
                    <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Skeleton className="h-12 w-full rounded-md" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 items-end"
        >
          {plans?.map((plan) => {
            const isHighlighted = plan.highlighted;
            const isManaged = plan.name.includes("IA Managed");
            
            return (
              <motion.div key={plan.id} variants={item} className="h-full">
                <Card className={`
                  flex flex-col h-full relative transition-all duration-300
                  ${isHighlighted ? 'border-primary shadow-[0_0_30px_-10px_rgba(var(--primary),0.3)] md:-translate-y-4 z-10' : 'border-border bg-card/60 hover:bg-card hover:border-muted-foreground/30'}
                  ${isManaged ? 'bg-gradient-to-b from-sidebar to-background border-primary/30' : ''}
                `}>
                  {plan.badge && (
                    <div className="absolute -top-3 inset-x-0 flex justify-center">
                      <Badge className={`${
                        isHighlighted ? 'bg-primary text-primary-foreground' : 
                        isManaged ? 'bg-sidebar-primary text-sidebar-primary-foreground font-bold tracking-wider' : 
                        'bg-secondary text-secondary-foreground'
                      } uppercase text-[10px] font-bold px-3 py-1 shadow-sm`}>
                        {plan.badge}
                      </Badge>
                    </div>
                  )}

                  {isManaged && (
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none rounded-xl"></div>
                  )}

                  <CardHeader className="pt-8">
                    <div className="flex items-center gap-2 mb-2">
                      {getPlanIcon(plan.name)}
                      <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                    </div>
                    <div className="mb-2">
                      <span className="text-3xl font-extrabold tracking-tight">
                        {formatCurrency(plan.price).replace(",00", "")}
                      </span>
                      <span className="text-muted-foreground text-sm font-medium ml-1">/mês</span>
                    </div>
                    <CardDescription className="text-sm min-h-[40px] text-foreground/70">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-4">
                    <div className="text-sm font-medium py-2 border-y border-border/50 text-muted-foreground">
                      Ideal para: <span className="text-foreground">{plan.targetAudience}</span>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-start gap-3 text-sm">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>
                          <strong className="font-medium text-foreground">
                            {plan.opportunityLimit === null ? 'Oportunidades Ilimitadas' : `Até ${plan.opportunityLimit} oportunidades/mês`}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-start gap-3 text-sm">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>
                          <strong className="font-medium text-foreground">
                            {plan.bulletinLimit === null ? 'Boletins Ilimitados' : `Até ${plan.bulletinLimit} boletins/mês`}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-start gap-3 text-sm pb-2 border-b border-border/30">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>
                          <strong className="font-medium text-foreground">
                            {plan.clientLimit === null ? 'Usuários Ilimitados' : `${plan.clientLimit} usuário${plan.clientLimit > 1 ? 's' : ''}`}
                          </strong>
                        </span>
                      </div>

                      <div className="pt-2 space-y-3">
                        {plan.features.map((feature, idx) => (
                          <div key={idx} className={`flex items-start gap-3 text-sm ${!feature.included ? 'opacity-50' : ''}`}>
                            {feature.included ? (
                              <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            )}
                            <div className="flex flex-col">
                              <span className={feature.included ? 'text-foreground/90' : 'text-muted-foreground'}>
                                {feature.label}
                              </span>
                              {feature.detail && (
                                <span className="text-[11px] text-muted-foreground mt-0.5">{feature.detail}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-6 pb-8">
                    {(() => {
                      const action = getPlanAction(plan.slug, plan.name);
                      const isWhatsApp = action.type === "whatsapp";
                      return (
                        <Button
                          className={`w-full font-medium ${
                            isHighlighted
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md'
                              : isManaged
                                ? 'bg-foreground text-background hover:bg-foreground/90'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border'
                          }`}
                          size="lg"
                          onClick={() => {
                            trackEvent("plan_selected", {
                              plan: plan.slug,
                              destination: isWhatsApp ? "whatsapp" : "checkout",
                              location: "plans_page",
                            });
                            if (isWhatsApp) {
                              openWhatsApp(plan.name);
                            } else {
                              navigate(`/checkout/${plan.slug}`);
                            }
                          }}
                        >
                          {isWhatsApp && <MessageCircle className="h-4 w-4 mr-2" />}
                          {plan.ctaLabel}
                        </Button>
                      );
                    })()}
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto pt-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold tracking-tight">Perguntas Frequentes</h2>
          <p className="text-muted-foreground mt-2">Tire suas dúvidas sobre nossa plataforma e planos.</p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1" className="border-border">
            <AccordionTrigger className="text-left font-medium hover:text-primary transition-colors">
              Como funciona o plano Radar IA Managed?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              O Radar IA Managed é um serviço "done-for-you". Em vez de você acessar a plataforma e buscar oportunidades, nossa equipe especializada, potencializada por IA, faz a curadoria diária, filtra ruídos e entrega diretamente no seu e-mail relatórios executivos prontos para tomada de decisão, junto com reuniões mensais de alinhamento estratégico.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2" className="border-border">
            <AccordionTrigger className="text-left font-medium hover:text-primary transition-colors">
              Posso fazer upgrade ou downgrade a qualquer momento?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              Sim. Alterações de plano passam a valer no ciclo de faturamento seguinte. Se você fizer upgrade durante o mês, o valor será cobrado proporcionalmente (pró-rata) ao tempo restante do ciclo atual.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3" className="border-border">
            <AccordionTrigger className="text-left font-medium hover:text-primary transition-colors">
              O que acontece se eu atingir o limite de oportunidades do meu plano?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              Quando você atingir 90% do seu limite, enviaremos um alerta. Ao bater 100%, você não poderá visualizar os detalhes de novas oportunidades até o ciclo virar ou até fazer o upgrade de plano. Os dados históricos permanecem acessíveis.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4" className="border-border">
            <AccordionTrigger className="text-left font-medium hover:text-primary transition-colors">
              Como é feito o pagamento?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              Aceitamos cartões de crédito corporativos, transferência bancária (TED/PIX) e faturamento via boleto para planos Pro, Enterprise e Managed. O faturamento via boleto requer análise de crédito.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
