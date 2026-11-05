import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { safeDestination, googleStartUrl, authErrorMessage } from "@/lib/safeDestination";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PetronLogo } from "@/components/layout/PetronLogo";
import { Loader2, Lock, Mail, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const search = useSearch();
  const params = new URLSearchParams(search);
  const nextDest = safeDestination(params.get("next"));
  const [authError] = useState(() => authErrorMessage(params.get("authError")));
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);
  const [googleRedirecting, setGoogleRedirecting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${BASE}/api/auth/options`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { googleAvailable: false }))
      .then((d: { googleAvailable?: boolean }) => { if (alive) setGoogleAvailable(!!d.googleAvailable); })
      .catch(() => { if (alive) setGoogleAvailable(false); });
    return () => { alive = false; };
  }, [BASE]);

  function startGoogle() {
    setGoogleRedirecting(true);
    window.location.assign(googleStartUrl("login", nextDest));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(nextDest ?? "/", { replace: true });
    } catch (err: any) {
      setError(err.message ?? "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();
    setRecoveryError("");
    setTemporaryPassword("");
    setRecoveryLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/admin/recover`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${recoveryToken}`,
        },
        body: "{}",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Não foi possível recuperar o acesso.");
      }
      if (typeof body.temporaryPassword !== "string") {
        throw new Error("A resposta da recuperação está incompleta.");
      }
      setTemporaryPassword(body.temporaryPassword);
      setRecoveryToken("");
    } catch (err: any) {
      setRecoveryError(err.message ?? "Não foi possível recuperar o acesso.");
      setRecoveryToken("");
    } finally {
      setRecoveryLoading(false);
    }
  }

  function returnToLogin() {
    if (temporaryPassword) setPassword(temporaryPassword);
    setTemporaryPassword("");
    setRecoveryError("");
    setShowRecovery(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-sidebar via-background to-background pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-5 pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <PetronLogo />
          </div>
          <p className="text-muted-foreground text-sm mt-2">
            Inteligência em Petróleo, Óleo & Gás
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8">
          {showRecovery ? (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-foreground">Recuperar acesso administrativo</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Use o código temporário configurado pelo responsável da plataforma. Esta opção recupera somente a conta ADMIN_PETRON.
                </p>
              </div>

              {temporaryPassword ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Senha temporária gerada. Ela será exibida apenas nesta tela; entre com a conta administrativa e troque-a no primeiro acesso.
                  </p>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-sm break-all select-all" aria-label="Senha temporária">
                    {temporaryPassword}
                  </div>
                  <Button type="button" onClick={returnToLogin} className="w-full">
                    Voltar ao login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleRecovery} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="recovery-token" className="text-sm font-medium">
                      Código temporário
                    </Label>
                    <Input
                      id="recovery-token"
                      type="password"
                      value={recoveryToken}
                      onChange={(e) => setRecoveryToken(e.target.value)}
                      autoComplete="off"
                      required
                    />
                  </div>

                  {recoveryError && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{recoveryError}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={recoveryLoading || !recoveryToken}>
                    {recoveryLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando senha...</>
                    ) : "Gerar senha temporária"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowRecovery(false)} className="w-full">
                    Cancelar
                  </Button>
                </form>
              )}
            </>
          ) : (
            <>
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">Acesso à Plataforma</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Entre com suas credenciais para continuar
            </p>
          </div>

          {authError && (
            <div className="mb-5 flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5" data-testid="status-auth-error">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {googleAvailable === null ? (
            <div className="h-11 rounded-md bg-muted/40 animate-pulse mb-5" aria-label="Carregando opções de acesso" />
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 font-semibold border-border"
                onClick={startGoogle}
                disabled={!googleAvailable || googleRedirecting}
                data-testid="button-google-login"
              >
                {googleRedirecting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecionando para o Google...</>
                ) : (
                  <><GoogleMark />Entrar com Google</>
                )}
              </Button>
              {!googleAvailable && (
                <p className="mt-2 text-xs text-muted-foreground text-center" data-testid="text-google-unavailable">
                  O login com Google está indisponível: a integração ainda não foi configurada nesta plataforma. Use e-mail e senha.
                </p>
              )}
              <div className="flex items-center gap-3 my-5 text-[11px] uppercase tracking-widest text-muted-foreground/70">
                <span className="h-px flex-1 bg-border" />ou com e-mail<span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                E-mail Corporativo
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Entrando...</>
              ) : "Entrar na Plataforma"}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-border space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Ainda não é cliente?{" "}
              <Link href="/cadastro" className="text-primary font-semibold hover:underline underline-offset-4" data-testid="link-cadastro">
                Cadastre sua empresa
              </Link>
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Esqueceu sua senha? Entre em contato com o suporte Petron Radar
            </p>
            <button
              type="button"
              onClick={() => { setError(""); setShowRecovery(true); }}
              className="block mx-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Recuperar acesso administrativo
            </button>
            <p className="text-xs text-muted-foreground/70 text-center">
              <a href="/termos" className="hover:text-foreground">Termos de Uso</a>
              <span className="mx-2">·</span>
              <a href="/privacidade" className="hover:text-foreground">Política de Privacidade</a>
            </p>
          </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          © {new Date().getFullYear()} Petron Radar. Acesso restrito a clientes cadastrados.
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="h-4 w-4 mr-2" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
