function compileQuery(query: any): { text: string; params: unknown[] } {
  let text = "";
  const params: unknown[] = [];
  const append = (chunks: any[]) => {
    for (const chunk of chunks) {
      if (Array.isArray(chunk?.value)) text += chunk.value.join("");
      else if (Array.isArray(chunk?.queryChunks)) append(chunk.queryChunks);
      else {
        params.push(chunk && typeof chunk === "object" && "value" in chunk ? chunk.value : chunk);
        text += `$${params.length}`;
      }
    }
  };
  append(query.queryChunks);
  return { text: text.replace(/\s+/g, " ").trim().toLowerCase(), params };
}

export function executeFakeFailureLimiterQuery(
  query: any,
  state: Map<string, Record<string, any>>,
): { handled: boolean; result: { rows: Record<string, any>[] } } {
  const { text, params } = compileQuery(query);
  if (!text.includes("auth_failure_limits")) {
    return { handled: false, result: { rows: [] } };
  }

  if (text.startsWith("delete from auth_failure_limits")) {
    if (text.includes("where limiter_key =")) {
      state.delete(String(params[0]));
    } else {
      const cutoff = new Date(params[0] as Date | string).getTime();
      for (const [key, row] of state) {
        if (new Date(row.expires_at).getTime() <= cutoff) state.delete(key);
      }
    }
    return { handled: true, result: { rows: [] } };
  }

  if (text.startsWith("insert into auth_failure_limits")) {
    const [key, timestamp] = params as [string, Date];
    if (!state.has(key)) {
      state.set(key, {
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
    return { handled: true, result: { rows: [] } };
  }

  if (text.startsWith("select failures, pending, window_started_at, blocked_until, lockouts")) {
    const row = state.get(String(params[0]));
    return { handled: true, result: { rows: row ? [{ ...row }] : [] } };
  }

  if (text.startsWith("update auth_failure_limits")) {
    const [failures, pending, windowStartedAt, blockedUntil, lockouts, pendingExpiresAt, expiresAt, key] =
      params as [number, number, Date, Date, number, Date, Date, string];
    const row = state.get(key);
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
    return { handled: true, result: { rows: [] } };
  }

  throw new Error(`Unhandled failure-limiter fake query: ${text}`);
}
