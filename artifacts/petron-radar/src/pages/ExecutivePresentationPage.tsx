import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PetronLogo } from "@/components/layout/PetronLogo";
import { 
  AlertTriangle, FileSearch, Network, Radar, Newspaper, 
  Users, Plug, CheckCircle2, ChevronLeft, ChevronRight,
  ShieldCheck, Presentation
} from "lucide-react";

const TOTAL_SLIDES = 7;

export default function ExecutivePresentationPage() {
  const [, setLocation] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Space" || e.key === "Enter") {
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        prevSlide();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide]);

  const nextSlide = () => setCurrentSlide((prev) => Math.min(prev + 1, TOTAL_SLIDES));
  const prevSlide = () => setCurrentSlide((prev) => Math.max(prev - 1, 1));

  // Shared slide container
  const SlideWrapper = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <motion.div
      key={currentSlide}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4 }}
      className={`absolute inset-0 flex flex-col items-center justify-center p-12 text-center w-full h-full ${className}`}
    >
      {children}
    </motion.div>
  );

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] text-white flex flex-col overflow-hidden select-none font-sans z-50">
      {/* Progress Bar */}
      <div className="h-1 bg-white/10 w-full fixed top-0 left-0 z-50">
        <div 
          className="h-full bg-[#D4AF37] transition-all duration-500 ease-out" 
          style={{ width: `${(currentSlide / TOTAL_SLIDES) * 100}%` }}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative w-full h-full max-w-[1400px] mx-auto">
        <AnimatePresence mode="wait">
          
          {/* SLIDE 1 - Capa */}
          {currentSlide === 1 && (
            <SlideWrapper>
              <div className="mb-8">
                <PetronLogo iconOnly className="w-32 h-32 mx-auto mb-6" />
                <h1 className="text-4xl font-bold tracking-widest text-[#D4AF37] mb-2">PETRON RADAR</h1>
              </div>
              <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 max-w-4xl leading-tight">
                Plataforma de Inteligência em Petróleo, Óleo & Gás
              </h2>
              <div className="flex items-center gap-4 text-white/50 text-xl font-medium tracking-wide">
                <span>Maio 2026</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 text-sm px-3 py-1 uppercase tracking-widest">
                  Versão Comercial Beta
                </Badge>
              </div>
            </SlideWrapper>
          )}

          {/* SLIDE 2 - O Problema */}
          {currentSlide === 2 && (
            <SlideWrapper>
              <h2 className="text-4xl md:text-5xl font-bold mb-16 max-w-4xl leading-tight text-white/90">
                O mercado de O&G é cheio de oportunidade — <span className="text-[#D4AF37]">e quase ninguém enxerga a tempo</span>
              </h2>
              
              <div className="grid grid-cols-3 gap-8 w-full max-w-5xl">
                <div className="bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col items-center">
                  <AlertTriangle className="w-16 h-16 text-red-500/80 mb-6" />
                  <h3 className="text-xl font-bold mb-4">Oportunidades Perdidas</h3>
                  <p className="text-white/60 text-lg leading-relaxed">Falta de informação oportuna e monitoramento ineficiente de editais.</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col items-center">
                  <FileSearch className="w-16 h-16 text-orange-500/80 mb-6" />
                  <h3 className="text-xl font-bold mb-4">Licitações Complexas</h3>
                  <p className="text-white/60 text-lg leading-relaxed">Concorrência às cegas, sem inteligência sobre valores e concorrentes.</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col items-center">
                  <Network className="w-16 h-16 text-blue-500/80 mb-6" />
                  <h3 className="text-xl font-bold mb-4">Gestão Fragmentada</h3>
                  <p className="text-white/60 text-lg leading-relaxed">Relacionamentos perdidos em planilhas sem um CRM focado em O&G.</p>
                </div>
              </div>
            </SlideWrapper>
          )}

          {/* SLIDE 3 - A Solução */}
          {currentSlide === 3 && (
            <SlideWrapper>
              <h2 className="text-5xl font-extrabold mb-4 text-white">Petron Radar</h2>
              <p className="text-2xl text-[#D4AF37] mb-16 font-light tracking-wide">Seu radar de mercado no setor de energia</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-6xl">
                {[
                  { title: "Radar", desc: "Monitoramento contínuo", icon: Radar },
                  { title: "Boletins", desc: "Inteligência analítica", icon: Newspaper },
                  { title: "Gestão", desc: "CRM Especializado", icon: Users },
                  { title: "Petroconnect", desc: "Integração direta", icon: Plug }
                ].map((item, i) => (
                  <div key={i} className="bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-8 rounded-2xl text-left">
                    <item.icon className="w-12 h-12 text-[#D4AF37] mb-6" />
                    <h3 className="text-2xl font-bold mb-2">{item.title}</h3>
                    <p className="text-white/60 text-lg">{item.desc}</p>
                  </div>
                ))}
              </div>
            </SlideWrapper>
          )}

          {/* SLIDE 4 - Como Funciona */}
          {currentSlide === 4 && (
            <SlideWrapper>
              <h2 className="text-4xl font-bold mb-16 text-white">O Fluxo de Inteligência</h2>
              
              <div className="flex items-center justify-center gap-4 md:gap-8 w-full max-w-5xl">
                <div className="flex-1 bg-white/5 rounded-2xl p-8 border border-white/10">
                  <h3 className="text-2xl font-bold mb-2 text-white/50">MERCADO</h3>
                  <p className="text-white/40">Editais, Contratos, Concorrentes</p>
                </div>
                
                <div className="w-16 h-1 bg-gradient-to-r from-white/10 to-[#D4AF37] relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 border-t-2 border-r-2 border-[#D4AF37]" />
                </div>
                
                <div className="flex-[1.5] bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-2xl p-10 border border-[#D4AF37]/50 shadow-[0_0_40px_rgba(212,175,55,0.1)]">
                  <Radar className="w-12 h-12 text-[#D4AF37] mx-auto mb-4" />
                  <h3 className="text-3xl font-bold mb-2 text-[#D4AF37]">PETRON RADAR</h3>
                  <p className="text-white/80">Captura, Análise e Alertas</p>
                </div>

                <div className="w-16 h-1 bg-gradient-to-r from-[#D4AF37] to-white/10 relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 border-t-2 border-r-2 border-white/30" />
                </div>
                
                <div className="flex-1 bg-white/5 rounded-2xl p-8 border border-white/10">
                  <h3 className="text-2xl font-bold mb-2 text-white">SUA EMPRESA</h3>
                  <p className="text-white/60">Ação Rápida e Decisão</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-16 max-w-4xl text-left w-full">
                <div className="text-white/60"><span className="text-[#D4AF37] font-bold block mb-1">01. Configuração</span>Defina seu perfil e filtros.</div>
                <div className="text-white/60"><span className="text-[#D4AF37] font-bold block mb-1">02. Monitoramento</span>A IA rastreia o mercado.</div>
                <div className="text-white/60"><span className="text-[#D4AF37] font-bold block mb-1">03. Análise</span>Curadoria e relatórios.</div>
                <div className="text-white/60"><span className="text-[#D4AF37] font-bold block mb-1">04. Gestão</span>CRM e pipeline visual.</div>
              </div>
            </SlideWrapper>
          )}

          {/* SLIDE 5 - Planos e Preços */}
          {currentSlide === 5 && (
            <SlideWrapper>
              <h2 className="text-4xl font-bold mb-12 text-white">Planos Comerciais</h2>
              
              <div className="grid grid-cols-4 gap-4 w-full max-w-6xl">
                {[
                  { name: "Starter", price: "R$ 497", desc: "Boletins Semanais", f1: "Oportunidades Básicas", f2: "S/ CRM", f3: "S/ Petroconnect", highlight: false },
                  { name: "Professional", price: "R$ 1.297", desc: "Radar de Licitações", f1: "Radar em Tempo Real", f2: "CRM Básico", f3: "Alertas E-mail", highlight: false },
                  { name: "Enterprise", price: "R$ 2.997", desc: "Gestão Completa", f1: "Radar Avançado", f2: "CRM Completo", f3: "Petroconnect Nativo", highlight: true },
                  { name: "IA Managed", price: "Custom", desc: "Inteligência Dedicada", f1: "Analista Dedicado", f2: "Relatórios Custom", f3: "Sincronização Total", highlight: false }
                ].map((plan, i) => (
                  <div key={i} className={`flex flex-col text-left rounded-xl overflow-hidden border ${plan.highlight ? 'border-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.15)] scale-105 z-10' : 'border-white/10 bg-white/5'}`}>
                    {plan.highlight && (
                      <div className="bg-[#D4AF37] text-black text-xs font-bold text-center py-1.5 tracking-widest uppercase">Mais Escolhido</div>
                    )}
                    <div className={`p-6 ${plan.highlight ? 'bg-[#D4AF37]/10' : ''}`}>
                      <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                      <p className="text-white/50 text-sm mb-4">{plan.desc}</p>
                      <div className="text-3xl font-extrabold mb-2">{plan.price}</div>
                    </div>
                    <div className="p-6 bg-black/40 flex-1 flex flex-col gap-3 text-sm text-white/70">
                      <div className="flex items-center gap-2"><CheckCircle2 className={`w-4 h-4 ${plan.highlight ? 'text-[#D4AF37]' : 'text-white/30'}`} /> {plan.f1}</div>
                      <div className="flex items-center gap-2"><CheckCircle2 className={`w-4 h-4 ${plan.highlight ? 'text-[#D4AF37]' : 'text-white/30'}`} /> {plan.f2}</div>
                      <div className="flex items-center gap-2"><CheckCircle2 className={`w-4 h-4 ${plan.highlight ? 'text-[#D4AF37]' : 'text-white/30'}`} /> {plan.f3}</div>
                    </div>
                  </div>
                ))}
              </div>
            </SlideWrapper>
          )}

          {/* SLIDE 6 - Cases Beta */}
          {currentSlide === 6 && (
            <SlideWrapper>
              <h2 className="text-4xl font-bold mb-12 text-white">Tração Validada: Clientes Beta</h2>
              
              <div className="grid grid-cols-2 gap-8 w-full max-w-5xl">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full -z-10" />
                  <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30 mb-6 font-bold tracking-widest">BETA 01</Badge>
                  <h3 className="text-3xl font-bold mb-2">Tavares Engenharia</h3>
                  <p className="text-white/50 mb-8">Engenharia & Obras / O&G</p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-white/60">Status</span>
                      <span className="text-green-400 font-medium">Cliente Fechado</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-white/60">Cadastro Petrobras</span>
                      <span className="text-[#D4AF37] flex items-center gap-2 font-medium">
                        <ShieldCheck className="w-4 h-4" /> Ativo
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full -z-10" />
                  <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30 mb-6 font-bold tracking-widest">BETA 02</Badge>
                  <h3 className="text-3xl font-bold mb-2">Pavanelli Tech</h3>
                  <p className="text-white/50 mb-8">TI / Tecnologia / Integração</p>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-white/60">Status</span>
                      <span className="text-green-400 font-medium">Cliente Fechado</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-white/60">Cadastro Petrobras</span>
                      <span className="text-[#D4AF37] flex items-center gap-2 font-medium">
                        <ShieldCheck className="w-4 h-4" /> Ativo
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </SlideWrapper>
          )}

          {/* SLIDE 7 - Próximos Passos */}
          {currentSlide === 7 && (
            <SlideWrapper>
              <h2 className="text-5xl font-extrabold mb-16 text-white">Comece Hoje</h2>
              
              <div className="flex gap-12 w-full max-w-4xl text-left mb-16">
                <div className="flex-1 relative">
                  <div className="text-6xl font-extrabold text-white/10 absolute -top-8 -left-4 -z-10">1</div>
                  <h3 className="text-2xl font-bold mb-2 text-[#D4AF37]">Escolha o plano</h3>
                  <p className="text-white/60">Defina o nível de inteligência ideal para o seu negócio.</p>
                </div>
                <div className="flex-1 relative">
                  <div className="text-6xl font-extrabold text-white/10 absolute -top-8 -left-4 -z-10">2</div>
                  <h3 className="text-2xl font-bold mb-2 text-[#D4AF37]">Onboarding</h3>
                  <p className="text-white/60">Nossa equipe configura seu radar e filtros estratégicos.</p>
                </div>
                <div className="flex-1 relative">
                  <div className="text-6xl font-extrabold text-white/10 absolute -top-8 -left-4 -z-10">3</div>
                  <h3 className="text-2xl font-bold mb-2 text-[#D4AF37]">Resultados</h3>
                  <p className="text-white/60">Receba a primeira oportunidade validada em dias.</p>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <Button onClick={() => setLocation("/planos")} className="bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 text-xl font-bold px-12 py-8 rounded-full shadow-[0_0_30px_rgba(212,175,55,0.3)] mb-8">
                  Assinar Agora
                </Button>
                
                <div className="flex items-center gap-8 text-white/50 font-medium tracking-wide">
                  <span className="flex items-center gap-2"><span className="text-[#D4AF37]">WA:</span> +55 11 99999-9999</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                  <span className="flex items-center gap-2"><span className="text-[#D4AF37]">E:</span> comercial@petronradar.com</span>
                </div>
              </div>
            </SlideWrapper>
          )}

        </AnimatePresence>
      </div>

      {/* Footer Controls */}
      <div className="h-20 border-t border-white/10 bg-black/50 backdrop-blur-sm flex items-center justify-between px-8 relative z-50">
        <div className="flex items-center gap-4 text-white/40">
          <Presentation className="w-5 h-5" />
          <span className="font-medium tracking-widest text-sm uppercase">PETRON RADAR — CONFIDENCIAL</span>
        </div>
        
        <div className="flex items-center gap-6">
          <Button 
            variant="ghost" 
            onClick={prevSlide}
            disabled={currentSlide === 1}
            className="text-white hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="w-5 h-5 mr-1" /> Anterior
          </Button>
          
          <div className="bg-white/10 rounded-full px-4 py-1.5 font-mono text-sm tracking-widest text-white/80">
            {currentSlide} <span className="text-white/30">/</span> {TOTAL_SLIDES}
          </div>
          
          <Button 
            variant="ghost" 
            onClick={nextSlide}
            disabled={currentSlide === TOTAL_SLIDES}
            className="text-white hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          >
            Próximo <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
