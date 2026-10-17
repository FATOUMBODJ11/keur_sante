import type { NextRequest } from "next/server";
import { error, json, requireConsultation } from "@/lib/api";
import { db } from "@/lib/store";

/** Archivage : uniquement après validation médicale (§ 1 et § 6 du cahier des charges). */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/consultations/[id]/archive">) {
  const { id } = await ctx.params;
  const g = await requireConsultation(id);
  if (!g.ok) return g.response;
  if (g.value.c.status !== "validated") return error(409, "Validation médicale requise avant archivage.");
  const at = new Date().toISOString();
  const steps = [
    ...g.value.c.steps.filter((s) => s.name !== "archivage"),
    { name: "archivage" as const, status: "done" as const, provider: "humain", duration_ms: null, detail: `Archivé par ${g.value.user.full_name}` },
  ];
  const c = db.updateConsultation(id, { status: "archived", archived_at: at, steps });
  db.audit({ user_id: g.value.user.id, action: "consultation_archivee", consultation_id: id, detail: "" });
  return json(c);
}
