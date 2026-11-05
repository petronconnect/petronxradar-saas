import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstallButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function InstallButton({
  variant = "outline",
  size = "sm",
  className,
}: InstallButtonProps) {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  if (isInstalled) {
    return (
      <span className={cn("flex items-center gap-1.5 text-xs text-green-400", className)}>
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        App instalado
      </span>
    );
  }

  if (!isInstallable) return null;

  return (
    <Button
      variant={variant}
      size={size}
      className={cn("gap-1.5", className)}
      onClick={() => install()}
    >
      <Download className="w-3.5 h-3.5" />
      Instalar App
    </Button>
  );
}
