import "server-only";
import { providersInfo, runAgent } from "@/lib/agent";
import { extractWithRules } from "@/lib/agent/extract";
import { soapCompleteness } from "@/lib/agent/soap";
import { parseTranscript } from "@/lib/agent/transcript";
import { fold } from "@/lib/data/lexicon";
import { wolofEnabled } from "@/lib/features";
import { db } from "@/lib/store";
import type { AnnotatedCase, CaseResult, EvalRun, EvalSummary, Lang, PRF, Suggestion } from "@/lib/types";

/**
 * Évaluation sur le jeu de cas annotés (§ 4.10–4.12 et § 7).
 * Chaque composant est mesuré séparément : langue, extraction, diagnostic,
 * plan, compte rendu, traduction et — si une hypothèse ASR est fournie — WER.
 */

const round = (x: number) => Math.round(x * 10000) / 10000;

export function prf(predicted: string[], reference: string[]): PRF {
  const p = new Set(predicted.map(fold));
  const r = new Set(reference.map(fold));
  const tp = [...p].filter((x) => r.has(x)).length;
  const precision = p.size ? tp / p.size : r.size ? 0 : 1;
  const rappel = r.size ? tp / r.size : 1;
  const f1 = precision + rappel ? (2 * precision * rappel) / (precision + rappel) : 0;
  return {
    precision: round(precision),
    rappel: round(rappel),
    f1: round(f1),
    manquants: reference.filter((x) => !p.has(fold(x))),
    en_trop: predicted.filter((x) => !r.has(fold(x))),
  };
}

const STOP = new Set(["selon", "avec", "pour", "dans", "chez", "sans", "plus", "tous", "toute", "votre"]);
function significantTokens(s: string): string[] {
  return fold(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3 && !STOP.has(t));
}

/** Un élément du plan de référence est « retrouvé » si la moitié de ses mots significatifs figure dans une suggestion. */
export function planItemFound(reference: string, suggestions: string[]): boolean {
  const ref = significantTokens(reference);
  if (!ref.length) return false;
  return suggestions.some((s) => {
    const sug = new Set(significantTokens(s));
    return ref.filter((t) => sug.has(t)).length / ref.length >= 0.5;
  });
}

export function sameDiagnosis(a: string, b: string): boolean {
  const x = fold(a).replace(/\(.*?\)/g, "").trim();
  const y = fold(b).replace(/\(.*?\)/g, "").trim();
  return x === y || x.startsWith(y) || y.startsWith(x);
}

