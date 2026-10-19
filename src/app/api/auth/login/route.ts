import { LOCK_MINUTES, MAX_FAILED_LOGINS, sessionSecretProblem, setSession, toPublic, verifyPassword } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { db, describeDbError } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const secretProblem = sessionSecretProblem();
  if (secretProblem) return error(503, `Configuration du serveur incomplète : ${secretProblem}`);
  try {
    const user = body.email ? await db.findUserByEmail(body.email) : undefined;
    if (!user || !body.password) return error(401, "Identifiants incorrects.");

    // Verrouillage temporaire après plusieurs échecs (protection contre les essais en série).
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      return error(429, `Trop de tentatives. Compte verrouillé, réessayez dans ${minutes} min ou réinitialisez le mot de passe.`);
    }
    if (!verifyPassword(user, body.password)) {
      const failed = (user.failed_logins ?? 0) + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await db.updateUser(user.id, {
        failed_logins: lock ? 0 : failed,
        locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null,
      });
      if (lock) await db.audit({ user_id: user.id, action: "compte_verrouille", consultation_id: null, detail: `${MAX_FAILED_LOGINS} échecs` });
      return error(401, "Identifiants incorrects.");
    }
    if (user.failed_logins || user.locked_until) await db.updateUser(user.id, { failed_logins: 0, locked_until: null });
    await setSession(user.id);
    await db.audit({ user_id: user.id, action: "connexion", consultation_id: null, detail: "" });
    return json({ user: toPublic(user) });
  } catch (err) {
    console.error(err);
    return error(503, describeDbError(err));
  }
}
