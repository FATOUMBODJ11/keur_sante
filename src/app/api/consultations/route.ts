import { fromError, json, requireUser } from "@/lib/api";
import { newConsultation } from "@/lib/consultations";
import { db } from "@/lib/store";

export async function GET() {
  const u = await requireUser();
  if (!u.ok) return u.response;
  return json(db.listConsultations(u.value.id));
}

export async function POST(req: Request) {
  const u = await requireUser();
  if (!u.ok) return u.response;
  try {
    const c = newConsultation(u.value, await req.json().catch(() => ({})));
    db.insertConsultation(c);
    db.audit({
      user_id: u.value.id,
      action: "consultation_ouverte",
      consultation_id: c.id,
      detail: `consentements patient et praticien · langue ${c.language_requested}`,
    });
    return json(c, 201);
  } catch (err) {
    return fromError(err);
  }
}
