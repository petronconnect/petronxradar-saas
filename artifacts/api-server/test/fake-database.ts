type Row = Record<string, any>;

function compileQuery(query: any): { text: string; params: unknown[] } {
  let text = "";
  const params: unknown[] = [];

  const append = (chunks: any[]) => {
    for (const chunk of chunks) {
      if (Array.isArray(chunk?.value)) {
        text += chunk.value.join("");
      } else if (Array.isArray(chunk?.queryChunks)) {
        append(chunk.queryChunks);
      } else {
        params.push(chunk && typeof chunk === "object" && "value" in chunk ? chunk.value : chunk);
        text += `$${params.length}`;
      }
    }
  };

  append(query.queryChunks);
  return { text: text.replace(/\s+/g, " ").trim().toLowerCase(), params };
}

export class FakeDatabase {
  companies: Row[] = [];
  users: Row[] = [];
  subscriptions: Row[] = [];
  bulletins: Row[] = [];
  inquiries = new Map<number, { id: number; status: string }>();
  readonly authFailureLimits = new Map<string, Row>();

  private nextCompanyId = 1;
  private nextUserId = 1;
  private nextBulletinId = 1;
  private transactionTail: Promise<void> = Promise.resolve();

  seedInquiry(id: number, status: string): void {
    this.inquiries.set(id, { id, status });
  }

  counts() {
    return {
      companies: this.companies.length,
      users: this.users.length,
      subscriptions: this.subscriptions.length,
      bulletins: this.bulletins.length,
    };
  }

  async transaction<T>(callback: (tx: { execute: (query: any) => Promise<{ rows: Row[] }> }) => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.transactionTail;
    this.transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const snapshot = structuredClone({
      companies: this.companies,
      users: this.users,
      subscriptions: this.subscriptions,
      bulletins: this.bulletins,
      inquiries: [...this.inquiries.entries()],
      authFailureLimits: [...this.authFailureLimits.entries()],
      nextCompanyId: this.nextCompanyId,
      nextUserId: this.nextUserId,
      nextBulletinId: this.nextBulletinId,
    });

    try {
      return await callback({ execute: (query) => this.execute(query) });
    } catch (error) {
      this.companies = snapshot.companies;
      this.users = snapshot.users;
      this.subscriptions = snapshot.subscriptions;
      this.bulletins = snapshot.bulletins;
      this.inquiries = new Map(snapshot.inquiries);
      this.authFailureLimits.clear();
      for (const [key, row] of snapshot.authFailureLimits) this.authFailureLimits.set(key, row);
      this.nextCompanyId = snapshot.nextCompanyId;
      this.nextUserId = snapshot.nextUserId;
      this.nextBulletinId = snapshot.nextBulletinId;
      throw error;
    } finally {
      release();
    }
  }

