import { PASSWORD_MIN } from "@/lib/accounts";
import { error, json } from "@/lib/api";
import { hashToken } from "@/lib/auth";
import { db, describeDbError, hashPassword } from "@/lib/store";

/** Nouveau mot de passe à partir d'un lien de réinitialisation (usage unique, 1 h). */
export async function POST(req: Request) {
  const { token, password } = (await req.json().catch(() => ({}))) as { token?: string; password?: string };
  if (!token) return error(400, "Lien de réinitialisation incomplet.");
  if (!password || password.length < PASSWORD_MIN) return error(400, `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`);
  try {
    const reset = await db.getReset(hashToken(token));
    if (!reset || reset.used || new Date(reset.expires_at) < new Date()) {
      return error(400, "Ce lien n'est plus valable. Faites une nouvelle demande de réinitialisation.");
    }
    const user = await db.updateUser(reset.user_id, { passwordHash: hashPassword(password), failed_logins: 0, locked_until: null });
    if (!user) return error(400, "Compte introuvable.");
    await db.putReset({ ...reset, used: true });
    await db.audit({ user_id: user.id, action: "mot_de_passe_reinitialise", consultation_id: null, detail: "" });
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return error(503, describeDbError(err));
  }
}
