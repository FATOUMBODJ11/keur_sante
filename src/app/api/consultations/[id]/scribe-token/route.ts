import type { NextRequest } from "next/server";
import { error, json, requireConsultation } from "@/lib/api";
import { createScribeToken, scribeModel } from "@/lib/agent/asr";
import { scribeEnabled, scribeForFrench, wolofEnabled } from "@/lib/features";
import { SCRIBE_API, scribeLanguageCode } from "@/lib/scribe";
import { db } from "@/lib/store";

/**
 * Jeton ElevenLabs Scribe à usage unique (15 min) pour une consultation en cours de capture.
 * Le navigateur envoie l'audio directement à ElevenLabs : la clé API reste sur le
 * serveur et l'audio ne transite ni par Vercel ni par la base (il n'est jamais stocké).
 */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/consultations/[id]/scribe-token">) {
  const { id } = await ctx.params;
  const g = await requireConsultation(id);
  if (!g.ok) return g.response;
  const { c, user } = g.value;
  if (c.status !== "recording" && c.status !== "failed") return error(409, "La capture de cette consultation est terminée.");
  const lang = c.language_requested;
  const allowed = lang === "fr" ? scribeForFrench() : wolofEnabled() && scribeEnabled();
  if (!allowed) return error(503, "Reconnaissance vocale ElevenLabs non configurée pour cette langue.");
  try {
    const token = await createScribeToken();
    await db.audit({ user_id: user.id, action: "transcription_audio", consultation_id: c.id, detail: "ElevenLabs Scribe" });
    return json({
      token,
      url: `${SCRIBE_API}/speech-to-text`,
      model_id: scribeModel(),
      // En détection automatique, Scribe identifie lui-même la langue.
      language_code: lang === "auto" ? null : scribeLanguageCode(lang),
    });
  } catch (err) {
    // Messages sans secret (la clé n'y figure jamais).
    console.error(err);
    return error(502, err instanceof Error ? err.message : "ElevenLabs indisponible.");
  }
}
