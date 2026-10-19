import { json, requireUser } from "@/lib/api";
import { db } from "@/lib/store";

/** Patients du praticien, avec le nombre de consultations et la dernière en date. */
export async function GET() {
  const u = await requireUser();
  if (!u.ok) return u.response;
  const [patients, consultations] = await Promise.all([db.listPatients(u.value.id), db.listConsultations(u.value.id)]);
  return json(
    patients.map((p) => {
      const mine = consultations.filter((c) => c.patient.code === p.code);
      const last = mine[0];
      return {
        ...p,
        consultations: mine.length,
        last_at: last?.created_at ?? null,
        last_motif: last?.motif ?? null,
      };
    }),
  );
}
