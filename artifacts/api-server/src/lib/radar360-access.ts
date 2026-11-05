import type { UserRole } from "./auth";

export type Radar360Actor = {
  role: UserRole;
  companyId: number | null;
};

export function canAccessRadar360Company(
  ownerCompanyId: number | null,
  actor: Radar360Actor,
): boolean {
  return actor.role === "ADMIN_PETRON"
    || (ownerCompanyId != null && actor.companyId != null && ownerCompanyId === actor.companyId);
}

export function canManageRadar360Profile(
  ownerCompanyId: number | null,
  actor: Radar360Actor,
): boolean {
  return actor.role === "ADMIN_PETRON"
    || (actor.role === "CLIENTE_ADMIN" && ownerCompanyId != null && actor.companyId === ownerCompanyId);
}
