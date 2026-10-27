"use client";

import type { Lang, Turn } from "@/lib/types";
import { langFromScribe, scribeToTurns, type ScribeResult } from "@/lib/scribe";
import { dt } from "./api";

export interface ScribeTranscript {
  turns: Turn[];
  /** Langue détectée sur l'audio (null si Scribe en renvoie une autre). */
  lang: Lang | null;
  confidence: number;
}

/**
 * Transcription d'un enregistrement par ElevenLabs Scribe, avec séparation des voix.
 * Le serveur fournit un jeton à usage unique ; l'audio part directement du navigateur
 * vers ElevenLabs et n'est jamais stocké.
 */
export async function transcribeWithScribe(consultationId: string, audio: Blob): Promise<ScribeTranscript> {
  const t = await dt.scribeToken(consultationId);
  const form = new FormData();
  form.append("file", audio, audio.type.includes("mp4") ? "consultation.mp4" : "consultation.webm");
  form.append("model_id", t.model_id);
  if (t.language_code) form.append("language_code", t.language_code);
  form.append("diarize", "true");
  form.append("tag_audio_events", "false");
  let res: Response;
  try {
    res = await fetch(`${t.url}?token=${encodeURIComponent(t.token)}`, { method: "POST", body: form });
  } catch {
    throw new Error("Impossible de joindre ElevenLabs. Vérifiez la connexion internet, puis réessayez.");
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Transcription ElevenLabs refusée (HTTP ${res.status}). ${detail.slice(0, 200)}`.trim());
  }
  const result = (await res.json()) as ScribeResult;
  return {
    turns: scribeToTurns(result),
    lang: langFromScribe(result.language_code),
    confidence: typeof result.language_probability === "number" ? result.language_probability : 1,
  };
}
