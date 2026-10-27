import type { NextRequest } from "next/server";
import { error, fromError, json, requireConsultation } from "@/lib/api";
import { scribeModel } from "@/lib/agent/asr";
import { parseTranscript } from "@/lib/agent/transcript";
import { analyze } from "@/lib/consultations";
import type { Consultation, Lang } from "@/lib/types";

/**
 * Analyse d'une transcription texte. Corps : { text, source, language?, language_confidence? }
 *  - source « audio » : transcrite par ElevenLabs Scribe (voix séparées), relue par le praticien ;
 *    `language` est la langue détectée sur l'audio (« fr » ou « wo ») ;
 *  - source « dictee » : transcrite en direct par la reconnaissance vocale du navigateur ;
 *  - source « texte » : saisie par le praticien.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/consultations/[id]/transcript">) {
  const { id } = await ctx.params;
  const g = await requireConsultation(id);
  if (!g.ok) return g.response;
  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    source?: string;
    corrected?: boolean;
    language?: string;
    language_confidence?: number;
  };
  const text = body.text?.trim() ?? "";
  if (text.length < 10) return error(400, "La transcription est vide ou trop courte.");
  if (text.length > 50_000) return error(413, "Transcription trop longue (50 000 caractères max).");
  const source: NonNullable<Consultation["source"]> =
    body.source === "audio" ? "audio" : body.source === "dictee" ? "dictee" : "texte";
  const scribe = `ElevenLabs Scribe (${scribeModel()})`;
  const detected =
    source === "audio" && (body.language === "fr" || body.language === "wo")
      ? {
          lang: body.language as Lang,
          confidence: typeof body.language_confidence === "number" ? Math.max(0, Math.min(1, body.language_confidence)) : 1,
          provider: scribe,
        }
      : undefined;
  try {
    const c = await analyze(
      g.value.c,
      g.value.user,
      {
        turns: parseTranscript(text),
        detectedLanguage: detected,
        transcriptProvider: body.corrected
          ? "transcription corrigée par le praticien"
          : source === "audio"
            ? `${scribe}, voix séparées puis relues par le praticien`
            : source === "dictee"
              ? "dictée du navigateur (Web Speech)"
              : undefined,
      },
      source,
    );
    return json(c);
  } catch (err) {
    return fromError(err);
  }
}
