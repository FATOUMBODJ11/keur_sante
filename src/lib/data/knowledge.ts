import type { Extraction } from "@/lib/types";

/**
 * Base de connaissances v1 : pathologies fréquentes en soins primaires au Sénégal.
 * Chaque fiche donne des critères pondérés et un plan de prise en charge type.
 *
 * ⚠️ Contenu de démonstration, à faire relire et compléter par un médecin
 * à partir des protocoles nationaux avant toute utilisation réelle.
 */

export interface ClinicalContext {
  ex: Extraction;
  present: Set<string>;
  absent: Set<string>;
  /** Texte complet (français) des observations et constantes, en minuscules. */
  findings: string;
  temperature: number | null;
  systolic: number | null;
  diastolic: number | null;
  spo2: number | null;
  glycemia: number | null; // g/L
  history: Set<string>;
  /** Transcription française complète, en minuscules. */
  text: string;
}

export interface Criterion {
  label: string;
  weight: number;
  test: (c: ClinicalContext) => boolean;
}

export interface PlanItem {
  label: string;
  /** N'afficher l'élément que si la condition est vraie. */
  when?: (c: ClinicalContext) => boolean;
}

export interface Condition {
  name: string;
  /** Code CIM-10. */
  code: string;
  criteria: Criterion[];
  /** Critères qui rendent le diagnostic moins probable (poids négatif). */
  against?: Criterion[];
  plan: PlanItem[];
}

const has = (s: string) => (c: ClinicalContext) => c.present.has(s);
const lacks = (s: string) => (c: ClinicalContext) => c.absent.has(s);
const finds = (re: RegExp) => (c: ClinicalContext) => re.test(c.findings);
const fever = (c: ClinicalContext) =>
  c.present.has("fièvre") || (c.temperature !== null && c.temperature >= 38);

