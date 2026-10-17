import type { NextRequest } from "next/server";
import { error, fromError, json, requireConsultation } from "@/lib/api";
import { assertEditable } from "@/lib/consultations";
import { db } from "@/lib/store";
import type { Decision } from "@/lib/types";

/** Le médecin retient (accepted) ou écarte (rejected) une suggestion ; « pending » annule la décision. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/consultations/[id]/suggestions/[sid]">) {
  const { id, sid } = await ctx.params;
  const g = await requireConsultation(id);
  if (!g.ok) return g.response;
  const { decision } = (await req.json().catch(() => ({}))) as { decision?: Decision };
  if (decision !== "accepted" && decision !== "rejected" && decision !== "pending") return error(400, "Décision invalide");
  try {
    assertEditable(g.value.c);
    const target = g.value.c.suggestions.find((s) => s.id === sid);
    if (!target || target.type === "alerte") return error(404, "Suggestion introuvable");
    const suggestions = g.value.c.suggestions.map((s) =>
      s.id === sid ? { ...s, decision, decided_at: new Date().toISOString() } : s,
    );
    const c = await db.updateConsultation(id, { suggestions });
    await db.audit({
      user_id: g.value.user.id,
      action: `suggestion_${decision === "accepted" ? "retenue" : decision === "rejected" ? "ecartee" : "reinitialisee"}`,
      consultation_id: id,
      detail: target.label,
    });
    return json(c);
  } catch (err) {
    return fromError(err);
  }
}
