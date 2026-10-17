import { clearSession, currentUser } from "@/lib/auth";
import { json } from "@/lib/api";
import { db } from "@/lib/store";

export async function POST() {
  const user = await currentUser();
  if (user) db.audit({ user_id: user.id, action: "deconnexion", consultation_id: null, detail: "" });
  await clearSession();
  return json({ ok: true });
}
