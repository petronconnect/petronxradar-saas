import { cn } from "@/lib/utils";

export function PetronLogo({ className, iconOnly = false }: { className?: string, iconOnly?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <linearGradient id="amberGradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--sidebar-primary))" />
              <stop offset="1" stopColor="#D97706" />
            </linearGradient>
            <radialGradient id="radarPulse" cx="16" cy="16" r="16" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--sidebar-primary))" stopOpacity="0.2" />
              <stop offset="1" stopColor="hsl(var(--sidebar-primary))" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="16" cy="16" r="15" stroke="url(#amberGradient)" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="2 2" />
          <circle cx="16" cy="16" r="10" stroke="url(#amberGradient)" strokeWidth="1" strokeOpacity="0.5" />
          <circle cx="16" cy="16" r="5" fill="url(#radarPulse)" />
          <path d="M16 8C16 8 12 13 12 16.5C12 18.9853 13.7909 21 16 21C18.2091 21 20 18.9853 20 16.5C20 13 16 8 16 8Z" fill="url(#amberGradient)" />
          <path d="M16 16V8" stroke="url(#amberGradient)" strokeWidth="1" strokeLinecap="round" className="animate-pulse" />
        </svg>
      </div>
      {!iconOnly && (
        <div className="flex flex-col">
          <span className="text-[15px] leading-none font-extrabold tracking-widest text-sidebar-foreground">PETRON</span>
          <span className="text-[9px] leading-none font-semibold tracking-[0.2em] text-sidebar-primary mt-0.5">RADAR</span>
        </div>
      )}
    </div>
  );
}
