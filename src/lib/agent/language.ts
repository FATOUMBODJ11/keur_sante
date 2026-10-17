import { FRENCH_MARKERS, WOLOF_MARKERS, normalize } from "@/lib/data/lexicon";
import type { Lang, Turn } from "@/lib/types";

export interface LanguageGuess {
  lang: Lang;
  confidence: number;
  wolofTokens: number;
  frenchTokens: number;
}

/**
 * Détection lexicale français / wolof : on compte les mots-outils propres à
 * chaque langue. Les consultations mêlent souvent les deux (alternance codique) ;
 * au-delà d'un tiers de marqueurs wolof, on traite la consultation comme wolof
 * pour que la traduction ne perde pas d'information clinique.
 */
export function detectLanguage(turns: Turn[]): LanguageGuess {
  const tokens = normalize(turns.map((t) => t.text).join(" "))
    .replace(/[^\p{L}' -]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  let wo = 0;
  let fr = 0;
  for (const tok of tokens) {
    if (WOLOF_MARKERS.has(tok)) wo++;
    else if (FRENCH_MARKERS.has(tok)) fr++;
    // Lettres propres à l'orthographe wolof
    if (/[ñŋë]/.test(tok) && !WOLOF_MARKERS.has(tok)) wo += 0.5;
  }

  const total = wo + fr;
  if (total === 0) return { lang: "fr", confidence: 0.5, wolofTokens: 0, frenchTokens: 0 };
  const ratio = wo / total;
  const lang: Lang = ratio >= 0.35 ? "wo" : "fr";
  const confidence = lang === "wo" ? Math.min(1, ratio / 0.7) : Math.min(1, (1 - ratio) / 0.8);
  return {
    lang,
    confidence: Math.round(confidence * 100) / 100,
    wolofTokens: Math.round(wo),
    frenchTokens: fr,
  };
}
