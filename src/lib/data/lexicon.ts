/**
 * Lexiques utilisés par le moteur de règles (mode hors-ligne) :
 * symptômes en français courant, glossaire wolof → français, marqueurs de langue.
 * Ils servent aussi de repli quand le LLM n'est pas configuré ou échoue.
 */

export interface SymptomEntry {
  terms: string[];
  /** Localisation implicite quand le terme la porte (« mal à la tête » → tête). */
  localisation?: string;
}

export const SYMPTOMS: Record<string, SymptomEntry> = {
  fièvre: { terms: ["fièvre", "fiévreux", "fébrile", "corps chaud"] },
  céphalées: {
    terms: ["maux de tête", "mal à la tête", "mal de tête", "céphalées", "céphalée"],
    localisation: "tête",
  },
  frissons: { terms: ["frissons", "frisson"] },
  fatigue: { terms: ["fatigué", "fatiguée", "fatigue", "épuisé", "épuisée", "asthénie"] },
  toux: { terms: ["toux", "tousse", "toussez", "toussé", "tousser", "tousses"] },
  expectorations: { terms: ["crachats", "expectorations", "crache", "glaires"] },
  dyspnée: {
    terms: ["essoufflé", "essoufflée", "essoufflement", "souffle court", "mal à respirer", "difficulté à respirer", "difficultés à respirer", "dyspnée"],
    localisation: "poitrine",
  },
  "douleur thoracique": {
    terms: ["douleur thoracique", "mal à la poitrine", "douleur à la poitrine"],
    localisation: "poitrine",
  },
  rhinorrhée: { terms: ["nez qui coule", "rhume", "rhinorrhée"] },
  odynophagie: {
    terms: ["mal à la gorge", "mal de gorge", "mal à avaler", "mal pour avaler", "odynophagie"],
    localisation: "gorge",
  },
  diarrhée: { terms: ["diarrhée", "selles liquides"] },
  vomissements: { terms: ["vomissements", "vomis", "vomit", "vomi", "vomir", "vomissent"] },
  nausées: { terms: ["nausées", "nausée", "envie de vomir"] },
  "douleur abdominale": {
    terms: ["mal au ventre", "mal au bas-ventre", "douleur abdominale", "douleurs abdominales", "ventre"],
    localisation: "ventre",
  },
  vertiges: { terms: ["vertiges", "vertige", "tourne la tête"] },
  "brûlures mictionnelles": {
    terms: ["brûle quand j'urine", "brûlures mictionnelles", "brûlures en urinant", "brûlure"],
  },
  pollakiurie: {
    terms: ["envie fréquente d'uriner", "souvent uriner", "urine souvent", "envie d'uriner", "pollakiurie"],
  },
  polyurie: { terms: ["urine beaucoup", "beaucoup uriner", "polyurie"] },
  polydipsie: { terms: ["soif", "polydipsie"] },
  amaigrissement: { terms: ["maigri", "amaigrissement", "perdu du poids", "perte de poids"] },
  "douleurs articulaires": { terms: ["douleurs articulaires", "mal aux articulations", "courbatures"] },
  "éruption cutanée": { terms: ["boutons", "éruption", "plaques sur la peau"] },
};

/** Zones anatomiques repérables dans la phrase, plus précises que la localisation implicite. */
export const LOCALISATIONS = ["nuque", "bas-ventre", "dos", "gorge", "poitrine", "ventre", "tête"];

export const MEDICATIONS = [
  "paracétamol",
  "amlodipine",
  "nifédipine",
  "captopril",
  "hydrochlorothiazide",
  "metformine",
  "glibenclamide",
  "insuline",
  "amoxicilline",
  "ciprofloxacine",
  "cotrimoxazole",
  "ibuprofène",
  "aspirine",
  "artéméther",
  "luméfantrine",
  "quinine",
  "salbutamol",
];

export const HISTORY_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /hypertension|hypertendue?|tension (?:élevée|haute)|\bhta\b/i, label: "HTA" },
  { re: /diab[eè]te|diabétique/i, label: "diabète" },
  { re: /asthme|asthmatique/i, label: "asthme" },
  { re: /drépanocyt/i, label: "drépanocytose" },
  { re: /tuberculose/i, label: "tuberculose" },
  { re: /\bvih\b|séropositi/i, label: "VIH" },
  { re: /enceinte|grossesse/i, label: "grossesse" },
];

/** Mots qui ouvrent une négation portant sur le symptôme qui suit. */
export const NEGATORS = ["pas de", "pas d'", "sans", "aucun", "aucune", "ni", "jamais de", "plus de"];

