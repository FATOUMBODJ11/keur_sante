import type { Speaker, Turn } from "@/lib/types";

const SPEAKERS: Record<string, Speaker> = {
  médecin: "medecin",
  medecin: "medecin",
  docteur: "medecin",
  dr: "medecin",
  infirmier: "medecin",
  infirmière: "medecin",
  patient: "patient",
  patiente: "patient",
  accompagnant: "accompagnant",
  accompagnante: "accompagnant",
};

const SPEAKER_RE = new RegExp(`(^|\\s)(${Object.keys(SPEAKERS).join("|")})\\s*:\\s*`, "giu");

/**
 * Découpe un texte en tours de parole. Les lignes peuvent être préfixées par
 * « Médecin: » ou « Patient: » (éventuellement plusieurs fois sur une ligne).
 * Une ligne sans préfixe devient un tour sans locuteur identifié.
 */
export function parseTranscript(text: string): Turn[] {
  const turns: Turn[] = [];
  for (const rawLine of (text || "").split(/\r?\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const marks = [...line.matchAll(SPEAKER_RE)];
    if (marks.length === 0) {
      turns.push({ who: "", text: line });
      continue;
    }
    if (marks[0].index! > 0) {
      const before = line.slice(0, marks[0].index).trim();
      if (before) turns.push({ who: "", text: before });
    }
    marks.forEach((m, i) => {
      const start = m.index! + m[0].length;
      const end = i + 1 < marks.length ? marks[i + 1].index! : line.length;
      const t = line.slice(start, end).trim();
      if (t) turns.push({ who: SPEAKERS[m[2].toLowerCase()] ?? "", text: t });
    });
  }
  return turns;
}

const LABELS: Record<Speaker, string> = {
  medecin: "Médecin",
  patient: "Patient",
  accompagnant: "Accompagnant",
  "": "",
};

export function turnsToText(turns: Turn[]): string {
  return turns.map((t) => (t.who ? `${LABELS[t.who]}: ${t.text}` : t.text)).join("\n");
}

/** Découpe une transcription ASR brute (sans locuteurs) en phrases. */
export function splitSentences(text: string): Turn[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({ who: "" as const, text: s }));
}
