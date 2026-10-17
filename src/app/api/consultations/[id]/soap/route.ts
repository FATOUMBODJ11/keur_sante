import type { NextRequest } from "next/server";
import { error, fromError, json, requireConsultation } from "@/lib/api";
import { assertEditable } from "@/lib/consultations";
import { db } from "@/lib/store";
import type { Soap, SoapKey } from "@/lib/types";

const KEYS: SoapKey[] = ["S", "O", "A", "P"];

/** Enregistre la version du SOAP relue par le médecin. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/consultations/[id]/soap">) {
  const { id } = await ctx.params;
  const g = await requireConsultation(id);
  if (!g.ok) return g.response;
  const body = (await req.json().catch(() => ({}))) as Partial<Soap>;
  try {
    const { c } = g.value;
    assertEditable(c);
    if (!c.soap_final) return error(409, "Aucun compte rendu à modifier");
    const soap = { ...c.soap_final };
    const changed: SoapKey[] = [];
    for (const k of KEYS) {
      const v = body[k];
      if (typeof v !== "string" || v === soap[k]) continue;
      if (v.length > 10_000) return error(413, `Rubrique ${k} trop longue`);
      soap[k] = v;
      changed.push(k);
    }
    const updated = db.updateConsultation(id, { soap_final: soap });
    if (changed.length) db.audit({ user_id: g.value.user.id, action: "soap_modifie", consultation_id: id, detail: changed.join(", ") });
    return json(updated);
  } catch (err) {
    return fromError(err);
  }
}
