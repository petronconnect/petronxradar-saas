import { Router, type IRouter, type Request } from "express";
import { sql } from "@workspace/db";
import {
  ListNotificationsResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function toRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

function notificationDto(row: any) {
  return {
    id: Number(row.id),
    kind: String(row.kind),
    title: String(row.title),
    message: String(row.message),
    href: row.href ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
  };
}

function currentUserId(req: Request): number {
  return req.session.user!.id;
}

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = currentUserId(req);
  const [notificationsResult, unreadResult] = await Promise.all([
    db.execute(sql`
      SELECT id, kind, title, message, href, created_at, read_at
      FROM user_notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM user_notifications
      WHERE user_id = ${userId} AND read_at IS NULL
    `),
  ]);
  const response = {
    notifications: toRows(notificationsResult).map(notificationDto),
    unreadCount: Number(toRows(unreadResult)[0]?.count ?? 0),
  };
  res.set("Cache-Control", "no-store, private");
  res.json(ListNotificationsResponse.parse(response));
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).json({ error: "Notificação inválida." });
    return;
  }
  const result = await db.execute(sql`
    UPDATE user_notifications
    SET read_at = COALESCE(read_at, NOW())
    WHERE id = ${id} AND user_id = ${currentUserId(req)}
    RETURNING id, kind, title, message, href, created_at, read_at
  `);
  const row = toRows(result)[0];
  if (!row) {
    res.status(404).json({ error: "Notificação não encontrada." });
    return;
  }
  res.set("Cache-Control", "no-store, private");
  res.json(MarkNotificationReadResponse.parse(notificationDto(row)));
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const result = await db.execute(sql`
    UPDATE user_notifications SET read_at = NOW()
    WHERE user_id = ${currentUserId(req)} AND read_at IS NULL
    RETURNING id
  `);
  const response = { updatedCount: toRows(result).length };
  res.set("Cache-Control", "no-store, private");
  res.json(MarkAllNotificationsReadResponse.parse(response));
});

export default router;
