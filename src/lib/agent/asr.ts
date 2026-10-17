import type { Lang } from "@/lib/types";

/**
 * Reconnaissance vocale. Les modèles tournent dans un service séparé
 * (voir `services/asr/`), appelé en HTTP :
 *  - français : Whisper, via une route compatible `/v1/audio/transcriptions`
 *    (le service fourni, faster-whisper-server, whisper.cpp server…) ;
 *  - wolof : Kiriku-Wolof-ASR (AI Hub Senegal), servi par le même service.
 *
 * Variables d'environnement :
 *   ASR_FR_URL   ex. http://localhost:8001/v1/audio/transcriptions
 *   ASR_FR_MODEL ex. whisper-small (facultatif)
 *   ASR_WO_URL   ex. http://localhost:8001/v1/audio/transcriptions/wolof
 *   ASR_API_KEY  facultatif, envoyé en Bearer
 */

export class AsrUnavailableError extends Error {}

export function asrConfig() {
  return {
    fr: process.env.ASR_FR_URL || null,
    wo: process.env.ASR_WO_URL || null,
    frModel: process.env.ASR_FR_MODEL || "whisper",
  };
}

export function asrProviderName(lang: Lang): string {
  const cfg = asrConfig();
  if (lang === "fr") return cfg.fr ? `Whisper (${cfg.frModel})` : "non configuré";
  return cfg.wo ? "Kiriku-Wolof-ASR" : "non configuré";
}

export async function transcribe(audio: Blob, lang: Lang): Promise<string> {
  const cfg = asrConfig();
  const url = lang === "fr" ? cfg.fr : cfg.wo;
  if (!url) {
    throw new AsrUnavailableError(
      lang === "fr"
        ? "Reconnaissance vocale française non configurée (ASR_FR_URL)."
        : "Reconnaissance vocale wolof (Kiriku-Wolof-ASR) non configurée (ASR_WO_URL).",
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
  return data.text.trim();
}
