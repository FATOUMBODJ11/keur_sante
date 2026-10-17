import { z } from "zod";
import { WOLOF_GLOSSARY, replaceTerm } from "@/lib/data/lexicon";
import type { Turn } from "@/lib/types";
import { structuredCall } from "./llm";
import { turnsToText } from "./transcript";

const GLOSSARY = [...WOLOF_GLOSSARY].sort((a, b) => b[0].length - a[0].length);

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Traduction wolof → français par glossaire (démo). Les mots français déjà
 * présents (alternance codique : « diarrhée », « rhume ») sont conservés tels quels.
 */
export function translateWithGlossary(turns: Turn[]): Turn[] {
  return turns.map((t) => {
    let out = t.text.replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
    for (const [wo, fr] of GLOSSARY) out = replaceTerm(out, wo, fr);
    out = out
      .replace(/\s+([,.?!])/g, "$1")
      .split(/(?<=[.?!]\s)/)
      .map(capitalize)
      .join("");
    return { who: t.who, text: capitalize(out) };
  });
}

const TranslationSchema = z.object({
  tours: z.array(z.object({ texte_fr: z.string() })),
});

const SYSTEM = `Tu es interprète médical wolof–français au Sénégal.
Tu traduis en français, tour de parole par tour de parole, une consultation qui peut mêler wolof et français.
Règles :
- Conserve exactement le nombre et l'ordre des tours.
- Préserve fidèlement les informations cliniques : symptômes, durées, localisations, négations, valeurs chiffrées.
- Garde tels quels les passages déjà en français.
- Traduction fidèle, sans ajouter d'interprétation médicale.`;

export async function translateWithLlm(turns: Turn[]): Promise<Turn[]> {
  const out = await structuredCall(
    TranslationSchema,
    SYSTEM,
    `Consultation (${turns.length} tours) :\n<transcription>\n${turnsToText(turns)}\n</transcription>`,
  );
  if (out.tours.length !== turns.length) {
    throw new Error(`traduction incomplète (${out.tours.length}/${turns.length} tours)`);
  }
  return turns.map((t, i) => ({ who: t.who, text: out.tours[i].texte_fr }));
}
