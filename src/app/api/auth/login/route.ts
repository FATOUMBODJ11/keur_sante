import { setSession, toPublic, verifyPassword } from "@/lib/auth";
import { error, json } from "@/lib/api";
import { db } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const user = body.email ? db.findUserByEmail(body.email) : undefined;
  if (!user || !body.password || !verifyPassword(user, body.password)) {
    return error(401, "Identifiants incorrects.");
  }
  await setSession(user.id);
  db.audit({ user_id: user.id, action: "connexion", consultation_id: null, detail: "" });
  return json({ user: toPublic(user) });
}
