import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Bell, Menu, Search, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListNotifications, useSearchDashboard, getSearchDashboardQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { isAdmin } = useAuth();
  const { data: searchResults, isFetching: searching } = useSearchDashboard(
    { q: query.trim() },
    { query: { enabled: query.trim().length >= 2, queryKey: getSearchDashboardQueryKey({ q: query.trim() }) } },
  );
  const { data: notifications } = useListNotifications();
  const results = (searchResults ?? []).filter((item) => item.type !== "client" || isAdmin);
  const resultHref = (type: string, title: string) => {
    const path = type === "opportunity" ? "/oportunidades" : type === "bulletin" ? "/boletins" : "/clientes";
    return `${path}?q=${encodeURIComponent(title)}`;
  };

  // Close mobile menu on route change
  useEffect(() => {
    const handleLocationChange = () => setMobileMenuOpen(false);
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground overflow-hidden selection:bg-primary/20 selection:text-primary">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar className="h-full" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-[100dvh] overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-3 backdrop-blur md:h-16 md:px-6">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} className="md:hidden" aria-label="Abrir menu" data-testid="button-open-mobile-menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="shrink-0 font-bold tracking-wider text-xs sm:text-sm md:hidden">PETRON <span className="text-primary">RADAR</span></div>
          <div className="relative mx-auto w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-foreground/60" />
            <Input
              type="search"
              value={query}
              placeholder="Buscar oportunidades, boletins..."
              aria-label="Buscar no Radar"
              data-testid="input-global-search"
              className="h-9 border-border bg-background pl-9 pr-9 text-sm placeholder:text-foreground/55"
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
              onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }}
            />
            {query && <button type="button" onClick={() => { setQuery(""); setSearchOpen(false); }} aria-label="Limpar busca" className="absolute right-2 top-2 rounded p-0.5 text-foreground/65 hover:text-foreground" data-testid="button-clear-global-search"><X className="h-4 w-4" /></button>}
            {searchOpen && query.trim().length >= 2 && <div className="absolute left-0 right-0 top-11 z-50 max-h-[min(70vh,28rem)] overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-xl" data-testid="panel-global-search-results">
              {searching ? <p className="px-3 py-4 text-sm text-foreground/70">Buscando no radar...</p> : results.length === 0 ? <p className="px-3 py-4 text-sm text-foreground/70">Nenhum resultado autorizado encontrado.</p> : (["opportunity", "bulletin", "client"] as const).map(type => {
                const group = results.filter(result => result.type === type);
                if (!group.length) return null;
                const label = type === "opportunity" ? "Oportunidades" : type === "bulletin" ? "Boletins" : "Registros comerciais";
                return <section key={type} className="mb-1 last:mb-0"><p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/60">{label}</p>
                  {group.map(result => <Link key={`${type}-${result.id}`} href={resultHref(type, result.title)} onClick={() => { setSearchOpen(false); setQuery(""); }} className="block rounded-md px-3 py-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid={`link-search-result-${type}-${result.id}`}>
                    <span className="block truncate text-sm font-medium text-foreground">{result.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-foreground/65">{result.subtitle}</span>
                  </Link>)}
                </section>;
              })}
            </div>}
          </div>
          {searchOpen && <button className="fixed inset-0 z-20 cursor-default" aria-label="Fechar resultados da busca" onClick={() => setSearchOpen(false)} />}
          <Link href="/notificacoes" aria-label={`Notificações${(notifications?.unreadCount ?? 0) ? `, ${notifications?.unreadCount} não lidas` : ""}`} data-testid="link-header-notifications" className="relative z-30 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-foreground/75 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Bell className="h-4 w-4" />
            {!!notifications?.unreadCount && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{notifications.unreadCount > 99 ? "99+" : notifications.unreadCount}</span>}
          </Link>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
