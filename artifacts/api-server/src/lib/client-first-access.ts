import { db, sql } from "@workspace/db";

type LoginDatabase = Pick<typeof db, "transaction">;

function rows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

/**
 * Updates the login timestamp and creates one welcome notification for a
 * client on their first successful password, Google, or claim-based access.
 * The row lock/update condition and unique dedupe key make concurrent logins
 * safe and prevent duplicate welcome notices.
 */
export async function recordSuccessfulLogin(
  database: LoginDatabase,
  userId: number,
): Promise<void> {
  await database.transaction(async (tx) => {
    const firstLogin = rows(await tx.execute(sql`
      UPDATE company_users
      SET last_login_at = NOW()
      WHERE id = ${userId} AND ativo = true AND last_login_at IS NULL
      RETURNING id, role
    `))[0] as { id: number; role: string } | undefined;

    if (!firstLogin) {
      await tx.execute(sql`
        UPDATE company_users SET last_login_at = NOW()
        WHERE id = ${userId} AND ativo = true
      `);
      return;
    }

    if (firstLogin.role !== "CLIENTE_ADMIN" && firstLogin.role !== "USUARIO_CLIENTE") return;

    await tx.execute(sql`
      INSERT INTO user_notifications
        (user_id, kind, dedupe_key, title, message, href)
      VALUES (
        ${userId},
        'welcome',
        'client-first-access-v1',
        'Bem-vindo ao Petron Radar Premium',
        'Seu acesso está ativo. Explore as oportunidades, salve as mais relevantes no Meu Portfólio e acompanhe os boletins.',
        '/oportunidades'
      )
      ON CONFLICT (user_id, dedupe_key) DO NOTHING
    `);
  });
}
