import { fromError, json, requireUser } from "@/lib/api";
import { newConsultation } from "@/lib/consultations";
import { db } from "@/lib/store";

export async function GET() {
  const u = await requireUser();
  if (!u.ok) return u.response;
  return json(await db.listConsultations(u.value.id));
}

export async function POST(req: Request) {
  const u = await requireUser();
  if (!u.ok) return u.response;
  try {
    const c = await newConsultation(u.value, await req.json().catch(() => ({})));
    await db.insertConsultation(c);
    await db.audit({
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
