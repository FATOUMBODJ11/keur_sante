import { json, requireAdmin } from "@/lib/api";
import { toPublic } from "@/lib/auth";
import { db } from "@/lib/store";

/** Liste des comptes praticiens, avec leur nombre de consultations. */
export async function GET() {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const users = await db.listUsers();
  const rows = await Promise.all(
    users.map(async (u) => ({
      ...toPublic(u),
      consultations: (await db.listConsultations(u.id)).length,
      locked: !!u.locked_until && new Date(u.locked_until) > new Date(),
    })),
  );
  return json(rows);
}
