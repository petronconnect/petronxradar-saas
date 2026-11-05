import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Target, FileText, Users, CreditCard,
  ChevronLeft, ChevronRight, ClipboardList, Plug, FlaskConical,
  MonitorPlay, Megaphone, Briefcase, ShoppingCart, Rocket,
  Wallet, ListChecks, Building2, Star, LogOut, ChevronDown, Briefcase as BriefcaseIcon,
  Smartphone, UserCog, Bell, Radar,
} from "lucide-react";
import { useListNotifications } from "@workspace/api-client-react";
import { InstallButton } from "@/components/pwa/InstallButton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PetronLogo } from "./PetronLogo";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Oportunidades", href: "/oportunidades", icon: Target },
  { name: "Radar 360", href: "/radar-360", icon: Radar },
  { name: "Meu Portfólio", href: "/meu-portfolio", icon: BriefcaseIcon },
  { name: "Notificações", href: "/notificacoes", icon: Bell },
  { name: "Boletins", href: "/boletins", icon: FileText },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Planos", href: "/planos", icon: CreditCard },
];

const ADMIN_INTERNAL = [
  { name: "Empresas", href: "/empresas", icon: Building2 },
  { name: "Inquiries", href: "/inquiries", icon: ClipboardList },
  { name: "Petroconnect", href: "/petroconnect", icon: Plug },
  { name: "Clientes Beta", href: "/clientes-beta", icon: FlaskConical },
  { name: "Distribuição do App", href: "/distribuicao", icon: Smartphone },
];

const ADMIN_COMERCIAL = [
  { name: "Boletim Padrão", href: "/boletim-padrao", icon: FileText },
  { name: "Próximas Aplicações", href: "/proximas-aplicacoes", icon: ListChecks },
  { name: "Aquisição", href: "/aquisicao", icon: Rocket },
  { name: "Petron Pay", href: "/petron-pay", icon: Wallet },
  { name: "Kit Comercial", href: "/kit-comercial", icon: Briefcase },
  { name: "Modo Vendedor", href: "/vendedor", icon: ShoppingCart },
  { name: "Apresentação", href: "/apresentacao", icon: MonitorPlay },
  { name: "Landing", href: "/landing", icon: Megaphone },
];

const CLIENT_MARKET = [
  { name: "Visão geral", href: "/", icon: LayoutDashboard },
  { name: "Oportunidades", href: "/oportunidades", icon: Target },
  { name: "Radar 360", href: "/radar-360", icon: Radar },
  { name: "Meu Portfólio", href: "/meu-portfolio", icon: BriefcaseIcon },
  { name: "Boletins", href: "/boletins", icon: FileText },
  { name: "Notificações", href: "/notificacoes", icon: Bell },
];

const ACCOUNT_ITEMS = [
  { name: "Minha Assinatura", href: "/minha-assinatura", icon: Star },
  { name: "Meu Perfil", href: "/meu-perfil", icon: UserCog },
];
const CLIENT_GESTION = [
  { name: "Planos", href: "/planos", icon: CreditCard },
];

interface NavGroup { label: string; items: typeof ADMIN_ITEMS }

export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const { data: notificationData } = useListNotifications();
  const unreadCount = notificationData?.unreadCount ?? 0;

  const groups: NavGroup[] = isAdmin
    ? [
        { label: "Mercado", items: ADMIN_ITEMS.slice(0, 6) },
        { label: "Gestão", items: [ADMIN_ITEMS[6]!, ADMIN_ITEMS[7]!] },
        { label: "Ferramentas", items: ADMIN_COMERCIAL },
        { label: "Operação interna", items: ADMIN_INTERNAL },
        { label: "Minha conta", items: ACCOUNT_ITEMS },
      ]
    : [
        { label: "Mercado", items: CLIENT_MARKET },
        { label: "Gestão", items: CLIENT_GESTION },
        { label: "Minha conta", items: ACCOUNT_ITEMS },
      ];

  const { toast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      toast({
        title: "Não foi possível sair",
        description: err instanceof Error && err.message ? `${err.message}. Sua sessão continua ativa; tente novamente.` : "Sua sessão continua ativa; tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoggingOut(false);
    }
  }

  const roleLabel = user?.role === "ADMIN_PETRON"
    ? "Admin Petron" : user?.role === "CLIENTE_ADMIN"
    ? "Admin Cliente" : "Usuário";

  return (
    <div
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 z-20",
        collapsed ? "w-20" : "w-64",
        className
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && <PetronLogo />}
        {collapsed && (
          <div className="mx-auto">
            <PetronLogo iconOnly />
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 overflow-y-auto scrollbar-none space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className={`text-[10px] font-semibold uppercase tracking-widest px-3 mb-1.5 ${group.label === "Operação interna" ? "text-primary/90" : "text-foreground/65"}`}>
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    aria-label={item.name === "Notificações" && unreadCount > 0
                      ? `${item.name}, ${unreadCount} não lidas`
                      : item.name}
                    title={collapsed ? item.name : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      collapsed ? "justify-center px-0" : ""
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-sidebar-primary rounded-r-full" />
                    )}
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        isActive
                          ? "text-sidebar-primary"
                          : "text-muted-foreground group-hover:text-sidebar-foreground"
                      )}
                    />
                    {!collapsed && <span>{item.name}</span>}
                    {item.name === "Notificações" && unreadCount > 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-5 text-primary-foreground",
                          collapsed && "absolute -right-1 -top-1 min-w-5 px-1",
                          !collapsed && "ml-auto min-w-5",
                        )}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User info / logout */}
      <div className="p-3 border-t border-sidebar-border mt-auto">
        {!collapsed ? (
          <>
            {user && !isAdmin && (
              <div className="mb-2">
                <InstallButton
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-sidebar-border"
                />
              </div>
            )}
            {user && (
              <p className="mb-1 truncate px-3 text-[10px] text-foreground/65" title={user.companyName} data-testid="text-sidebar-company">{user.companyName}</p>
            )}
            {user && (
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-full flex items-center gap-2 rounded-md px-3 py-2 hover:bg-sidebar-accent/50 transition-colors text-left"
                data-testid="button-user-menu"
                aria-expanded={userMenuOpen}
                aria-label={`Menu do usuário ${user.nome}`}
              >
                <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {user.nome.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{user.nome}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{roleLabel}</p>
                </div>
                <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", userMenuOpen && "rotate-180")} />
              </button>
            )}
            {userMenuOpen && (
              <div className="mt-1 bg-sidebar-accent/30 rounded-md overflow-hidden">
                <Link
                  href="/meu-perfil"
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
                >
                  <UserCog className="h-3.5 w-3.5" />
                  Meu Perfil
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair da conta
                </button>
              </div>
            )}
            {!user && (
              <div className="bg-sidebar-accent/50 rounded-lg p-3">
                <Link href="/planos" className="w-full inline-block">
                  <Button
                    variant="outline"
                    className="w-full h-8 text-xs border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-primary transition-colors"
                  >
                    Fazer Upgrade
                  </Button>
                </Link>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={handleLogout}
            title="Sair"
            className="flex justify-center w-full p-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground hover:text-foreground hover:border-sidebar-primary transition-colors z-50"
        aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        data-testid="button-toggle-sidebar"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
