import type { Speaker, Turn } from "@/lib/types";

/*
 * Attribution automatique des tours de parole (Médecin / Patient) pour une
 * transcription sans locuteurs : dictée du navigateur ou sortie brute d'un ASR.
 * Heuristique simple, utilisable côté navigateur et côté serveur :
 *  - le soignant pose des questions, vouvoie, mesure et examine ;
 *  - le patient parle à la première personne, s'adresse au « docteur », répond oui/non.
 * Le praticien peut toujours corriger d'un clic.
 */

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const count = (re: RegExp, s: string) => (s.match(re) ?? []).length;

const DOCTOR_CUES =
  /\b(vous|votre|vos|avez-vous|etes-vous|est-ce qu|qu'est-ce|depuis quand|ou avez|montrez|respirez|toussez|allongez|ouvrez la bouche|je vais vous|on va vous|je vous|prenez|ordonnance|examen|examiner|temperature|tension|saturation|pouls|tdr|auscultation|bandelette)\b/g;
const PATIENT_CUES = /(\bje\b|\bj'|\bmoi\b|\bmon\b|\bma\b|\bmes\b|\bme\b|\bm'|\bdocteur\b|\bdoc\b)/g;
const ANSWER = /^(oui|non|si|pas du tout|un peu|d'accord|ok|merci|deedeet|waaw)\b/;
const QUESTION_START = /^(est-ce|avez|etes|vous|qu'est-ce|depuis quand|ou|quand|comment|combien|pourquoi)\b/;

// Wolof (orthographe usuelle ; ñ devient n après normalisation).
const WO_DOCTOR_CUES = /\b(ndax|lan|fan|kan|naka|naata|nanga def|ana|xoolal|ubbil|noyyil)\b/g;
const WO_PATIENT_CUES = /\b(dama|damay|sama|maangi|mangi|dafa|dafay|doktoor|dokteer)\b/g;

/** Indices lexicaux en faveur du soignant et du patient (français et wolof). */
export function speakerCues(text: string): { doctor: number; patient: number } {
  const s = fold(text).trim();
  let doctor = (count(DOCTOR_CUES, s) + count(WO_DOCTOR_CUES, s)) * 2;
  if (/\?\s*$/.test(text) || QUESTION_START.test(s)) doctor += 2;
  const patient = (count(PATIENT_CUES, s) + count(WO_PATIENT_CUES, s)) * 2 - (/\bje vais vous\b|\bje vous\b/.test(s) ? 2 : 0);
  return { doctor, patient };
}

/** Locuteur le plus probable d'une phrase, sachant qui a parlé juste avant. */
export function inferSpeaker(text: string, previous: Speaker | undefined): Speaker {
  const s = fold(text).trim();
  if (ANSWER.test(s) && previous === "medecin") return "patient";
  const { doctor, patient } = speakerCues(text);
  if (doctor > patient) return "medecin";
  if (patient > doctor) return "patient";
  // Indécis : alternance des tours (une consultation commence en général par le soignant).
  return previous === "medecin" ? "patient" : "medecin";
}

/** Complète les tours sans locuteur ; les locuteurs déjà indiqués sont conservés. */
export function inferSpeakers(turns: Turn[]): Turn[] {
  let previous: Speaker | undefined;
  return turns.map((t) => {
    const who = t.who || inferSpeaker(t.text, previous);
    previous = who;
    return { ...t, who };
  });
}
