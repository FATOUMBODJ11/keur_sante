import type { NextRequest } from "next/server";
import { error, fromError, json, requireConsultation } from "@/lib/api";
import { analyze } from "@/lib/consultations";

// 60 s : limite du plan gratuit de Vercel.
export const maxDuration = 60;

/**
 * Analyse d'un enregistrement audio (multipart, champ « audio »).
 * L'audio est transmis au service ASR puis abandonné : il n'est jamais stocké.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/consultations/[id]/audio">) {
  const { id } = await ctx.params;
  const g = await requireConsultation(id);
  if (!g.ok) return g.response;
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return error(400, "Aucun enregistrement reçu.");
  if (audio.size > 50 * 1024 * 1024) return error(413, "Enregistrement trop volumineux (50 Mo max).");
  try {
    return json(await analyze(g.value.c, g.value.user, { audio }, "audio"));
  } catch (err) {
    return fromError(err);
  }
}
