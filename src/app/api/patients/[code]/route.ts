import type { NextRequest } from "next/server";
import { error, json, requireUser } from "@/lib/api";
import { db } from "@/lib/store";

const list = (v: unknown): string[] | undefined =>
  Array.isArray(v)
    ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))].slice(0, 40).map((x) => x.slice(0, 120))
    : undefined;

/** Fiche patient : dossier et historique des consultations. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/patients/[code]">) {
  const u = await requireUser();
  if (!u.ok) return u.response;
  const { code } = await ctx.params;
  const patient = await db.findPatient(u.value.id, decodeURIComponent(code));
  if (!patient) return error(404, "Patient introuvable");
  const consultations = (await db.listConsultations(u.value.id))
    .filter((c) => c.patient.code === patient.code)
    .map((c) => ({
      id: c.id,
      created_at: c.created_at,
      status: c.status,
      motif: c.motif,
      language_detected: c.language_detected,
      diagnostic: c.suggestions.find((s) => s.type === "diagnostic" && s.decision === "accepted")?.label ?? null,
    }));
  return json({ patient, consultations });
}

/** Mise à jour du dossier : allergies, antécédents, traitements au long cours, notes. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/patients/[code]">) {
  const u = await requireUser();
  if (!u.ok) return u.response;
  const { code } = await ctx.params;
  const patient = await db.findPatient(u.value.id, decodeURIComponent(code));
  if (!patient) return error(404, "Patient introuvable");
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch = {
    ...(list(body.allergies) ? { allergies: list(body.allergies) } : {}),
    ...(list(body.antecedents) ? { antecedents: list(body.antecedents) } : {}),
    ...(list(body.traitements) ? { traitements: list(body.traitements) } : {}),
    ...(typeof body.notes === "string" ? { notes: body.notes.slice(0, 2000) } : {}),
  };
  const updated = await db.updatePatient(patient.code, patch);
  await db.audit({ user_id: u.value.id, action: "dossier_patient_modifie", consultation_id: null, detail: `${patient.code} : ${Object.keys(patch).join(", ")}` });
  return json(updated);
}