  async execute(query: any): Promise<{ rows: Row[] }> {
    const { text, params } = compileQuery(query);

    if (text.startsWith("delete from auth_failure_limits")) {
      if (text.includes("where limiter_key =")) {
        this.authFailureLimits.delete(String(params[0]));
      } else {
        const cutoff = new Date(params[0] as Date | string).getTime();
        for (const [key, row] of this.authFailureLimits) {
          if (new Date(row.expires_at).getTime() <= cutoff) this.authFailureLimits.delete(key);
        }
      }
      return { rows: [] };
    }

    if (text.startsWith("insert into auth_failure_limits")) {
      const [key, timestamp] = params as [string, Date];
      if (!this.authFailureLimits.has(key)) {
        this.authFailureLimits.set(key, {
          limiter_key: key,
          failures: 0,
          pending: 0,
          window_started_at: timestamp,
          blocked_until: timestamp,
          lockouts: 0,
          pending_expires_at: timestamp,
          expires_at: timestamp,
        });
      }
      return { rows: [] };
    }

    if (text.startsWith("select failures, pending, window_started_at, blocked_until, lockouts")) {
      const row = this.authFailureLimits.get(String(params[0]));
      return { rows: row ? [{ ...row }] : [] };
    }

    if (text.startsWith("update auth_failure_limits")) {
      const [failures, pending, windowStartedAt, blockedUntil, lockouts, pendingExpiresAt, expiresAt, key] =
        params as [number, number, Date, Date, number, Date, Date, string];
      const row = this.authFailureLimits.get(key);
      if (row) {
        Object.assign(row, {
          failures,
          pending,
          window_started_at: windowStartedAt,
          blocked_until: blockedUntil,
          lockouts,
          pending_expires_at: pendingExpiresAt,
          expires_at: expiresAt,
        });
      }
      return { rows: [] };
    }

    if (text.startsWith("select id, status from inquiries")) {
      const inquiry = this.inquiries.get(Number(params[0]));
      return { rows: inquiry ? [{ ...inquiry }] : [] };
    }

    if (text.startsWith("select id from company_accounts") && text.includes("regexp_replace")) {
      const normalizedCnpj = String(params[0]);
      const company = this.companies.find((item) => item.cnpj.replace(/\D/g, "") === normalizedCnpj);
      return { rows: company ? [{ id: company.id }] : [] };
    }

    if (text.startsWith("select id from company_users") && text.includes("lower(email)")) {
      const email = String(params[0]).toLowerCase();
      const user = this.users.find((item) => item.email.toLowerCase() === email);
      return { rows: user ? [{ id: user.id }] : [] };
    }

    if (text.startsWith("insert into company_accounts")) {
      const [razaoSocial, nomeFantasia, cnpj, cidade, estado, email, telefone, segmento, socioAdministrador] =
        params.map((value) => value == null ? value : String(value));
      if (this.companies.some((item) => item.cnpj === cnpj)) {
        throw Object.assign(new Error("duplicate CNPJ"), { code: "23505" });
      }
      const company = {
        id: this.nextCompanyId++,
        razao_social: razaoSocial,
        nome_fantasia: nomeFantasia,
        cnpj,
        cidade,
        estado,
        email,
        telefone,
        segmento,
        socio_administrador: socioAdministrador,
        status: "ativa",
      };
      this.companies.push(company);
      return { rows: [{ id: company.id }] };
    }

    if (text.startsWith("insert into company_users")) {
      const [companyId, nome, email, passwordHash] = params.map((value) => String(value));
      if (this.users.some((item) => item.email.toLowerCase() === email.toLowerCase())) {
        throw Object.assign(new Error("duplicate email"), { code: "23505" });
      }
      const user = {
        id: this.nextUserId++,
        company_id: Number(companyId),
        nome,
        email,
        password_hash: passwordHash,
        role: "CLIENTE_ADMIN",
        ativo: true,
        must_set_password: true,
        onboarding_completed: false,
      };
      this.users.push(user);
      return { rows: [{ id: user.id }] };
    }

    if (text.startsWith("insert into subscriptions")) {
      this.subscriptions.push({ company_id: Number(params[0]), plan_slug: params[1], status: "ativo" });
      return { rows: [] };
    }

    if (text.startsWith("select title, sector, value, region, deadline from opportunities")) {
      return { rows: [] };
    }

    if (text.startsWith("select count(*)::int as c from opportunities")) {
      return { rows: [{ c: 0 }] };
    }

    if (text.startsWith("insert into bulletins")) {
      const bulletin = { id: this.nextBulletinId++, company_id: Number(params.at(-1)) };
      this.bulletins.push(bulletin);
      return { rows: [{ id: bulletin.id }] };
    }

    if (text.startsWith("update inquiries set status = 'ativo'")) {
      const inquiry = this.inquiries.get(Number(params[0]));
      if (inquiry) inquiry.status = "Ativo";
      return { rows: [] };
    }

    if (text.startsWith("select id, email from company_users")) {
      const [companyId, adminUserId] = params.map(Number);
      const user = this.users.find((item) =>
        item.company_id === companyId &&
        item.id === adminUserId &&
        item.role === "CLIENTE_ADMIN"
      );
      return { rows: user ? [{ id: user.id, email: user.email }] : [] };
    }
    if (text.startsWith("select pg_try_advisory_xact_lock")) {
      return { rows: [{ locked: true }] };
    }

    if (text.includes("from company_users cu") && text.includes("join company_accounts ca")) {
      const email = String(params[0]).toLowerCase();
      const user = this.users.find((item) => item.email.toLowerCase() === email);
      if (!user) return { rows: [] };
      const company = this.companies.find((item) => item.id === user.company_id);
      if (!company) return { rows: [] };
      return {
        rows: [{
          id: user.id,
          email: user.email,
          nome: user.nome,
          role: user.role,
          password_hash: user.password_hash,
          ativo: user.ativo,
          company_id: user.company_id,
          must_set_password: user.must_set_password,
          onboarding_completed: user.onboarding_completed,
          company_name: company.nome_fantasia,
        }],
      };
    }

    if (text.startsWith("select must_set_password, onboarding_completed")) {
      const user = this.users.find((item) => item.id === Number(params[0]));
      return {
        rows: user ? [{
          must_set_password: user.must_set_password,
          onboarding_completed: user.onboarding_completed,
        }] : [],
      };
    }

    if (text.startsWith("select password_enabled from company_users")) {
      return { rows: [{ password_enabled: true }] };
    }
    if (text.startsWith("update company_users set last_login_at")) {
      return { rows: [] };
    }

    if (
      text.startsWith("update company_users set password_hash =") &&
      text.includes("password_enabled = true") &&
      text.includes("onboarding_completed = false") &&
      text.includes("where id =")
    ) {
      const user = this.users.find((item) => item.id === Number(params[1]));
      if (!user) return { rows: [] };
      user.password_hash = String(params[0]);
      user.must_set_password = true;
      user.onboarding_completed = false;
      return { rows: [{ id: user.id, email: user.email }] };
    }

    if (text.startsWith("update company_users set password_hash")) {
      const user = this.users.find((item) => item.id === Number(params[1]));
      if (user) {
        user.password_hash = String(params[0]);
        user.must_set_password = false;
      }
      return { rows: [] };
    }

    if (text.startsWith("update company_users set onboarding_completed = true")) {
      const user = this.users.find((item) => item.id === Number(params[0]));
      if (user) user.onboarding_completed = true;
      return { rows: [] };
    }

    throw new Error(`Unhandled fake database query: ${text}`);
  }
}
