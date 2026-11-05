import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { googleStartUrl } from "@/lib/safeDestination";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User, Mail, Phone, MessageCircle, Building2, Loader2, Save,
  Lock, ShieldAlert, MapPin, Briefcase, BadgeCheck, Link2, KeyRound,
} from "lucide-react";

interface ProfileData {
  nome: string;
  email: string;
  role: string;
  hasPassword?: boolean;
  googleLinked?: boolean;
  recentAuthentication?: boolean;
  company: {
    id: number;
    razaoSocial: string;
    nomeFantasia: string;
    cnpj: string;
    cidade: string;
    estado: string;
    email: string;
    telefone: string | null;
    whatsapp: string | null;
    segmento: string;
  };
}

export default function MeuPerfilPage() {
  const { refreshUser, login, user } = useAuth();
  const [linkPassword, setLinkPassword] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [reauthing, setReauthing] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  useEffect(() => {
    apiFetch("/api/auth/options")
      .then((d) => setGoogleAvailable(!!(d as { googleAvailable?: boolean }).googleAvailable))
      .catch(() => setGoogleAvailable(false));
  }, []);
  const { toast } = useToast();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable form fields
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  function hydrate(p: ProfileData) {
    setProfile(p);
    setNome(p.nome ?? "");
    setEmail(p.email ?? "");
    setTelefone(p.company.telefone ?? "");
    setWhatsapp(p.company.whatsapp ?? "");
    setCurrentPassword("");
  }

  useEffect(() => {
    apiFetch("/api/auth/profile")
      .then((data) => hydrate(data as ProfileData))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  const emailChanged = useMemo(
    () => !!profile && email.trim().toLowerCase() !== profile.email.toLowerCase(),
    [email, profile],
  );

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return (
      nome.trim() !== (profile.nome ?? "") ||
      emailChanged ||
      telefone.trim() !== (profile.company.telefone ?? "") ||
      whatsapp.trim() !== (profile.company.whatsapp ?? "")
    );
  }, [nome, telefone, whatsapp, emailChanged, profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !hasChanges) return;

    if (!nome.trim()) {
      toast({ title: "Informe seu nome", variant: "destructive" });
      return;
    }
    const localUser = profile.hasPassword !== false;
    if (emailChanged && !localUser && !profile.recentAuthentication) {
      toast({
        title: "Confirme sua identidade",
        description: "Para trocar o e-mail, confirme novamente com o Google.",
        variant: "destructive",
      });
      return;
    }
    if (emailChanged && localUser && !currentPassword) {
      toast({
        title: "Confirme sua senha",
        description: "Para trocar o e-mail de acesso, digite sua senha atual.",
        variant: "destructive",
      });
      return;
    }

    const body: Record<string, string> = {
      nome: nome.trim(),
      email: email.trim(),
      telefone: telefone.trim(),
      whatsapp: whatsapp.trim(),
    };
    if (emailChanged && localUser) body.currentPassword = currentPassword;

    setSaving(true);
    try {
      await apiFetch("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await refreshUser();
      const fresh = (await apiFetch("/api/auth/profile")) as ProfileData;
      hydrate(fresh);
      toast({
        title: "Dados atualizados",
        description: emailChanged
          ? "Seu e-mail de acesso foi alterado. Use o novo e-mail no próximo login."
          : "Suas informações foram salvas com sucesso.",
      });
    } catch (err) {
      toast({
        title: "Não foi possível salvar",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function goGoogle(purpose: "link" | "reauth") {
    window.location.assign(googleStartUrl(purpose, "/meu-perfil"));
  }

  async function handleLinkGoogle(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setLinkError(null);
    if (profile.recentAuthentication) {
      setLinking(true);
      goGoogle("link");
      return;
    }
    if (!linkPassword) {
      setLinkError("Digite sua senha atual para confirmar sua identidade.");
      return;
    }
    setLinking(true);
    try {
      await login(user?.email ?? profile.email, linkPassword);
      setLinkPassword("");
      goGoogle("link");
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Senha incorreta.");
      setLinking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <User className="h-8 w-8 mx-auto mb-2 opacity-20" />
        <p className="text-sm">Não foi possível carregar seu perfil.</p>
      </div>
    );
  }

  const c = profile.company;

  return (
    <div className="space-y-6 pb-10 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Atualize seus dados de contato e o e-mail de acesso à plataforma
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Editable contact data */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Meus Dados</CardTitle>
            </div>
            <CardDescription>Estas informações você pode editar a qualquer momento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nome" className="flex items-center gap-1.5 text-xs">
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> Nome do responsável
                </Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="flex items-center gap-1.5 text-xs">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> E-mail de acesso (login)
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefone" className="flex items-center gap-1.5 text-xs">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Telefone de contato
                </Label>
                <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 0000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp" className="flex items-center gap-1.5 text-xs">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp
                </Label>
                <Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
            </div>

            {emailChanged && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                <div className="flex items-start gap-2 text-amber-500">
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed">
                    Você está alterando o <strong>e-mail de acesso (login)</strong>. A partir do próximo
                    acesso, use <strong>{email.trim()}</strong> para entrar. {profile.hasPassword === false ? "Como sua conta usa o Google, confirme sua identidade com o Google." : "Confirme sua senha atual para continuar."}
                  </p>
                </div>
                {profile.hasPassword === false ? (
                  profile.recentAuthentication ? (
                    <p className="text-xs text-emerald-500 flex items-center gap-1.5" data-testid="status-recent-auth">
                      <BadgeCheck className="h-3.5 w-3.5" /> Identidade confirmada recentemente. Você pode salvar.
                    </p>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!googleAvailable || reauthing}
                      onClick={() => { setReauthing(true); goGoogle("reauth"); }}
                      data-testid="button-google-reauth"
                    >
                      {reauthing ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecionando…</> : "Confirmar com Google"}
                    </Button>
                  )
                ) : null}
                {profile.hasPassword === false && !profile.recentAuthentication && !googleAvailable && (
                  <p className="text-xs text-muted-foreground">Confirmação com Google indisponível: a integração não está configurada. Fale com o suporte Petron para alterar o e-mail.</p>
                )}
                {profile.hasPassword === false ? null : (
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword" className="flex items-center gap-1.5 text-xs">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Senha atual
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={!hasChanges || saving} className="min-w-36">
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</>
                ) : (
                  <><Save className="h-4 w-4" /> Salvar alterações</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Read-only company identity */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Dados da Empresa</CardTitle>
            </div>
            <CardDescription>
              Dados cadastrais (razão social, CNPJ). Para corrigir algo aqui, fale com a equipe Petron.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Razão Social</p>
                <p className="font-medium mt-0.5">{c.razaoSocial}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nome Fantasia</p>
                <p className="font-medium mt-0.5">{c.nomeFantasia}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">CNPJ</p>
                  <p className="font-medium mt-0.5">{c.cnpj}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Localização</p>
                  <p className="font-medium mt-0.5">{c.cidade} / {c.estado}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Segmento</p>
                  <p className="font-medium mt-0.5">{c.segmento}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">E-mail cadastral da empresa</p>
                  <p className="font-medium mt-0.5 truncate">{c.email}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Acesso e segurança</CardTitle>
          </div>
          <CardDescription>Formas de entrar na sua conta Petron Radar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Senha local</span>
            <span className="font-medium" data-testid="text-has-password">{profile.hasPassword === false ? "Não definida" : "Definida"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Conta Google</span>
            <span className={profile.googleLinked ? "font-medium text-emerald-500" : "font-medium"} data-testid="text-google-linked">
              {profile.googleLinked ? "Vinculada" : "Não vinculada"}
            </span>
          </div>
          {!profile.googleLinked && profile.hasPassword !== false && (
            <form onSubmit={handleLinkGoogle} className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                {profile.recentAuthentication
                  ? "Sua identidade foi confirmada recentemente. Continue para escolher a conta Google que deseja vincular."
                  : "Por segurança, confirme sua senha atual antes de vincular uma conta Google."}
              </p>
              {!profile.recentAuthentication && (
                <Input
                  type="password"
                  value={linkPassword}
                  onChange={(e) => { setLinkPassword(e.target.value); setLinkError(null); }}
                  placeholder="Senha atual"
                  autoComplete="current-password"
                  data-testid="input-link-password"
                />
              )}
              {!googleAvailable && (
                <p className="text-xs text-muted-foreground" data-testid="text-google-unavailable">
                  Vinculação com Google indisponível: a integração ainda não foi configurada nesta plataforma.
                </p>
              )}
              {linkError && <p className="text-xs text-destructive" data-testid="status-link-error">{linkError}</p>}
              <Button type="submit" variant="outline" disabled={!googleAvailable || linking} data-testid="button-link-google">
                {linking ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirmando…</> : <><Link2 className="h-4 w-4" /> Vincular conta Google</>}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
