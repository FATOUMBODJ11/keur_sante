import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ALERTS, KNOWLEDGE_BASE, MIN_SCORE, type ClinicalContext } from "@/lib/data/knowledge";
import { HISTORY_PATTERNS, SYMPTOMS, normalize } from "@/lib/data/lexicon";
import type { Extraction, Suggestion, Turn } from "@/lib/types";
import { structuredCall } from "./llm";
import { turnsToText } from "./transcript";

const sid = () => randomUUID().replace(/-/g, "").slice(0, 10);

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function buildContext(ex: Extraction, turnsFr: Turn[] = []): ClinicalContext {
  const vital = (nom: string) => ex.constantes.find((c) => c.nom === nom);
  const ta = vital("tension artérielle");
  let systolic: number | null = null;
  let diastolic: number | null = null;
  if (ta) {
    const [s, d] = ta.valeur.split("/").map(Number);
    const factor = s < 30 ? 10 : 1; // 17/10 (cmHg) → 170/100 mmHg
    systolic = s * factor;
    diastolic = d * factor;
  }
  const gly = vital("glycémie");
  let glycemia = num(gly?.valeur);
  if (glycemia !== null && gly?.unite.startsWith("mmol")) glycemia = glycemia * 0.18;

  const history = new Set<string>();
  for (const a of ex.antecedents) for (const p of HISTORY_PATTERNS) if (p.re.test(a)) history.add(p.label);

  return {
    ex,
    present: new Set(ex.symptomes.filter((s) => s.present).map((s) => s.nom)),
    absent: new Set(ex.symptomes.filter((s) => !s.present).map((s) => s.nom)),
    findings: normalize(
      [...ex.observations, ...ex.autres, ...ex.constantes.map((c) => `${c.nom} ${c.valeur} ${c.unite}`)].join(". "),
    ),
    temperature: num(vital("température")?.valeur),
    systolic,
    diastolic,
    spo2: num(vital("SpO2")?.valeur),
    glycemia,
    history,
    text: normalize(turnsFr.map((t) => t.text).join(" ")),
  };
}

export interface Ranked {
  name: string;
  code: string;
  score: number;
  confiance: number;
  pour: string[];
  contre: string[];
}

export function rankConditions(ex: Extraction, turnsFr: Turn[] = []): Ranked[] {
  const ctx = buildContext(ex, turnsFr);
  return KNOWLEDGE_BASE.map((cond) => {
    let score = 0;
    const pour: string[] = [];
    const contre: string[] = [];
    for (const c of cond.criteria) {
      if (c.test(ctx)) {
        score += c.weight;
        pour.push(c.label);
      } else if (SYMPTOMS[c.label] && ctx.absent.has(c.label) && c.weight >= 1.5) {
        contre.push(`absence de ${c.label}`);
      }
    }
    for (const c of cond.against ?? []) {
      if (c.test(ctx)) {
        score += c.weight;
        contre.push(c.label);
      }
    }
    const max = cond.criteria.reduce((a, c) => a + Math.max(0, c.weight), 0);
    return {
      name: cond.name,
      code: cond.code,
      score: Math.round(score * 10) / 10,
      confiance: Math.max(0, Math.min(1, Math.round((score / max) * 100) / 100)),
      pour,
      contre,
    };
  })
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
}

function alerts(ctx: ClinicalContext): Suggestion[] {
  return ALERTS.filter((a) => a.test(ctx)).map((a) => ({
    id: sid(),
    type: "alerte",
    label: a.label,
    code: null,
    confiance: null,
    arguments_pour: [],
    arguments_contre: [],
    lie_a: null,
    decision: "pending",
  }));
}

