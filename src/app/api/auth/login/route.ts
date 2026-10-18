import { sessionSecretProblem, setSession, toPublic, verifyPassword } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { db, describeDbError } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const secretProblem = sessionSecretProblem();
  if (secretProblem) return error(503, `Configuration du serveur incomplète : ${secretProblem}`);
  try {
    const user = body.email ? await db.findUserByEmail(body.email) : undefined;
    if (!user || !body.password || !verifyPassword(user, body.password)) {
      return error(401, "Identifiants incorrects.");
    }
    await setSession(user.id);
    await db.audit({ user_id: user.id, action: "connexion", consultation_id: null, detail: "" });
    return json({ user: toPublic(user) });
  } catch (err) {
    console.error(err);
    return error(503, describeDbError(err));
  }
}
