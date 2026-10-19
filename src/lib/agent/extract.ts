import { z } from "zod";
import {
  HISTORY_PATTERNS,
  MEDICATIONS,
  NEGATIVE_ANSWERS,
  NEGATORS,
  POSITIVE_ANSWERS,
  SYMPTOMS,
  findTerm,
  fold,
  normalize,
} from "@/lib/data/lexicon";
import type { Extraction, Turn, Vital } from "@/lib/types";
import { structuredCall } from "./llm";
import { turnsToText } from "./transcript";

/* ------------------------------------------------------------------ */
/* Moteur de règles (hors-ligne)                                       */
/* ------------------------------------------------------------------ */

const NUM = "(?:un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quinze|\\d+)";
const UNIT = "(?:jours?|semaines?|mois|ans?|heures?)";
const DURATION_RE = new RegExp(
  `(depuis (?:${NUM}\\s+${UNIT}|hier|avant-hier|ce matin|cette nuit|la nuit dernière|longtemps)|il y a ${NUM}\\s+${UNIT})`,
  "i",
);

/** Zones qui précisent une localisation implicite. */
const REFINE: Record<string, string> = { nuque: "tête", "bas-ventre": "ventre" };

const EXAM_RE =
  /tdr|examen|auscultation|bandelette|abdomen|amygdale|pli cutané|râles|sibilant|crépitant|goutte épaisse|radiographie|ecbu|déshydrat|défense|éruption|œdème|ictère|conjonctiv|souple/i;

/** Questions typiques du soignant quand le locuteur n'est pas identifié (dictée). */
const QUESTION_START = /^(vous|est-ce|avez|as-tu|tu as|depuis quand|ou|quand|comment|qu.est-ce|pas de|il a|elle a)\b/i;