/** Réponses courtes négatives / positives (français et wolof). */
export const NEGATIVE_ANSWERS = /^(non|déedéet|deedeet|pas du tout|absolument pas)\b/i;
export const POSITIVE_ANSWERS = /^(oui|waaw|waw|si|effectivement|un peu)\b/i;

/**
 * Glossaire wolof → français (démo). Il couvre les tournures cliniques des cas
 * annotés ; il ne remplace pas une vraie traduction automatique. Les entrées
 * les plus longues sont appliquées en premier.
 */
export const WOLOF_GLOSSARY: [string, string][] = [
  ["naka nga def", "comment allez-vous"],
  ["lan moo la indi", "qu'est-ce qui vous amène"],
  ["lu la indi", "qu'est-ce qui vous amène"],
  ["sama bopp dafay metti", "j'ai mal à la tête"],
  ["sama bopp dafa metti", "j'ai mal à la tête"],
  ["sama biir dafay metti", "j'ai mal au ventre"],
  ["sama biir dafa metti", "j'ai mal au ventre"],
  ["sama gémmiñ dafay metti", "j'ai mal à la gorge"],
  ["sama put dafay metti", "j'ai mal à la gorge"],
  ["sama dënn dafay metti", "j'ai mal à la poitrine"],
  ["dama am tàngoor", "j'ai de la fièvre"],
  ["am nga tàngoor", "avez-vous de la fièvre"],
  ["dangay sëqët", "vous toussez"],
  ["dama sëqët", "je tousse"],
  ["dama sonn", "je suis fatigué"],
  ["dama vomi", "j'ai vomi"],
  ["dama waccu", "j'ai vomi"],
  ["dama xiif ndox", "j'ai soif"],
  ["dama am diarrhée", "j'ai la diarrhée"],
  ["dama tooy", "j'ai des frissons"],
  ["ñetti fan", "depuis trois jours"],
  ["ñaari fan", "depuis deux jours"],
  ["benn fan", "depuis un jour"],
  ["juróomi fan", "depuis cinq jours"],
  ["benn ayu-bés", "depuis une semaine"],
  ["tey suba", "ce matin"],
  ["démb", "hier"],
  ["metti lool", "très mal"],
  ["lool", "beaucoup"],
  ["tuuti", "un peu"],
  ["tàngoor", "fièvre"],
  ["sëqët", "toux"],
  ["bopp", "tête"],
  ["biir", "ventre"],
  ["déedéet", "non"],
  ["deedeet", "non"],
  ["waaw", "oui"],
  ["dafay metti", "fait mal"],
  ["dafa metti", "fait mal"],
  ["dama am", "j'ai"],
  ["am nga", "avez-vous"],
  ["dama", "je"],
  ["sama", "mon"],
  ["ak", "et"],
];

/** Mots très fréquents en wolof et quasi absents du français. */
export const WOLOF_MARKERS = new Set([
  "dama", "sama", "nga", "ak", "déedéet", "deedeet", "waaw", "lan", "naka", "def", "am",
  "dafa", "dafay", "tàngoor", "metti", "fan", "bopp", "biir", "sëqët", "sonn", "moo",
  "indi", "lool", "tuuti", "ñaari", "ñetti", "tey", "suba", "dangay", "yow", "dëgg",
  "jërëjëf", "nanga", "yi", "ngi", "dina", "waccu", "xiif", "tooy", "démb",
]);

export const FRENCH_MARKERS = new Set([
  "je", "j'ai", "vous", "depuis", "est", "les", "des", "une", "un", "pas", "de", "et", "mal",
  "qui", "que", "avez", "avec", "pour", "suis", "très", "aussi", "mais", "le", "du", "au",
  "bonjour", "docteur", "comment", "il", "elle",
]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Supprime les accents : utile pour les comparaisons tolérantes. */
export function fold(text: string): string {
  return normalize(text).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Cherche un terme entier (pas au milieu d'un mot). Renvoie l'index ou -1. */
export function findTerm(haystack: string, term: string): number {
  const re = new RegExp(`(?<![\\p{L}])${escapeRe(term)}(?![\\p{L}])`, "iu");
  const m = re.exec(haystack);
  return m ? m.index : -1;
}

export function replaceTerm(haystack: string, term: string, by: string): string {
  const re = new RegExp(`(?<![\\p{L}])${escapeRe(term)}(?![\\p{L}])`, "giu");
  return haystack.replace(re, by);
}
