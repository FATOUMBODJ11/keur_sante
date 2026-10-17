"use client";

/*
 * Dictée du navigateur (Web Speech API) : transcription française en direct,
 * sans serveur. Disponible dans Chrome et Edge ; l'audio y est traité par le
 * service de reconnaissance du navigateur (Google ou Microsoft). Le wolof
 * n'est pas pris en charge : il passe par le serveur Kiriku-Wolof-ASR.
 */

interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  isFinal: boolean;
  0: SpeechAlternative;
}
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface SpeechErrorEvent {
  error: string;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const dictationSupported = () => ctor() !== null;

export interface DictationHandlers {
  /** Segment terminé (phrase stabilisée). */
  onFinal: (text: string) => void;
  /** Texte provisoire en cours de reconnaissance. */
  onInterim: (text: string) => void;
  onError: (message: string) => void;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "L'accès au micro a été refusé. Autorisez-le dans le navigateur, ou utilisez la saisie.",
  "service-not-allowed": "La dictée du navigateur est désactivée. Utilisez la saisie, ou le serveur Whisper.",
  network: "La dictée du navigateur nécessite une connexion internet.",
  "audio-capture": "Aucun micro détecté sur cet appareil.",
  "language-not-supported": "Langue non prise en charge par la dictée du navigateur.",
};

/** Démarre une dictée continue ; renvoie la fonction d'arrêt. */
export function startDictation(lang: string, h: DictationHandlers): () => void {
  const Ctor = ctor();
  if (!Ctor) {
    h.onError("La dictée en direct n'est pas disponible dans ce navigateur. Utilisez Chrome ou Edge, ou la saisie.");
    return () => {};
  }
  let active = true;
  let rec: Recognition | null = null;

  const launch = () => {
    rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (!text) continue;
        if (r.isFinal) h.onFinal(text);
        else interim += `${text} `;
      }
      h.onInterim(interim.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      active = false;
      h.onError(ERRORS[e.error] ?? `Dictée interrompue (${e.error}).`);
    };
    // Le navigateur coupe la reconnaissance après un silence : on la relance.
    rec.onend = () => {
      if (active) {
        try {
          launch();
        } catch {
          /* déjà relancée */
        }
      }
    };
    rec.start();
  };

  try {
    launch();
  } catch (err) {
    h.onError((err as Error).message);
  }

  return () => {
    active = false;
    try {
      rec?.stop();
    } catch {}
  };
}
