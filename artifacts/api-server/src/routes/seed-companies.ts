import { Router, type Request, type Response, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db, sql } from "@workspace/db";

class AlreadySeededError extends Error {}

const MIN_BOOTSTRAP_TOKEN_BYTES = 32;
type SeedDatabase = Pick<typeof db, "transaction">;

export function isBootstrapAuthorized(
  authorizationHeader: string | undefined,
  expectedToken: string | undefined,
): boolean {
  if (!expectedToken || Buffer.byteLength(expectedToken, "utf8") < MIN_BOOTSTRAP_TOKEN_BYTES) {
    return false;
  }
  if (!authorizationHeader?.startsWith("Bearer ")) return false;

  const presentedToken = authorizationHeader.slice("Bearer ".length);
  if (!presentedToken) return false;

  const expectedDigest = createHash("sha256").update(expectedToken).digest();
  const presentedDigest = createHash("sha256").update(presentedToken).digest();
  return timingSafeEqual(expectedDigest, presentedDigest);
}

function toRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

type SeedEntry = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  estado: string;
  email: string;
  telefone: string | null;
  segmento: string;
  socioAdministrador: string | null;
  capitalSocial: number | null;
  status: string;
  planSlug: string | null;
  user: {
    nome: string;
    email: string;
    role: string;
    mustSetPassword: boolean;
    onboardingCompleted: boolean;
  };
};

// Current production roster. Mirrors the development database exactly.
const ENTRIES: SeedEntry[] = [
  {
    razaoSocial: "PLUSTECH AUTOMACAO E CONTROLE LTDA",
    nomeFantasia: "Petron Radar",
    cnpj: "56.828.585/0001-97",
    cidade: "A confirmar",
    estado: "BR",
    email: "petronconnect@gmail.com",
    telefone: null,
    segmento: "Operadora da plataforma Petron Radar",
    socioAdministrador: "Vinicius de Barros Santos",
    capitalSocial: null,
    status: "ativa",
    planSlug: null, // operator company — no client subscription
    user: {
      nome: "Vinicius de Barros Santos",
      email: "petronconnect@gmail.com",
      role: "ADMIN_PETRON",
      mustSetPassword: true,
      onboardingCompleted: true, // operator skips the client tour
    },
  },
  {
    razaoSocial: "MARCELO R. DOS SANTOS CONSTRUCOES LTDA",
    nomeFantasia: "MR Produções e Projetos",
    cnpj: "40.498.701/0001-17",
    cidade: "Capim Grosso",
    estado: "BA",
    email: "minhacasazonarural@hotmail.com",
    telefone: "(71) 9111-8714",
    segmento: "Construção / Engenharia / Obras",
    socioAdministrador: "Marcelo Rodrigues dos Santos",
    capitalSocial: null,
    status: "ativa",
    planSlug: "radar-lancamento",
    user: {
      nome: "Marcelo Rodrigues",
      email: "minhacasazonarural@hotmail.com",
      role: "CLIENTE_ADMIN",
      mustSetPassword: true,
      onboardingCompleted: false,
    },
  },
  {
    razaoSocial: "PAVANELLI TECH LTDA",
    nomeFantasia: "Pavanelli Tech",
    cnpj: "23.673.921/0001-10",
    cidade: "São Paulo",
    estado: "SP",
    email: "brunopavanelli@pavanellitech.com.br",
    telefone: "(11) 4789-9733",
    segmento: "Telecom / TI / Engenharia",
    socioAdministrador: "Bruno Pavanelli",
    capitalSocial: null,
    status: "ativa",
    planSlug: "radar-lancamento",
    user: {
      nome: "Bruno Pavanelli",
      email: "brunopavanelli@pavanellitech.com.br",
      role: "CLIENTE_ADMIN",
      mustSetPassword: true,
      onboardingCompleted: false,
    },
  },
  {
    razaoSocial: "Construtora Veneza AFCT LTDA",
    nomeFantasia: "Construtora Veneza",
    cnpj: "05.936.342/0001-31",
    cidade: "São Paulo",
    estado: "SP",
    email: "contato@construtoraveneza.com.br",
    telefone: null,
    segmento: "Construção / Engenharia",
    socioAdministrador: "André Carlos Pinheiro",
    capitalSocial: 20000000,
    status: "ativa",
    planSlug: "radar-lancamento",
    user: {
      nome: "André Carlos Pinheiro",
      email: "andre@construtoraveneza.com.br",
      role: "CLIENTE_ADMIN",
      mustSetPassword: true,
      onboardingCompleted: false,
    },
  },
];

