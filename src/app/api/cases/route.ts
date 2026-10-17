import { fromError, json, requireUser } from "@/lib/api";
import { parseCase, type CaseInput } from "@/lib/cases";
import { db } from "@/lib/store";

export async function GET() {
  const u = await requireUser();
  if (!u.ok) return u.response;
  return json(db.listCases());
}

/** Ajoute un cas au jeu d'évaluation. */
export async function POST(req: Request) {
  const u = await requireUser();
  if (!u.ok) return u.response;
  try {
    const data = parseCase((await req.json().catch(() => ({}))) as CaseInput);
    const c = db.insertCase({ ...data, created_at: new Date().toISOString(), created_by: u.value.full_name });
    db.audit({ user_id: u.value.id, action: "cas_ajoute", consultation_id: c.source_consultation ?? null, detail: c.case_id });
    return json(c, 201);
  } catch (err) {
    return fromError(err);
  }
}
