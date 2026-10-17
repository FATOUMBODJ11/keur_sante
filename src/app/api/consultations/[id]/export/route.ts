import type { NextRequest } from "next/server";
import { error, json, requireConsultation } from "@/lib/api";
import { db } from "@/lib/store";
import type { Consultation } from "@/lib/types";

const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

function report(c: Consultation, facility: string): string {
  const s = c.soap_final!;
  const profile = [c.patient.sex === "F" ? "Femme" : c.patient.sex === "M" ? "Homme" : null, c.patient.birth_year ? `née/né en ${c.patient.birth_year}` : null]
    .filter(Boolean)
    .join(", ");
  const decisions = c.suggestions
    .filter((x) => x.type !== "alerte")
    .map((x) => {
      const d = x.decision === "accepted" ? "retenue" : x.decision === "rejected" ? "écartée" : "non tranchée";
      return `  - [${d}] ${x.type === "diagnostic" ? "Piste" : "Prise en charge"} : ${x.label}${x.code ? ` (CIM-10 ${x.code})` : ""}`;
    })
    .join("\n");
  return `COMPTE RENDU DE CONSULTATION
${facility}

Patient        ${c.patient.code}${profile ? ` (${profile})` : ""}
Date           ${fmt(c.created_at)}
Langue         ${c.language_detected === "wo" ? "wolof (traduit en français)" : "français"}
Validé par     ${c.validated_by}, le ${fmt(c.validated_at!)}

S — SUBJECTIF
${s.S}

O — OBJECTIF
${s.O}

A — ANALYSE
${s.A}

P — PLAN
${s.P}

Décisions du praticien sur les suggestions de l'IA
${decisions || "  - Aucune suggestion"}

—
Document préparé avec Keur Santé. Les suggestions de l'IA ne constituent pas une décision médicale ;
ce compte rendu a été relu et validé par le praticien.`;
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/consultations/[id]/export">) {
  const { id } = await ctx.params;
  const g = await requireConsultation(id);
  if (!g.ok) return g.response;
  const { c, user } = g.value;
  if (c.status !== "validated" && c.status !== "archived") return error(409, "Export réservé aux comptes rendus validés.");
  db.audit({ user_id: user.id, action: "compte_rendu_exporte", consultation_id: id, detail: "" });
  return json({ text: report(c, user.facility) });
}
