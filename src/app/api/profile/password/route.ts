import { PASSWORD_MIN } from "@/lib/accounts";
import { error, json, requireUser } from "@/lib/api";
import { verifyPassword } from "@/lib/auth";
import { db, hashPassword } from "@/lib/store";

/** Changement du mot de passe par le praticien connecté (mot de passe actuel requis). */
export async function POST(req: Request) {
  const u = await requireUser();
  if (!u.ok) return u.response;
  const { current, next } = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  if (!current || !verifyPassword(u.value, current)) return error(400, "Mot de passe actuel incorrect.");
  if (!next || next.length < PASSWORD_MIN) return error(400, `Le nouveau mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`);
  await db.updateUser(u.value.id, { passwordHash: hashPassword(next) });
  await db.audit({ user_id: u.value.id, action: "mot_de_passe_modifie", consultation_id: null, detail: "" });
  return json({ ok: true });
}
