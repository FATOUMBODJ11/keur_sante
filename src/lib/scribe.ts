import type { Lang, Speaker, Turn } from "@/lib/types";
import { speakerCues } from "@/lib/agent/speakers";

/*
 * ElevenLabs Scribe : conversion de la réponse de speech-to-text en tours de
 * parole Médecin / Patient. Module sans dépendance serveur : utilisé par le
 * navigateur (envoi direct de l'audio avec un jeton à usage unique) et par le serveur.
 */

export const SCRIBE_API = "https://api.elevenlabs.io/v1";
export const SCRIBE_DEFAULT_MODEL = "scribe_v2";

export interface ScribeWord {
  text: string;
  type: "word" | "spacing" | "audio_event";
  speaker_id?: string | null;
}

export interface ScribeResult {
  language_code?: string;
  language_probability?: number;
  text?: string;
  words?: ScribeWord[];
}

/** Code de langue Scribe (ISO 639-3) pour une langue de l'application. */
export const scribeLanguageCode = (lang: Lang): string => (lang === "wo" ? "wol" : "fra");

/** Langue de l'application d'après le code renvoyé par Scribe (wol / wo, fra / fr). */
export function langFromScribe(code: string | undefined): Lang | null {
  const c = (code ?? "").toLowerCase();
  if (c === "wol" || c === "wo") return "wo";
  if (c === "fra" || c === "fr") return "fr";
  return null;
}

/** Regroupe les mots consécutifs d'un même locuteur en tours. */
function groupBySpeaker(words: ScribeWord[]): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  for (const w of words) {
    if (w.type === "audio_event") continue;
    const id = w.speaker_id ?? "speaker_0";
    const last = out.at(-1);
    if (w.type === "spacing") {
      if (last) last.text += " ";
      continue;
    }
    if (last && last.id === id) last.text += w.text;
    else out.push({ id, text: w.text });
  }
  return out.map((t) => ({ ...t, text: t.text.replace(/\s+/g, " ").trim() })).filter((t) => t.text);
}

/**
 * Attribue un rôle à chaque voix détectée :
 *  - le médecin est la voix qui pose le plus de questions / examine (indices lexicaux, français et wolof) ;
 *    à défaut, la première voix (le soignant ouvre en général la consultation) ;
 *  - le patient est la voix qui parle le plus parmi les autres ;
 *  - les voix restantes sont des accompagnants.
 * Le praticien peut inverser ou corriger avant l'analyse.
 */
export function assignRoles(turns: { id: string; text: string }[]): Map<string, Speaker> {
  const stats = new Map<string, { score: number; words: number; first: number }>();
  turns.forEach((t, i) => {
    const s = stats.get(t.id) ?? { score: 0, words: 0, first: i };
    const cues = speakerCues(t.text);
    s.score += cues.doctor - cues.patient;
    s.words += t.text.split(/\s+/).length;
    stats.set(t.id, s);
  });
  const ids = [...stats.keys()];
  const roles = new Map<string, Speaker>();
  if (ids.length === 0) return roles;
  const byScore = [...ids].sort((a, b) => {
    const A = stats.get(a)!;
    const B = stats.get(b)!;
    // Score normalisé par la quantité de parole ; à égalité, la première voix entendue.
    const d = B.score / Math.max(1, B.words) - A.score / Math.max(1, A.words);
    return Math.abs(d) > 0.005 ? d : A.first - B.first;
  });
  const doctor = byScore[0];
  roles.set(doctor, "medecin");
  const rest = ids.filter((x) => x !== doctor).sort((a, b) => stats.get(b)!.words - stats.get(a)!.words);
  rest.forEach((id, i) => roles.set(id, i === 0 ? "patient" : "accompagnant"));
  return roles;
}

/** Réponse Scribe → tours de parole avec rôles. */
export function scribeToTurns(result: ScribeResult): Turn[] {
  const grouped = result.words?.length ? groupBySpeaker(result.words) : [];
  if (!grouped.length) {
    const text = result.text?.trim();
    return text ? [{ who: "", text }] : [];
  }
  const roles = assignRoles(grouped);
  return grouped.map((t) => ({ who: roles.get(t.id) ?? "", text: t.text }));
}
