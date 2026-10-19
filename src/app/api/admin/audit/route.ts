import { json, requireAdmin } from "@/lib/api";
import { db } from "@/lib/store";

/** Journal d'audit de la plateforme (300 dernières actions), avec le nom de l'auteur. */
export async function GET() {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const [entries, users] = await Promise.all([db.listAudit(300), db.listUsers()]);
  const names = new Map(users.map((u) => [u.id, u.full_name]));
  return json(entries.map((e) => ({ ...e, user_name: names.get(e.user_id) ?? e.user_id })));
}
