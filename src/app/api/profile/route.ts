import { parseProfile } from "@/lib/accounts";
import { error, json, requireUser } from "@/lib/api";
import { toPublic } from "@/lib/auth";
import { db } from "@/lib/store";

export async function GET() {
  const u = await requireUser();
  if (!u.ok) return u.response;
  return json({ user: toPublic(u.value) });
}

/** Mise à jour du profil : nom, structure, type de structure, spécialité. */
export async function PATCH(req: Request) {
  const u = await requireUser();
  if (!u.ok) return u.response;
  const parsed = parseProfile((await req.json().catch(() => ({}))) as Record<string, unknown>);
  if ("error" in parsed) return error(400, parsed.error as string);
  const user = await db.updateUser(u.value.id, parsed);
  await db.audit({ user_id: u.value.id, action: "profil_modifie", consultation_id: null, detail: Object.keys(parsed).join(", ") });
  return json({ user: toPublic(user!) });
}
