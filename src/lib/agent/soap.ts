import type { Extraction, PatientContext, Soap, Suggestion } from "@/lib/types";

const join = (xs: string[], sep = "; ") => xs.filter(Boolean).join(sep);
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function dossier(p?: PatientContext): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.allergies.length) parts.push(`allergies : ${join(p.allergies, ", ")}`);
  if (p.antecedents.length) parts.push(`antécédents : ${join(p.antecedents, ", ")}`);
  if (p.traitements.length) parts.push(`traitements au long cours : ${join(p.traitements, ", ")}`);
  return parts.length ? ` Dossier patient — ${join(parts)}.` : "";
}

function subjective(ex: Extraction): string {
  const parts: string[] = [];
  parts.push(`Motif : ${ex.motif ? cap(ex.motif) : "à préciser"}.`);
  const present = ex.symptomes.filter((s) => s.present);
  if (present.length) {
    parts.push(`Symptômes rapportés : ${join(present.map((s) => `${s.nom}${s.duree ? ` ${s.duree}` : ""}`))}.`);
  }
  if (ex.localisations.length) parts.push(`Localisation : ${join(ex.localisations, ", ")}.`);
  const neg = ex.symptomes.filter((s) => !s.present).map((s) => s.nom);
  if (neg.length) parts.push(`Signes négatifs : ${join(neg, ", ")}.`);
  if (ex.antecedents.length) parts.push(`Antécédents : ${join(ex.antecedents, ", ")}.`);
  if (ex.traitements.length) parts.push(`Traitements mentionnés : ${join(ex.traitements, ", ")}.`);
  if (ex.autres.length) parts.push(`Contexte : ${join(ex.autres)}.`);
  return parts.join(" ");
}

function objective(ex: Extraction): string {
  const parts: string[] = [];
  if (ex.constantes.length) {
    parts.push(`Constantes : ${join(ex.constantes.map((c) => `${c.nom} ${c.valeur} ${c.unite}`.trim()))}.`);
  }
  if (ex.observations.length) parts.push(ex.observations.map((e) => e.replace(/\.?$/, ".")).join(" "));
  return parts.length ? parts.join(" ") : "Aucune donnée objective rapportée pendant la consultation.";
}

function assessment(dx: Suggestion[], alerts: Suggestion[]): string {
  const al = alerts.length ? ` Signes d'alerte : ${alerts.map((a) => a.label.replace(/\.$/, "")).join(" ; ")}.` : "";
  if (!dx.length) return `Aucune piste proposée : les informations recueillies ne suffisent pas.${al}`;
  const [main, ...others] = dx;
  let s = `Hypothèse principale (suggestion IA) : ${main.label}`;
  if (main.arguments_pour.length) s += ` — arguments : ${join(main.arguments_pour, ", ")}`;
  s += ".";
  if (others.length) s += ` Diagnostics différentiels : ${others.map((o) => o.label).join(", ")}.`;
  return s + al;
}

function plan(items: Suggestion[]): string {
  if (!items.length) return "Plan de prise en charge à définir par le médecin.";
  return `Prise en charge suggérée (à valider) : ${join(items.map((p) => p.label))}.`;
}

const byType = (sg: Suggestion[], t: Suggestion["type"]) => sg.filter((s) => s.type === t);
const byConfidence = (a: Suggestion, b: Suggestion) => (b.confiance ?? 0) - (a.confiance ?? 0);

/** Gabarit SOAP v1 : compte rendu proposé par l'agent avant relecture. */
export function buildSoap(ex: Extraction, suggestions: Suggestion[], patient?: PatientContext): Soap {
  const dx = byType(suggestions, "diagnostic").sort(byConfidence);
  return {
    S: subjective(ex) + dossier(patient),
    O: objective(ex),
    A: assessment(dx, byType(suggestions, "alerte")),
    P: plan(byType(suggestions, "prise_en_charge")),
  };
}

/**
 * Rubriques A et P après décision du médecin : seules les suggestions retenues
 * sont conservées, sans la mention « suggestion IA ».
 */
export function decidedAssessmentAndPlan(suggestions: Suggestion[]): Pick<Soap, "A" | "P"> {
  const dx = byType(suggestions, "diagnostic").filter((s) => s.decision === "accepted").sort(byConfidence);
  const pl = byType(suggestions, "prise_en_charge").filter((s) => s.decision === "accepted");
  const A = dx.length
    ? `Diagnostic retenu : ${dx[0].label}${dx[0].code ? ` (CIM-10 ${dx[0].code})` : ""}.${
        dx.length > 1 ? ` Diagnostics différentiels retenus : ${dx.slice(1).map((d) => d.label).join(", ")}.` : ""
      }`
    : "Aucune piste diagnostique de l'IA n'a été retenue par le médecin.";
  const P = pl.length
    ? `Prise en charge : ${join(pl.map((p) => p.label))}.`
    : "Aucune suggestion de prise en charge de l'IA n'a été retenue.";
  return { A, P };
}

export function soapCompleteness(soap: Soap | null): number {
  if (!soap) return 0;
  const empty = /^(aucune|plan de prise en charge à définir|motif : à préciser\.?$)/i;
  return (["S", "O", "A", "P"] as const).filter((k) => soap[k].trim() && !empty.test(soap[k].trim())).length / 4;
}
