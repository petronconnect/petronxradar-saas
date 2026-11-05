import type { Request, Response, NextFunction } from "express";

export type UserRole = "ADMIN_PETRON" | "CLIENTE_ADMIN" | "USUARIO_CLIENTE";

export interface SessionUser {
  id: number;
  email: string;
  nome: string;
  role: UserRole;
  companyId: number;
  companyName: string;
  mustSetPassword?: boolean;
  onboardingCompleted?: boolean;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
    authenticatedAt?: number;
    authenticationMethod?: "password" | "google";
    oauthBrowserBinding?: string;
    googleRegistration?: { issuer: string; subject: string; email: string; expiresAt: number };
    registration?: {
      inquiryId: number; planSlug: string; companyName: string; cnpj: string;
      contactName: string; contactRole: string; email: string; whatsapp: string;
      cidade: string; estado: string; segment: string; expiresAt: number;
    };
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user || req.session.user.role !== "ADMIN_PETRON") {
    res.status(403).json({ error: "Acesso restrito ao Admin Petron" });
    return;
  }
  next();
}

export function requireClientOrAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  if (!["ADMIN_PETRON", "CLIENTE_ADMIN"].includes(req.session.user.role)) {
    res.status(403).json({ error: "Acesso não autorizado" });
    return;
  }
  next();
}