/** Taux d'erreur de mots (distance de Levenshtein sur les mots). */
export function wer(reference: string, hypothesis: string): number {
  const words = (s: string) =>
    fold(s.replace(/^(médecin|patient|patiente|accompagnant)\s*:/gim, ""))
      .split(/[^a-z0-9ñŋ']+/)
      .filter(Boolean);
  const r = words(reference);
  const h = words(hypothesis);
  if (!r.length) return h.length ? 1 : 0;
  let prev = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i++) {
    const cur = [i];
    for (let j = 1; j <= h.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return round(prev[h.length] / r.length);
}

const diagnostics = (s: Suggestion[]) =>
  s.filter((x) => x.type === "diagnostic").sort((a, b) => (b.confiance ?? 0) - (a.confiance ?? 0));

function rank(dx: Suggestion[], ref: string) {
  const i = dx.findIndex((d) => sameDiagnosis(d.label, ref));
  const rang = i >= 0 ? i + 1 : null;
  return { top1: rang === 1, top3: rang !== null && rang <= 3, rang };
}

export async function evaluateCase(c: AnnotatedCase): Promise<CaseResult> {
  // De bout en bout : transcription d'origine (traduction comprise pour le wolof).
  const e2e = await runAgent({ turns: parseTranscript(c.reference_transcript), languagePref: "auto" });
  // Sur la traduction de référence : isole l'extraction et le diagnostic des erreurs de traduction.
  const ref =
    c.language === "wo" && c.reference_transcript_fr
      ? await runAgent({ turns: parseTranscript(c.reference_transcript_fr), languagePref: "fr" })
      : e2e;

  const present = ref.extraction.symptomes.filter((s) => s.present).map((s) => s.nom);
  const dx = diagnostics(ref.suggestions);
  const plan = ref.suggestions.filter((s) => s.type === "prise_en_charge").map((s) => s.label);

  let traduction_f1: number | null = null;
  if (c.language === "wo" && c.reference_transcript_fr) {
    const fromRef = extractWithRules(parseTranscript(c.reference_transcript_fr)).symptomes.filter((s) => s.present).map((s) => s.nom);
    const fromTr = extractWithRules(parseTranscript(e2e.transcriptFr)).symptomes.filter((s) => s.present).map((s) => s.nom);
    traduction_f1 = prf(fromTr, fromRef).f1;
  }

  return {
    case_id: c.case_id,
    langue: c.language,
    diagnostic_reference: c.reference_diagnosis,
    diagnostics_ia: dx.map((d) => d.label),
    langue_detectee: e2e.language,
    langue_ok: e2e.language === c.language,
    extraction_symptomes: prf(present, c.reference_entities.symptomes_presents),
    extraction_constantes: prf(ref.extraction.constantes.map((v) => v.nom), c.reference_entities.constantes),
    diagnostic: rank(dx, c.reference_diagnosis),
    diagnostic_bout_en_bout: rank(diagnostics(e2e.suggestions), c.reference_diagnosis),
    plan_concordance: c.reference_plan.length
      ? round(c.reference_plan.filter((p) => planItemFound(p, plan)).length / c.reference_plan.length)
      : 1,
    soap_completude: soapCompleteness(ref.soap),
    wer: c.asr_hypothesis ? wer(c.reference_transcript, c.asr_hypothesis) : null,
    traduction_f1,
  };
}

const mean = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const meanOrNull = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? mean(v) : null;
};

export function summarize(results: CaseResult[], cases: AnnotatedCase[]): EvalSummary {
  const par_langue: EvalSummary["par_langue"] = {};
  for (const l of ["fr", "wo"] as Lang[]) {
    const rs = results.filter((r) => r.langue === l);
    if (rs.length) {
      par_langue[l] = {
        n: rs.length,
        top1: mean(rs.map((r) => (r.diagnostic.top1 ? 1 : 0))),
        top1_bout_en_bout: mean(rs.map((r) => (r.diagnostic_bout_en_bout.top1 ? 1 : 0))),
      };
    }
  }
  return {
    n_cas: results.length,
    n_valides: cases.filter((c) => c.validated).length,
    diagnostic_top1: mean(results.map((r) => (r.diagnostic.top1 ? 1 : 0))),
    diagnostic_top3: mean(results.map((r) => (r.diagnostic.top3 ? 1 : 0))),
    extraction_symptomes_f1: mean(results.map((r) => r.extraction_symptomes.f1)),
    extraction_constantes_f1: mean(results.map((r) => r.extraction_constantes.f1)),
    plan_concordance: mean(results.map((r) => r.plan_concordance)),
    soap_completude: mean(results.map((r) => r.soap_completude)),
    detection_langue_exactitude: mean(results.map((r) => (r.langue_ok ? 1 : 0))),
    traduction_f1: meanOrNull(results.map((r) => r.traduction_f1)),
    wer_moyen: meanOrNull(results.map((r) => r.wer)),
    par_langue,
  };
}

export async function runEvaluation(userId: string): Promise<EvalRun> {
  // Wolof en pause : seuls les cas en français sont évalués.
  const cases = (await db.listCases()).filter((c) => wolofEnabled() || c.language === "fr");
  if (cases.length === 0) {
    throw Object.assign(new Error("Aucun cas annoté en français : ajoutez au moins un cas avant de lancer une évaluation."), { status: 409 });
  }
  const results: CaseResult[] = [];
  for (const c of cases) results.push(await evaluateCase(c));
  const p = providersInfo();
  return db.insertEvalRun({
    created_at: new Date().toISOString(),
    created_by: userId,
    config: { llm: p.llm_model ? `${p.llm} (${p.llm_model})` : p.llm, traduction: p.translation },
    summary: summarize(results, cases),
    per_case: results,
  });
}
