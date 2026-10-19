import type { NextRequest } from "next/server";
import { error, fromError, json, requireConsultation } from "@/lib/api";
import { parseTranscript } from "@/lib/agent/transcript";
import { analyze } from "@/lib/consultations";

/**
 * Analyse d'une transcription texte. Corps : { text, source }
 *  - source « dictee » : transcrite en direct par la reconnaissance vocale du navigateur ;
 *  - source « texte » : saisie par le praticien.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/consultations/[id]/transcript">) {
  const { id } = await ctx.params;
  const g = await requireConsultation(id);
  if (!g.ok) return g.response;
  const body = (await req.json().catch(() => ({}))) as { text?: string; source?: string; corrected?: boolean };
  const text = body.text?.trim() ?? "";
  if (text.length < 10) return error(400, "La transcription est vide ou trop courte.");
  if (text.length > 50_000) return error(413, "Transcription trop longue (50 000 caractères max).");
  const dictee = body.source === "dictee";
  try {
    const c = await analyze(
      g.value.c,
      g.value.user,
      {
        turns: parseTranscript(text),
        transcriptProvider: body.corrected
          ? "transcription corrigée par le praticien"
          : dictee
            ? "dictée du navigateur (Web Speech)"
            : undefined,
      },
      dictee ? "dictee" : "texte",
    );
    return json(c);
  } catch (err) {
    return fromError(err);
  }
}
