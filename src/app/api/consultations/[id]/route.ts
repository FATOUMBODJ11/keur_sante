import type { NextRequest } from "next/server";
import { error, json, requireConsultation } from "@/lib/api";
import { db } from "@/lib/store";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/consultations/[id]">) {
  const { id } = await ctx.params;
  const g = await requireConsultation(id);
  if (!g.ok) return g.response;
  return json(g.value.c);
}

/** Suppression d'une consultation créée par erreur. Une consultation archivée reste définitive. */
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/consultations/[id]">) {
  const { id } = await ctx.params;
  const g = await requireConsultation(id);
  if (!g.ok) return g.response;
  if (g.value.c.status === "archived") return error(409, "Une consultation archivée ne peut pas être supprimée.");
  await db.deleteConsultation(id);
  await db.audit({ user_id: g.value.user.id, action: "consultation_supprimee", consultation_id: id, detail: g.value.c.patient.code });
  return json({ ok: true });
}
