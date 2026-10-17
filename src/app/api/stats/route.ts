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
  const stats: Stats = {
    total: list.length,
    par_statut,
    decisions_diagnostiques: {
      accepted: dx.filter((s) => s.decision === "accepted").length,
      rejected: dx.filter((s) => s.decision === "rejected").length,
      pending: dx.filter((s) => s.decision === "pending").length,
    },
  };
  return json(stats);
}