export const KNOWLEDGE_BASE: Condition[] = [
  {
    name: "Paludisme simple",
    code: "B54",
    criteria: [
      { label: "fièvre", weight: 3, test: fever },
      { label: "céphalées", weight: 1.5, test: has("céphalées") },
      { label: "frissons", weight: 1.5, test: has("frissons") },
      { label: "fatigue", weight: 0.5, test: has("fatigue") },
      { label: "TDR paludisme positif", weight: 6, test: finds(/tdr[^.;]*palu[^.;]*positif|tdr[^.;]*positif/) },
    ],
    against: [
      { label: "TDR négatif", weight: -6, test: finds(/tdr[^.;]*négatif/) },
      { label: "pas de fièvre", weight: -4, test: (c) => lacks("fièvre")(c) && !fever(c) },
    ],
    plan: [
      {
        label: "Confirmer par TDR ou goutte épaisse",
        when: (c) => !/tdr|goutte épaisse/.test(c.findings),
      },
      { label: "CTA (artéméther-luméfantrine) selon le poids, protocole national" },
      { label: "Paracétamol si fièvre" },
      { label: "Rechercher les signes de gravité ; consulter en urgence si aggravation" },
    ],
  },
  {
    name: "Fièvre typhoïde",
    code: "A01.0",
    criteria: [
      { label: "fièvre", weight: 2, test: fever },
      { label: "céphalées", weight: 0.8, test: has("céphalées") },
      { label: "douleur abdominale", weight: 1, test: has("douleur abdominale") },
      { label: "fatigue", weight: 0.5, test: has("fatigue") },
      { label: "diarrhée", weight: 0.5, test: has("diarrhée") },
    ],
    against: [{ label: "TDR paludisme positif", weight: -1.5, test: finds(/tdr[^.;]*positif/) }],
    plan: [
      { label: "Hémoculture ou sérologie si disponible" },
      { label: "Antibiothérapie selon protocole (ex. ciprofloxacine) si confirmée" },
      { label: "Paracétamol si fièvre" },
    ],
  },
  {
    name: "Dengue (à évoquer)",
    code: "A97.9",
    criteria: [
      { label: "fièvre", weight: 1.5, test: fever },
      { label: "céphalées", weight: 0.8, test: has("céphalées") },
      { label: "douleurs articulaires", weight: 2, test: has("douleurs articulaires") },
      { label: "éruption cutanée", weight: 2, test: has("éruption cutanée") },
    ],
    against: [{ label: "TDR paludisme positif", weight: -1, test: finds(/tdr[^.;]*positif/) }],
    plan: [
      { label: "TDR dengue (NS1) si disponible" },
      { label: "Paracétamol uniquement — éviter AINS et aspirine" },
      { label: "Hydratation et surveillance des signes d'alerte" },
    ],
  },
  {
    name: "Gastro-entérite aiguë",
    code: "A09",
    criteria: [
      { label: "diarrhée", weight: 4, test: has("diarrhée") },
      { label: "vomissements", weight: 2, test: has("vomissements") },
      { label: "douleur abdominale", weight: 1, test: has("douleur abdominale") },
      { label: "nausées", weight: 0.5, test: has("nausées") },
      { label: "déshydratation à l'examen", weight: 1, test: finds(/déshydrat|pli cutané/) },
    ],
    plan: [
      { label: "Évaluer la déshydratation" },
      { label: "Réhydratation orale (SRO)" },
      {
        label: "Zinc chez l'enfant",
        when: (c) => c.ex.autres.some((a) => /enfant/.test(a)) || /enfant|kg/.test(c.findings),
      },
      { label: "Référer si signes de gravité ou sang dans les selles" },
    ],
  },
  {
    name: "Hypertension artérielle déséquilibrée",
    code: "I10",
    criteria: [
      { label: "TA ≥ 14/9", weight: 5, test: (c) => (c.systolic ?? 0) >= 140 || (c.diastolic ?? 0) >= 90 },
      { label: "HTA connue", weight: 2, test: (c) => c.history.has("HTA") },
      { label: "céphalées", weight: 1, test: has("céphalées") },
      { label: "vertiges", weight: 1, test: has("vertiges") },
    ],
    plan: [
      { label: "Contrôler la TA à deux reprises, au repos" },
      { label: "Vérifier l'observance du traitement antihypertenseur" },
      { label: "Conseils hygiéno-diététiques (sel)" },
      { label: "Bilan rénal / ECG selon disponibilité" },
    ],
  },
  {
    name: "Pneumopathie aiguë",
    code: "J18.9",
    criteria: [
      { label: "toux", weight: 2, test: has("toux") },
      { label: "fièvre", weight: 1.5, test: fever },
      { label: "dyspnée", weight: 2, test: has("dyspnée") },
      { label: "expectorations", weight: 1, test: has("expectorations") },
      { label: "douleur thoracique", weight: 1, test: has("douleur thoracique") },
      { label: "SpO2 < 95 %", weight: 2, test: (c) => c.spo2 !== null && c.spo2 < 95 },
      { label: "râles crépitants", weight: 3, test: finds(/crépitant|foyer/) },
    ],
    plan: [
      { label: "Radiographie thoracique si disponible" },
      { label: "Antibiothérapie probabiliste (amoxicilline) selon protocole" },
      { label: "Surveiller la SpO2 ; référer si détresse respiratoire" },
    ],
  },
  {
    name: "Crise d'asthme",
    code: "J45.9",
    criteria: [
      { label: "dyspnée", weight: 2.5, test: has("dyspnée") },
      { label: "asthme connu", weight: 2.5, test: (c) => c.history.has("asthme") },
      { label: "sibilants", weight: 3, test: finds(/sibilant|wheezing/) },
      { label: "SpO2 < 95 %", weight: 1, test: (c) => c.spo2 !== null && c.spo2 < 95 },
    ],
    against: [
      { label: "fièvre", weight: -1, test: fever },
      { label: "râles crépitants", weight: -2, test: finds(/crépitant/) },
    ],
    plan: [
      { label: "Bronchodilatateur inhalé (salbutamol) selon protocole" },
      { label: "Surveiller la SpO2 et la fréquence respiratoire" },
      { label: "Référer en urgence si signes de gravité (SpO2 < 92 %, parole difficile)" },
    ],
  },
  {
    name: "Infection respiratoire aiguë haute",
    code: "J06.9",
    criteria: [
      { label: "toux", weight: 2, test: has("toux") },
      { label: "rhinorrhée", weight: 2.5, test: has("rhinorrhée") },
      { label: "céphalées", weight: 0.5, test: has("céphalées") },
      { label: "odynophagie", weight: 0.5, test: has("odynophagie") },
    ],
    against: [
      { label: "dyspnée", weight: -1.5, test: has("dyspnée") },
      { label: "SpO2 < 95 %", weight: -2, test: (c) => c.spo2 !== null && c.spo2 < 95 },
    ],
    plan: [
      { label: "Traitement symptomatique (paracétamol, hydratation, lavage nasal)" },
      { label: "Réévaluation si fièvre > 3 jours ou dyspnée" },
    ],
  },
  {
    name: "Angine",
    code: "J03.9",
    criteria: [
      { label: "odynophagie", weight: 4, test: has("odynophagie") },
      { label: "fièvre", weight: 1.5, test: fever },
      { label: "amygdales inflammatoires", weight: 3, test: finds(/amygdale/) },
      { label: "absence de toux", weight: 1, test: lacks("toux") },
    ],
    plan: [
      { label: "TDR streptocoque ou score clinique (Mac Isaac)" },
      { label: "Antalgique-antipyrétique (paracétamol)" },
      { label: "Amoxicilline si origine bactérienne probable" },
    ],
  },
  {
    name: "Infection urinaire basse",
    code: "N30.0",
    criteria: [
      { label: "brûlures mictionnelles", weight: 4, test: has("brûlures mictionnelles") },
      { label: "pollakiurie", weight: 2.5, test: has("pollakiurie") },
      { label: "douleur abdominale", weight: 0.5, test: has("douleur abdominale") },
      { label: "bandelette positive", weight: 3, test: finds(/bandelette[^.;]*(positi|nitrite|leucocyte)/) },
    ],
    against: [{ label: "fièvre (pyélonéphrite ?)", weight: -1, test: fever }],
    plan: [
      { label: "ECBU si disponible" },
      { label: "Antibiothérapie adaptée selon protocole" },
      { label: "Hydratation abondante" },
    ],
  },
  {
    name: "Diabète déséquilibré",
    code: "E11.9",
    criteria: [
      { label: "polyurie", weight: 2.5, test: has("polyurie") },
      { label: "polydipsie", weight: 2.5, test: has("polydipsie") },
      { label: "amaigrissement", weight: 1.5, test: has("amaigrissement") },
      { label: "fatigue", weight: 0.5, test: has("fatigue") },
      { label: "glycémie ≥ 2 g/L", weight: 4, test: (c) => (c.glycemia ?? 0) >= 2 },
      { label: "antécédent de diabète", weight: 1, test: (c) => c.history.has("diabète") },
    ],
    plan: [
      { label: "Glycémie à jeun et HbA1c" },
      { label: "Débuter ou réévaluer le traitement hypoglycémiant" },
      { label: "Éducation thérapeutique (alimentation, activité)" },
    ],
  },
];

