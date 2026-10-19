import type { NextRequest } from "next/server";
import { error, fromError, json, requireUser } from "@/lib/api";
import { parseCase, type CaseInput } from "@/lib/cases";
import { db } from "@/lib/store";

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/cases/[id]">) {
  const u = await requireUser();
  if (!u.ok) return u.response;
  const { id } = await ctx.params;
  const existing = await db.getCase(id);
  if (!existing) return error(404, "Cas introuvable");
  try {
    const data = parseCase((await req.json().catch(() => ({}))) as CaseInput);
    // § 7.2 : seule une personne désignée comme médecin validateur peut valider une référence.
    if ((data.validated || data.reannotation) && !u.value.validator) {
      return error(403, "Seul un médecin validateur peut valider une référence ou saisir une réannotation (rôle attribué par l'administrateur).");
    }
    if (data.language !== existing.language) return error(400, "La langue d'un cas ne peut pas changer : créez un nouveau cas.");
    const c = await db.updateCase(id, data);
    await db.audit({ user_id: u.value.id, action: "cas_modifie", consultation_id: null, detail: id });
    return json(c);
  } catch (err) {
    return fromError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/cases/[id]">) {
  const u = await requireUser();
  if (!u.ok) return u.response;
  const { id } = await ctx.params;
  if (!(await db.deleteCase(id))) return error(404, "Cas introuvable");
  await db.audit({ user_id: u.value.id, action: "cas_supprime", consultation_id: null, detail: id });
  return json({ ok: true });
}
