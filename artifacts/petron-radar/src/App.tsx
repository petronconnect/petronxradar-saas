import { Switch, Route, Router as WouterRouter, useLocation, useSearch, Redirect } from "wouter";
import { safeDestination, loginPathFor } from "@/lib/safeDestination";
import CadastroPage from "@/pages/CadastroPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Opportunities from "@/pages/Opportunities";
import Bulletins from "@/pages/Bulletins";
import Clients from "@/pages/Clients";
import Plans from "@/pages/Plans";
import InquiriesPage from "@/pages/InquiriesPage";
import PetroconnectPage from "@/pages/PetroconnectPage";
import BetaClientsPage from "@/pages/BetaClientsPage";
import LandingPage from "@/pages/LandingPage";
import ExecutivePresentationPage from "@/pages/ExecutivePresentationPage";
import KitComercialPage from "@/pages/KitComercialPage";
import CheckoutPage from "@/pages/CheckoutPage";
import VendedorPage from "@/pages/VendedorPage";
import CentralAquisicaoPage from "@/pages/CentralAquisicaoPage";
import PetronPayPage from "@/pages/PetronPayPage";
import ProximasAplicacoesPage from "@/pages/ProximasAplicacoesPage";
import BoletimPadraoPage from "@/pages/BoletimPadraoPage";
import LoginPage from "@/pages/LoginPage";
import TermosPage from "@/pages/TermosPage";
import PrivacidadePage from "@/pages/PrivacidadePage";
import EmpresasPage from "@/pages/EmpresasPage";
import MinhaAssinaturaPage from "@/pages/MinhaAssinaturaPage";
import MeuPortfolioPage from "@/pages/MeuPortfolioPage";
import MeuPerfilPage from "@/pages/MeuPerfilPage";
import AppDistribuicaoPage from "@/pages/AppDistribuicaoPage";
import NotificationsPage from "@/pages/NotificationsPage";
import { WelcomeOnboarding } from "@/components/onboarding/WelcomeOnboarding";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import Radar360Page from "@/pages/Radar360Page";

const queryClient = new QueryClient();

function LayoutRoute({ component: Component }: { component: any }) {
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  const search = useSearch();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const PUBLIC_PATHS = ["/login", "/landing", "/apresentacao", "/checkout", "/termos", "/privacidade", "/cadastro"];
  const isPublic = PUBLIC_PATHS.some(p => location === p || location.startsWith(p + "/"));

  if (!user && !isPublic) {
    return <Redirect to={loginPathFor(location + (search ? `?${search}` : ""))} replace />;
  }
  if (user && location === "/login") {
    const next = safeDestination(new URLSearchParams(search).get("next"));
    return <Redirect to={next ?? "/"} replace />;
  }

  const isClientRole =
    user?.role === "CLIENTE_ADMIN" || user?.role === "USUARIO_CLIENTE";
  const showOnboarding =
    !!user &&
    !isPublic &&
    (!!user.mustSetPassword || (isClientRole && !user.onboardingCompleted));

  return (
    <>
      <Switch>
        {/* Public routes without layout */}
      <Route path="/login" component={LoginPage} />
      <Route path="/landing" component={LandingPage} />
      <Route path="/apresentacao" component={ExecutivePresentationPage} />
      <Route path="/checkout/:plano" component={CheckoutPage} />
      <Route path="/cadastro" component={CadastroPage} />
      <Route path="/termos" component={TermosPage} />
      <Route path="/privacidade" component={PrivacidadePage} />

      {/* Routes with layout */}
      <Route path="/">
        <LayoutRoute component={Dashboard} />
      </Route>
      <Route path="/oportunidades">
        <LayoutRoute component={Opportunities} />
      </Route>
      <Route path="/boletins">
        <LayoutRoute component={Bulletins} />
      </Route>
      <Route path="/clientes">
        <LayoutRoute component={Clients} />
      </Route>
      <Route path="/planos">
        <LayoutRoute component={Plans} />
      </Route>
      <Route path="/inquiries">
        <LayoutRoute component={InquiriesPage} />
      </Route>
      <Route path="/petroconnect">
        <LayoutRoute component={PetroconnectPage} />
      </Route>
      <Route path="/clientes-beta">
        <LayoutRoute component={BetaClientsPage} />
      </Route>
      <Route path="/aquisicao">
        <LayoutRoute component={CentralAquisicaoPage} />
      </Route>
      <Route path="/boletim-padrao">
        <LayoutRoute component={BoletimPadraoPage} />
      </Route>
      <Route path="/proximas-aplicacoes">
        <LayoutRoute component={ProximasAplicacoesPage} />
      </Route>
      <Route path="/petron-pay">
        <LayoutRoute component={PetronPayPage} />
      </Route>
      <Route path="/kit-comercial">
        <LayoutRoute component={KitComercialPage} />
      </Route>
      <Route path="/vendedor">
        <LayoutRoute component={VendedorPage} />
      </Route>
      <Route path="/empresas">
        <LayoutRoute component={EmpresasPage} />
      </Route>
      <Route path="/minha-assinatura">
        <LayoutRoute component={MinhaAssinaturaPage} />
      </Route>
      <Route path="/meu-perfil">
        <LayoutRoute component={MeuPerfilPage} />
      </Route>
      <Route path="/notificacoes">
        <LayoutRoute component={NotificationsPage} />
      </Route>
      <Route path="/meu-portfolio">
          <LayoutRoute component={MeuPortfolioPage} />
        </Route>
        <Route path="/radar-360">
          <LayoutRoute component={Radar360Page} />
        </Route>
        <Route path="/distribuicao">
          <LayoutRoute component={AppDistribuicaoPage} />
        </Route>

        {/* Fallback */}
        <Route>
          <LayoutRoute component={NotFound} />
        </Route>
      </Switch>
      {showOnboarding && <WelcomeOnboarding />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