/** Pistes diagnostiques (3 max), signes d'alerte et prise en charge du diagnostic principal. */
export function suggestWithKnowledgeBase(ex: Extraction, turnsFr: Turn[] = []): Suggestion[] {
  const ctx = buildContext(ex, turnsFr);
  const ranked = rankConditions(ex, turnsFr).slice(0, 3);
  const out: Suggestion[] = alerts(ctx);
  if (ranked.length === 0) return out;
  for (const r of ranked) {
    out.push({
      id: sid(),
      type: "diagnostic",
      label: r.name,
      code: r.code,
      confiance: r.confiance,
      arguments_pour: r.pour,
      arguments_contre: r.contre,
      lie_a: null,
      decision: "pending",
    });
  }
  const main = KNOWLEDGE_BASE.find((c) => c.name === ranked[0].name)!;
  for (const p of main.plan.filter((p) => !p.when || p.when(ctx))) {
    out.push({
      id: sid(),
      type: "prise_en_charge",
      label: p.label,
      code: null,
      confiance: null,
      arguments_pour: [],
      arguments_contre: [],
      lie_a: main.name,
      decision: "pending",
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Suggestions par LLM, ancrées sur la base de connaissances           */
/* ------------------------------------------------------------------ */

const SuggestionSchema = z.object({
  signes_alerte: z.array(z.string()),
  pistes_diagnostiques: z.array(
    z.object({
      nom: z.string(),
      code_cim10: z.string().nullable(),
      confiance: z.number(),
      arguments_pour: z.array(z.string()),
      arguments_contre: z.array(z.string()),
    }),
  ),
  prise_en_charge: z.array(z.object({ action: z.string(), diagnostic_lie: z.string() })),
});

function protocolDigest(): string {
  return KNOWLEDGE_BASE.map(
    (c) =>
      `- ${c.name} (CIM-10 ${c.code}) — critères : ${c.criteria.map((k) => k.label).join(", ")} — prise en charge : ${c.plan
        .map((p) => p.label)
        .join(" ; ")}`,
  ).join("\n");
}

const SYSTEM = `Tu assistes un médecin de soins primaires au Sénégal. Tu proposes des pistes diagnostiques et une prise en charge, qui seront TOUTES relues, acceptées ou rejetées par le médecin. Tu ne prends aucune décision.
Règles :
- 0 à 3 pistes diagnostiques, de la plus probable à la moins probable, chacune justifiée par des éléments présents dans la consultation (arguments_pour) et, s'il y en a, des éléments qui la rendent moins probable (arguments_contre).
- "confiance" entre 0 et 1 : degré de concordance entre les éléments recueillis et la piste.
- Si les informations sont insuffisantes, renvoie une liste vide de pistes.
- "signes_alerte" : uniquement les signes de gravité réellement présents.
- 2 à 4 actions de prise en charge pour la piste principale, prudentes, conformes aux protocoles ci-dessous quand ils s'appliquent.

Protocoles de référence (base de connaissances v1) :
${protocolDigest()}`;

export async function suggestWithLlm(ex: Extraction, turnsFr: Turn[]): Promise<Suggestion[]> {
  const out = await structuredCall(
    SuggestionSchema,
    SYSTEM,
    `Informations extraites :\n${JSON.stringify(ex, null, 2)}\n\nTranscription :\n<transcription>\n${turnsToText(turnsFr)}\n</transcription>`,
  );
  const base = { arguments_pour: [], arguments_contre: [], lie_a: null, decision: "pending" as const };
  const res: Suggestion[] = out.signes_alerte.map((label) => ({ ...base, id: sid(), type: "alerte", label, code: null, confiance: null }));
  const dx = out.pistes_diagnostiques.slice(0, 3);
  for (const d of dx) {
    res.push({
      ...base,
      id: sid(),
      type: "diagnostic",
      label: d.nom,
      code: d.code_cim10,
      confiance: Math.max(0, Math.min(1, d.confiance)),
      arguments_pour: d.arguments_pour,
      arguments_contre: d.arguments_contre,
    });
  }
  for (const p of out.prise_en_charge.slice(0, 5)) {
    res.push({ ...base, id: sid(), type: "prise_en_charge", label: p.action, code: null, confiance: null, lie_a: p.diagnostic_lie || dx[0]?.nom || null });
  }
  return res;
}
