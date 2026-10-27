import type { Lang, Turn } from "@/lib/types";
import { scribeEnabled, scribeForFrench } from "@/lib/features";
import { SCRIBE_API, SCRIBE_DEFAULT_MODEL, scribeLanguageCode, scribeToTurns, type ScribeResult } from "@/lib/scribe";
import { splitSentences } from "./transcript";

/**
 * Reconnaissance vocale.
 *
 * 1. ElevenLabs Scribe (recommandé) : français et wolof, avec séparation des voix.
 *    Le navigateur envoie l'audio directement à ElevenLabs avec un jeton à usage
 *    unique créé par le serveur (la clé API ne quitte jamais le serveur, et
 *    l'audio ne passe pas par Vercel, limité à 4,5 Mo par requête).
 *      ELEVENLABS_API_KEY   clé API (obligatoire)
 *      ELEVENLABS_STT_MODEL modèle (défaut : scribe_v2)
 *
 * 2. Service auto-hébergé (voir `services/asr/`), appelé en HTTP :
 *    Whisper pour le français, Kiriku-Wolof-ASR pour le wolof.
 *      ASR_FR_URL   ex. http://localhost:8001/v1/audio/transcriptions
 *      ASR_FR_MODEL ex. whisper-small (facultatif)
 *      ASR_WO_URL   ex. http://localhost:8001/v1/audio/transcriptions/wolof
 *      ASR_API_KEY  facultatif, envoyé en Bearer
 */

export class AsrUnavailableError extends Error {}

export const scribeModel = () => process.env.ELEVENLABS_STT_MODEL || SCRIBE_DEFAULT_MODEL;

export function asrConfig() {
  return {
    fr: process.env.ASR_FR_URL || null,
    wo: process.env.ASR_WO_URL || null,
    frModel: process.env.ASR_FR_MODEL || "whisper",
    scribe: scribeEnabled(),
    scribeFr: scribeForFrench(),
  };
}

/** Scribe est-il utilisé pour cette langue ? */
const usesScribe = (lang: Lang) => {
  const cfg = asrConfig();
  return lang === "wo" ? cfg.scribe : cfg.scribeFr;
};

export function asrProviderName(lang: Lang): string {
  const cfg = asrConfig();
  if (usesScribe(lang)) return `ElevenLabs Scribe (${scribeModel()})`;
  if (lang === "fr") return cfg.fr ? `Whisper (${cfg.frModel})` : "non configuré";
  return cfg.wo ? "Kiriku-Wolof-ASR" : "non configuré";
}

/** Jeton à usage unique (15 min) permettant au navigateur d'appeler Scribe sans connaître la clé. */
export async function createScribeToken(): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new AsrUnavailableError("Reconnaissance vocale ElevenLabs non configurée (ELEVENLABS_API_KEY).");
  const res = await fetch(`${SCRIBE_API}/single-use-token/batch_scribe`, {
    method: "POST",
    headers: { "xi-api-key": key },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs : création du jeton refusée (HTTP ${res.status}). Vérifiez la clé ELEVENLABS_API_KEY.`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("ElevenLabs : réponse sans jeton.");
  return data.token;
}

/** Transcription côté serveur par Scribe (repli de l'envoi direct par le navigateur). */
async function transcribeWithScribe(audio: Blob, lang: Lang): Promise<{ turns: Turn[]; result: ScribeResult }> {
  const form = new FormData();
  form.append("file", audio, "consultation.webm");
  form.append("model_id", scribeModel());
  form.append("language_code", scribeLanguageCode(lang));
  form.append("diarize", "true");
  form.append("tag_audio_events", "false");
  const res = await fetch(`${SCRIBE_API}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
    body: form,
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs Scribe : HTTP ${res.status} ${await res.text().catch(() => "")}`.trim());
  const result = (await res.json()) as ScribeResult;
  return { turns: scribeToTurns(result), result };
}

/** Transcrit un enregistrement ; les tours renvoyés peuvent déjà porter le locuteur (Scribe). */
export async function transcribe(audio: Blob, lang: Lang): Promise<Turn[]> {
  if (usesScribe(lang)) return (await transcribeWithScribe(audio, lang)).turns;

  const cfg = asrConfig();
  const url = lang === "fr" ? cfg.fr : cfg.wo;
  if (!url) {
    throw new AsrUnavailableError(
      lang === "fr"
        ? "Reconnaissance vocale française non configurée (ELEVENLABS_API_KEY ou ASR_FR_URL)."
        : "Reconnaissance vocale wolof non configurée (ELEVENLABS_API_KEY ou ASR_WO_URL).",
    );
  }
  const form = new FormData();
  form.append("file", audio, "consultation.webm");
  form.append("model", lang === "fr" ? cfg.frModel : "kiriku-wolof-asr");
  form.append("language", lang);
  form.append("response_format", "json");

  const headers: Record<string, string> = {};
  if (process.env.ASR_API_KEY) headers.Authorization = `Bearer ${process.env.ASR_API_KEY}`;

  const res = await fetch(url, { method: "POST", body: form, headers, signal: AbortSignal.timeout(300_000) });
  if (!res.ok) {
    throw new Error(`Service ASR (${lang}) : HTTP ${res.status} ${await res.text().catch(() => "")}`.trim());
  }
  const data = (await res.json()) as { text?: string };
  if (typeof data.text !== "string") throw new Error("Service ASR : réponse sans champ « text »");
  return splitSentences(data.text.trim());
}