/** Termes triés du plus long au plus court, pour que « envie de vomir » passe avant « vomir ». */
const TERM_INDEX = Object.entries(SYMPTOMS)
  .flatMap(([nom, e]) => e.terms.map((term) => ({ nom, term: fold(term) })))
  .sort((a, b) => b.term.length - a.term.length);

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Négation dans la même proposition : « pas de toux », « sans fièvre », « je ne tousse pas ». */
function isNegated(sentence: string, index: number, termLength: number): boolean {
  const before = sentence.slice(0, index);
  const clause = before.split(/[,;]|\bmais\b|\bet\b(?! pas)/).pop() ?? before;
  if (NEGATORS.some((n) => new RegExp(`(?:^|\\s)${n}\\s*(?:\\S+\\s+){0,2}$`, "i").test(clause + " "))) return true;
  // Négation encadrante : « ne/n' » juste avant, « pas/plus/jamais » juste après le terme.
  const after = sentence.slice(index + termLength).split(/[,;.]|\bmais\b/)[0];
  return /(?:^|\s)(?:ne|n')\s*(?:\S+\s+){0,2}$/.test(clause + " ") && /^\s*(?:\S+\s+){0,1}(pas|plus|jamais)\b/.test(after);
}

interface Hit {
  nom: string;
  index: number;
  length: number;
}

/** Repère les symptômes d'une phrase (sans accents) sans chevauchement entre termes. */
function findSymptoms(sentence: string): Hit[] {
  const masked = sentence.split("");
  const hits: Hit[] = [];
  for (const { nom, term } of TERM_INDEX) {
    const idx = findTerm(masked.join(""), term);
    if (idx < 0) continue;
    for (let k = idx; k < idx + term.length; k++) masked[k] = "#";
    if (!hits.some((h) => h.nom === nom)) hits.push({ nom, index: idx, length: term.length });
  }
  return hits.sort((a, b) => a.index - b.index);
}

function localisationFor(nom: string, sentence: string): string | null {
  const implicit = SYMPTOMS[nom]?.localisation ?? null;
  for (const [zone, parent] of Object.entries(REFINE)) {
    if (implicit === parent && findTerm(sentence, fold(zone)) >= 0) return zone;
  }
  return implicit;
}

export function extractVitals(text: string): Vital[] {
  const t = normalize(text);
  const out: Vital[] = [];
  const add = (nom: string, valeur: string, unite: string) => {
    if (!out.some((v) => v.nom === nom)) out.push({ nom, valeur, unite });
  };

  const temp =
    /(?:température|temp\.?|t°)\D{0,12}?(\d{2}(?:[,.]\d{1,2})?)/.exec(t) ??
    /(\d{2}[,.]\d)\s*(?:degrés|°)/.exec(t);
  if (temp) add("température", temp[1].replace(".", ","), "°C");

  const ta = /(?:tension(?: artérielle)?|\bta\b)\D{0,12}?(\d{2,3})\s*(?:\/|sur)\s*(\d{1,3})/.exec(t);
  if (ta) add("tension artérielle", `${ta[1]}/${ta[2]}`, Number(ta[1]) < 30 ? "cmHg" : "mmHg");

  const fc = /(?:pouls|fréquence cardiaque|\bfc\b)\D{0,12}?(\d{2,3})/.exec(t);
  if (fc) add("fréquence cardiaque", fc[1], "bpm");

  const fr = /fréquence respiratoire\D{0,12}?(\d{1,2})/.exec(t);
  if (fr) add("fréquence respiratoire", fr[1], "/min");

  const spo2 = /(?:saturation|spo2|\bsat\b)\D{0,12}?(\d{2,3})\s*(?:%|pour ?cent)/.exec(t);
  if (spo2) add("SpO2", spo2[1], "%");

  const poids =
    /(?:poids|pèse)\D{0,8}?(\d{1,3}(?:[,.]\d)?)\s*(?:kg|kilos?)/.exec(t) ?? /(\d{1,3}(?:[,.]\d)?)\s*(?:kg|kilos?)\b/.exec(t);
  if (poids) add("poids", poids[1], "kg");

  const gly = /glyc[ée]mie[^\d]{0,24}(\d+(?:[,.]\d+)?)\s*(g\/l|g|grammes?|mmol\/l|mmol)?/.exec(t);
  if (gly) add("glycémie", gly[1], gly[2]?.startsWith("mmol") ? "mmol/L" : "g/L");

  return out;
}

interface Found {
  nom: string;
  present: boolean;
  duree: string | null;
  localisation: string | null;
  source: string | null;
}

export function extractWithRules(turns: Turn[]): Extraction {
  const symptoms = new Map<string, Found>();
  const record = (nom: string, present: boolean, duree: string | null, loc: string | null, source: string) => {
    const prev = symptoms.get(nom);
    if (!prev) {
      symptoms.set(nom, { nom, present, duree, localisation: loc, source });
      return;
    }
    // Une affirmation explicite du patient l'emporte sur une négation antérieure.
    if (present && !prev.present) {
      prev.present = true;
      prev.source = source;
    }
    prev.duree ??= duree;
    prev.localisation ??= loc;
  };

  const antecedents: string[] = [];
  const traitements: string[] = [];
  const observations: string[] = [];
  const autres: string[] = [];
  const firstPatientSymptoms: string[] = [];
  let seenPatient = false;

  turns.forEach((turn, i) => {
    const isDoctor = turn.who === "medecin";
    const isPatientSide = turn.who === "patient" || turn.who === "accompagnant";
    for (const raw of splitSentences(turn.text)) {
      const s = normalize(raw);
      // Comparaison sans accents : « fievre » tapé au clavier vaut « fièvre ».
      const sf = fold(raw);
      // La dictée ne ponctue pas : une question se reconnaît aussi à sa tournure.
      const question = /\?\s*$/.test(raw) || (!isPatientSide && QUESTION_START.test(sf) && hitsAreFew(sf));
      const duree = DURATION_RE.exec(s)?.[1] ?? null;
      const hits = findSymptoms(sf);

      if (!isPatientSide && question) {
        // Le soignant interroge : la réponse du tour suivant tranche.
        const answer = turns.slice(i + 1).find((t) => t.who !== "medecin");
        const a = answer ? fold(answer.text) : "";
        for (const h of hits) {
          if (NEGATIVE_ANSWERS.test(a)) record(h.nom, false, null, null, `${raw} → ${answer!.text}`);
          else if (POSITIVE_ANSWERS.test(a)) record(h.nom, true, null, localisationFor(h.nom, sf), `${raw} → ${answer!.text}`);
        }
        continue;
      }

      for (const h of hits) {
        const present = !isNegated(sf, h.index, h.length);
        record(h.nom, present, present ? duree : null, present ? localisationFor(h.nom, sf) : null, raw);
        if (present && !isDoctor && !seenPatient) firstPatientSymptoms.push(h.nom);
      }

      if (!isPatientSide && EXAM_RE.test(s)) observations.push(raw.replace(/\s+/g, " "));
      if (!isDoctor) {
        for (const p of HISTORY_PATTERNS) {
          if (p.re.test(s) && !isNegated(s, s.search(p.re), s.match(p.re)?.[0].length ?? 0)) {
            const familial = /\b(père|mère|frère|sœur|soeur|famille|parents?)\b/.test(s);
            const label = familial ? `${p.label} (familial)` : p.label;
            if (!antecedents.includes(label)) antecedents.push(label);
          }
        }
        for (const m of MEDICATIONS) {
          if (findTerm(sf, fold(m)) >= 0 && !traitements.some((t) => t.startsWith(m))) {
            traitements.push(/arrêt|plus pris|oubli/.test(s) ? `${m} (interrompu)` : m);
          }
        }
      }
    }
    if (!isDoctor && firstPatientSymptoms.length > 0) seenPatient = true;
  });

  const fullText = normalize(turns.map((t) => t.text).join(" "));
  if (/\b(enfant|bébé|nourrisson)\b/.test(fullText)) autres.push("Patient pédiatrique (enfant)");

  const all = [...symptoms.values()];
  const present = all.filter((s) => s.present);
  const motifNames = (firstPatientSymptoms.length ? firstPatientSymptoms : present.map((s) => s.nom)).slice(0, 3);
  const motif = motifNames.length ? motifNames.join(", ") : null;
  const duree = present.find((s) => motifNames.includes(s.nom) && s.duree)?.duree ?? present.find((s) => s.duree)?.duree ?? null;

  return {
    motif,
    duree,
    symptomes: all.map(({ nom, present, duree, source }) => ({ nom, present, duree, source })),
    localisations: [...new Set(present.map((s) => s.localisation).filter((l): l is string => !!l))],
    antecedents,
    traitements,
    constantes: extractVitals(turns.map((t) => t.text).join("\n")),
    observations,
    autres,
  };
}

/** Une question courte (« vous toussez ») plutôt qu'un récit. */
function hitsAreFew(s: string) {
  return s.split(/\s+/).length <= 12;
}

/* ------------------------------------------------------------------ */
/* Extraction par LLM                                                  */
/* ------------------------------------------------------------------ */

const ExtractionSchema = z.object({
  motif: z.string().nullable(),
  duree: z.string().nullable(),
  symptomes: z.array(
    z.object({
      nom: z.string(),
      present: z.boolean(),
      duree: z.string().nullable(),
      source: z.string().nullable(),
    }),
  ),
  localisations: z.array(z.string()),
  antecedents: z.array(z.string()),
  traitements: z.array(z.string()),
  constantes: z.array(z.object({ nom: z.string(), valeur: z.string(), unite: z.string() })),
  observations: z.array(z.string()),
  autres: z.array(z.string()),
});

const SYSTEM = `Tu es un assistant de documentation médicale pour des consultations de soins primaires au Sénégal.
Tu extrais les informations cliniques d'une transcription de consultation en français.
Les locuteurs peuvent ne pas être identifiés : déduis-les du contexte (questions du soignant, réponses du patient).
Règles :
- N'invente rien : chaque élément doit être explicitement présent dans la transcription.
- Un symptôme nié (« pas de toux », réponse « non » à une question) est listé avec present=false.
- "source" : courte citation de la transcription qui justifie le symptôme.
- Utilise de préférence ce vocabulaire pour les symptômes : ${Object.keys(SYMPTOMS).join(", ")}.
- Noms de constantes attendus : température, tension artérielle, fréquence cardiaque, fréquence respiratoire, SpO2, poids, glycémie.
- "observations" : observations du soignant et résultats d'examens (TDR, auscultation, bandelette...), phrases courtes.
- "motif" : motif de consultation en quelques mots, ou null. "duree" : durée principale des symptômes, ou null.
- "autres" : autres informations pertinentes (contexte, âge, grossesse...).`;

export async function extractWithLlm(turnsFr: Turn[]): Promise<Extraction> {
  return structuredCall(ExtractionSchema, SYSTEM, `Transcription :\n<transcription>\n${turnsToText(turnsFr)}\n</transcription>`);
}