/** Score minimal pour qu'une pathologie soit proposée. */
export const MIN_SCORE = 3;

/** Signes d'alerte : signalés en tête des pistes, sans décision à prendre. */
export const ALERTS: { label: string; test: (c: ClinicalContext) => boolean }[] = [
  { label: "SpO2 < 92 % : détresse respiratoire possible, évaluer l'urgence.", test: (c) => c.spo2 !== null && c.spo2 < 92 },
  { label: "Fièvre ≥ 40 °C.", test: (c) => c.temperature !== null && c.temperature >= 40 },
  {
    label: "TA ≥ 180/110 mmHg : poussée hypertensive sévère.",
    test: (c) => (c.systolic ?? 0) >= 180 || (c.diastolic ?? 0) >= 110,
  },
  { label: "Glycémie ≥ 3 g/L : rechercher une décompensation.", test: (c) => (c.glycemia ?? 0) >= 3 },
  {
    label: "Signe neurologique ou de gravité rapporté (convulsions, raideur de nuque, perte de connaissance).",
    test: (c) => /convuls|raideur de (?:la )?nuque|perte de connaissance|inconscient|coma/.test(c.findings + " " + c.text),
  },
  { label: "Sang dans les selles ou les vomissements.", test: (c) => /sang dans les selles|selles sanglantes|vomi du sang|hématémèse/.test(c.text) },
  {
    label: "Déshydratation sévère suspectée.",
    test: (c) => /déshydratation sévère|pli cutané persistant|yeux enfoncés/.test(c.findings + " " + c.text),
  },
];
