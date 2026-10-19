import type { NextRequest } from "next/server";
import { createResetLink } from "@/lib/accounts";
import { error, json, requireAdmin } from "@/lib/api";
import { toPublic } from "@/lib/auth";
import { db } from "@/lib/store";

/** Rôle de médecin validateur, déverrouillage du compte. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { validator?: boolean; unlock?: boolean };
  const patch: Record<string, unknown> = {};
  if (typeof body.validator === "boolean") patch.validator = body.validator;
  if (body.unlock) Object.assign(patch, { failed_logins: 0, locked_until: null });
  const user = await db.updateUser(id, patch);
  if (!user) return error(404, "Compte introuvable");
  await db.audit({ user_id: a.value.id, action: "compte_modifie_admin", consultation_id: null, detail: `${user.email} ${JSON.stringify(patch)}` });
  return json(toPublic(user));
}

/** Génère un lien de réinitialisation à transmettre au praticien (quand l'e-mail n'est pas configuré). */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const a = await requireAdmin();
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  const user = await db.findUser(id);
  if (!user) return error(404, "Compte introuvable");
  const link = await createResetLink(user, new URL(req.url).origin);
  await db.audit({ user_id: a.value.id, action: "lien_reinitialisation_cree", consultation_id: null, detail: user.email });
  return json({ link });
}
