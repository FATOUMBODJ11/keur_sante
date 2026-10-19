import { json, requireUser } from "@/lib/api";
import { db } from "@/lib/store";
import type { Stats } from "@/lib/types";

export async function GET() {
  const u = await requireUser();
  if (!u.ok) return u.response;
  const list = await db.listConsultations(u.value.id);
  const par_statut: Stats["par_statut"] = {};
  for (const c of list) par_statut[c.status] = (par_statut[c.status] ?? 0) + 1;
  const dx = list.flatMap((c) => c.suggestions).filter((s) => s.type === "diagnostic");
  // Diagnostics retenus
  const counts = new Map<string, number>();
  for (const s of dx.filter((x) => x.decision === "accepted")) counts.set(s.label, (counts.get(s.label) ?? 0) + 1);
  const top_diagnostics = [...counts.entries()]
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);

  // Consultations par semaine (lundi de chaque semaine)
  const monday = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  };
  const thisWeek = monday(new Date());
  const par_semaine = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - (7 - i) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
      semaine: start.toISOString().slice(0, 10),
      n: list.filter((c) => new Date(c.created_at) >= start && new Date(c.created_at) < end).length,
    };
  });

  // Délai médian ouverture → validation
  const delays = list
    .filter((c) => c.validated_at)
    .map((c) => (new Date(c.validated_at!).getTime() - new Date(c.created_at).getTime()) / 60000)
    .sort((a, b) => a - b);
  const delai_validation_median = delays.length ? Math.round(delays[Math.floor(delays.length / 2)] * 10) / 10 : null;

  const stats: Stats = {
    total: list.length,
    par_statut,
    top_diagnostics,
    par_semaine,
    delai_validation_median,
    patients: (await db.listPatients(u.value.id)).length,
    decisions_diagnostiques: {
      accepted: dx.filter((s) => s.decision === "accepted").length,
      rejected: dx.filter((s) => s.decision === "rejected").length,
      pending: dx.filter((s) => s.decision === "pending").length,
    },
  };
  return json(stats);
}