// One-time bootstrap of the initial roster. Set BOOTSTRAP_AUTH_TOKEN as a
// Replit Secret (at least 32 bytes; generate a random value) before calling this
// route from the Empresas page. It is never included in source or logs.
// Self-disabling: it only runs while company_users is empty. The guard check
// and all inserts run inside one transaction, so a failure rolls back fully.
export function createSeedCompaniesRouter(database: SeedDatabase = db): IRouter {
const router: IRouter = Router();

router.post("/admin/seed-companies", async (req: Request, res: Response): Promise<void> => {
  res.set("Cache-Control", "no-store, private");

  const expectedToken = process.env.BOOTSTRAP_AUTH_TOKEN;
  if (!expectedToken || Buffer.byteLength(expectedToken, "utf8") < MIN_BOOTSTRAP_TOKEN_BYTES) {
    req.log.error("seed-companies unavailable: BOOTSTRAP_AUTH_TOKEN is missing or too short");
    res.status(503).json({ ok: false, error: "bootstrap_unavailable" });
    return;
  }

  if (!isBootstrapAuthorized(req.get("authorization"), expectedToken)) {
    req.log.warn("seed-companies rejected: invalid bootstrap authorization");
    res.status(401).json({ ok: false, error: "bootstrap_unauthorized" });
    return;
  }

  if (process.env.NODE_ENV === "production" && !req.secure) {
    res.status(404).json({ ok: false, error: "seed_unavailable" });
    return;
  }

  const HASH_ROUNDS = 10;
  const today = new Date().toISOString().split("T")[0];
  const renewal = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  try {
    const results = await database.transaction(async (tx) => {
      const existing = toRows(
        await tx.execute(sql`SELECT count(*)::int AS c FROM company_users`),
      );
      const userCount = existing.length > 0 ? Number(existing[0].c) : 0;
      if (userCount > 0) {
        throw new AlreadySeededError();
      }

      const seeded: {
        companyName: string;
        adminEmail: string;
        temporaryPassword: string;
        mustSetPassword: boolean;
      }[] = [];
      for (const c of ENTRIES) {
        let compRows = toRows(
          await tx.execute(sql`SELECT id FROM company_accounts WHERE cnpj = ${c.cnpj} LIMIT 1`),
        );
        if (compRows.length === 0) {
          compRows = toRows(
            await tx.execute(sql`
              INSERT INTO company_accounts
                (razao_social, nome_fantasia, cnpj, cidade, estado, email, telefone,
                 segmento, socio_administrador, capital_social, status)
              VALUES
                (${c.razaoSocial}, ${c.nomeFantasia}, ${c.cnpj}, ${c.cidade}, ${c.estado},
                 ${c.email}, ${c.telefone}, ${c.segmento}, ${c.socioAdministrador},
                 ${c.capitalSocial}, ${c.status})
              ON CONFLICT (cnpj) DO NOTHING
              RETURNING id
            `),
          );
        }
        if (compRows.length === 0) {
          // INSERT hit ON CONFLICT and returned nothing — re-read the existing row.
          compRows = toRows(
            await tx.execute(sql`SELECT id FROM company_accounts WHERE cnpj = ${c.cnpj} LIMIT 1`),
          );
        }
        const companyId = compRows[0].id as number;

        if (c.planSlug) {
          await tx.execute(sql`
            INSERT INTO subscriptions (company_id, plan_slug, start_date, renewal_date, status)
            VALUES (${companyId}, ${c.planSlug}, ${today}::date, ${renewal}::date, 'ativo')
            ON CONFLICT (company_id) DO NOTHING
          `);
        }

        const temporaryPassword = randomBytes(24).toString("base64url");
        const hash = await bcrypt.hash(temporaryPassword, HASH_ROUNDS);
        await tx.execute(sql`
          INSERT INTO company_users
            (company_id, nome, email, password_hash, role, ativo,
             must_set_password, onboarding_completed)
          VALUES
            (${companyId}, ${c.user.nome}, ${c.user.email}, ${hash}, ${c.user.role}, true,
             ${c.user.mustSetPassword}, ${c.user.onboardingCompleted})
          ON CONFLICT (email) DO NOTHING
        `);

        seeded.push({
          companyName: c.nomeFantasia,
          adminEmail: c.user.email,
          temporaryPassword,
          mustSetPassword: c.user.mustSetPassword,
        });
      }
      return seeded;
    });

    req.log.info({ seeded: results.length }, "seed-companies completed");
    res.set("Cache-Control", "no-store, private").json({ ok: true, seeded: results.length, results });
  } catch (err) {
    if (err instanceof AlreadySeededError) {
      req.log.warn("seed-companies rejected: database already seeded");
      res.status(403).json({
        ok: false,
        error: "already_seeded",
        message: "company_users is not empty; bootstrap seeding is disabled.",
      });
      return;
    }
    req.log.error({ err }, "seed-companies failed");
    res.status(500).json({ ok: false, error: "seed_failed" });
  }
});

return router;
}

const router = createSeedCompaniesRouter();
export default router;
