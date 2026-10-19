import type { NextRequest } from "next/server";
import { error, requireUser } from "@/lib/api";
import { db } from "@/lib/store";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "" : (x * 100).toFixed(1).replace(".", ","));

/** Résultats d'une évaluation au format CSV (séparateur « ; », lisible directement dans Excel). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/eval/[id]/csv">) {
  const u = await requireUser();
  if (!u.ok) return u.response;
  const { id } = await ctx.params;
  const run = (await db.listEvalRuns()).find((r) => String(r.id) === id);
  if (!run) return error(404, "Évaluation introuvable");
  const s = run.summary;

  const lines: string[][] = [
    ["Évaluation Keur Santé n°", String(run.id), "Date", run.created_at, "Moteur", run.config.llm ?? ""],
    [],
    ["Indicateur", "Valeur (%)"],
    ["Diagnostic au rang 1", pct(s.diagnostic_top1)],
    ["Diagnostic dans le top 3", pct(s.diagnostic_top3)],
    ["Extraction des symptômes (F1)", pct(s.extraction_symptomes_f1)],
    ["Extraction des constantes (F1)", pct(s.extraction_constantes_f1)],
    ["Concordance du plan", pct(s.plan_concordance)],
    ["Complétude SOAP", pct(s.soap_completude)],
    ["Détection de la langue", pct(s.detection_langue_exactitude)],
    ["Traduction (F1 termes cliniques)", pct(s.traduction_f1)],
    ["WER moyen", pct(s.wer_moyen)],
    ["Accord intra-annotateur : concordance diagnostique", pct(s.accord_intra?.diagnostic_concordance)],
    ["Accord intra-annotateur : kappa de Cohen", s.accord_intra?.kappa === null || s.accord_intra?.kappa === undefined ? "" : s.accord_intra.kappa.toFixed(2).replace(".", ",")],
    ["Accord intra-annotateur : Jaccard symptômes", pct(s.accord_intra?.symptomes_jaccard)],
    ["Cas évalués", String(s.n_cas)],
    ["Références validées", String(s.n_valides)],
    [],
    ["Famille", "Cas", "Rang 1 (%)", "Top 3 (%)", "F1 symptômes (%)"],
    ...Object.entries(s.par_famille ?? {}).map(([f, v]) => [f, String(v.n), pct(v.top1), pct(v.top3), pct(v.symptomes_f1)]),
    [],
    [
      "Cas",
      "Langue",
      "Famille",
      "Diagnostic de référence",
      "Pistes de l'IA",
      "Rang",
      "F1 symptômes (%)",
      "Symptômes manquants",
      "Symptômes en trop",
      "F1 constantes (%)",
      "Plan (%)",
      "SOAP (%)",
      "WER (%)",
    ],
    ...run.per_case.map((r) => [
      r.case_id,
      r.langue,
      r.family ?? "",
      r.diagnostic_reference,
      r.diagnostics_ia.join(" | "),
      r.diagnostic.rang === null ? "absent" : String(r.diagnostic.rang),
      pct(r.extraction_symptomes.f1),
      r.extraction_symptomes.manquants.join(", "),
      r.extraction_symptomes.en_trop.join(", "),
      pct(r.extraction_constantes.f1),
      pct(r.plan_concordance),
      pct(r.soap_completude),
      pct(r.wer),
    ]),
  ];
  const csv = "﻿" + lines.map((l) => l.map(cell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="keur-sante-evaluation-${run.id}.csv"`,
    },
  });
}
