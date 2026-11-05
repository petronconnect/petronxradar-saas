import { useMarkAllNotificationsRead, useMarkNotificationRead, useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, BellRing, Check, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const notificationsQuery = useListNotifications();
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });

  const markRead = useMarkNotificationRead({
    mutation: {
      onSuccess: refresh,
      onError: () => toast({
        title: "Não foi possível atualizar",
        description: "Tente marcar a notificação como lida novamente.",
        variant: "destructive",
      }),
    },
  });
  const markAllRead = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: refresh,
      onError: () => toast({
        title: "Não foi possível atualizar",
        description: "Tente marcar as notificações como lidas novamente.",
        variant: "destructive",
      }),
    },
  });

  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  async function openNotification(item: (typeof notifications)[number]) {
    if (!item.readAt) {
      try {
        await markRead.mutateAsync({ id: item.id });
      } catch {
        return;
      }
    }
    if (item.href?.startsWith("/") && !item.href.startsWith("//")) {
      navigate(item.href);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Bell className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Central do cliente</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Notificações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Boas-vindas e avisos importantes da sua conta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void notificationsQuery.refetch()}
            disabled={notificationsQuery.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${notificationsQuery.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={unreadCount === 0 || markAllRead.isPending}
          >
            {markAllRead.isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <CheckCheck className="mr-2 h-4 w-4" />}
            Marcar todas como lidas
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={unreadCount > 0 ? "default" : "secondary"}>
          {unreadCount} {unreadCount === 1 ? "não lida" : "não lidas"}
        </Badge>
        <span className="text-xs text-muted-foreground">Exibindo até 100 notificações recentes</span>
      </div>

      {notificationsQuery.isLoading ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando notificações…
          </CardContent>
        </Card>
      ) : notificationsQuery.isError ? (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Não foi possível carregar suas notificações.</p>
              <p className="mt-1 text-sm text-muted-foreground">Confira sua conexão e tente novamente.</p>
            </div>
            <Button variant="outline" onClick={() => void notificationsQuery.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full bg-primary/10 p-4 text-primary">
              <BellRing className="h-7 w-7" />
            </div>
            <div>
              <p className="font-semibold">Você está em dia</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Quando houver um aviso para sua conta, ele aparecerá aqui.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <Card
              key={item.id}
              className={item.readAt ? "border-border/70" : "border-primary/40 bg-primary/[0.03]"}
            >
              <CardContent className="flex items-start gap-4 p-4 sm:p-5">
                <div className={`mt-0.5 rounded-full p-2 ${item.readAt ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                  {item.readAt ? <Check className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                </div>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => void openNotification(item)}
                  disabled={markRead.isPending}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{item.title}</h2>
                    {!item.readAt && <Badge className="text-[10px]">Nova</Badge>}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatCreatedAt(item.createdAt)}</p>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
