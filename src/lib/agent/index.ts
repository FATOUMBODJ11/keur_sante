import type { Extraction, Lang, LangPref, PatientContext, Providers, Soap, Step, StepName, Suggestion, Turn } from "@/lib/types";
import { AsrUnavailableError, asrConfig, asrProviderName, transcribe } from "./asr";
import { extractWithLlm, extractWithRules } from "./extract";
import { detectLanguage } from "./language";
import { LLM_MODEL, llmEnabled, llmErrorMessage } from "./llm";
import { buildSoap } from "./soap";
import { suggestWithKnowledgeBase, suggestWithLlm } from "./suggest";
import { inferSpeakers } from "./speakers";
import { splitSentences, turnsToText } from "./transcript";
import { translateWithGlossary, translateWithLlm } from "./translate";
import { wolofEnabled } from "@/lib/features";

/**
 * Agent Keur Santé (§ 6 du cahier des charges).
 * Il enchaîne des outils spécialisés et trace chaque décision :
 *   langue → reconnaissance vocale → traduction → extraction → pistes → SOAP
 *   → validation médecin (humain) → archivage.
 * Chaque outil a un repli hors-ligne : si le LLM échoue, l'agent continue
 * avec le moteur de règles et le signale dans la trace.
 */

export interface AgentInput {
  /** Transcription texte (saisie, ou dictée du navigateur). */
  turns?: Turn[];
  /** Enregistrement audio, transcrit par le serveur ASR. */
  audio?: Blob;
  languagePref: LangPref;
  /** Fournisseur de la transcription quand elle arrive déjà sous forme de texte. */
  transcriptProvider?: string;
  /** Langue détectée sur l'audio par la reconnaissance vocale (utilisée en détection automatique). */
  detectedLanguage?: { lang: Lang; confidence: number; provider: string };
  /** Dossier du patient (âge, allergies, antécédents…), pris en compte par l'analyse. */
  patient?: PatientContext;
}

export interface AgentOutput {
  language: Lang;
  languageConfidence: number;
  transcriptSource: string;
  transcriptFr: string;
  extraction: Extraction;
  soap: Soap;
  suggestions: Suggestion[];
  steps: Step[];
}

export const STEP_ORDER: StepName[] = [
  "detection_langue",
  "reconnaissance_vocale",
  "traduction",
  "extraction_clinique",
  "suggestions_diagnostiques",
  "generation_soap",
  "validation_medecin",
];

class Trace {
  steps: Step[] = STEP_ORDER.map((name) => ({ name, status: "pending", provider: "", duration_ms: null, detail: "" }));
  set(name: StepName, patch: Partial<Step>) {
    Object.assign(this.steps.find((x) => x.name === name)!, patch);
  }
}

const llmLabel = () => `Claude (${LLM_MODEL})`;
const since = (t0: number) => Math.round(performance.now() - t0);

/** Exécute un outil LLM avec repli sur l'outil hors-ligne. */
async function withFallback<T>(
  llm: () => Promise<T>,
  offline: () => T,
  offlineName: string,
): Promise<{ value: T; provider: string; note: string }> {
  if (!llmEnabled()) return { value: offline(), provider: offlineName, note: "" };
  try {
    return { value: await llm(), provider: llmLabel(), note: "" };
  } catch (err) {
    return { value: offline(), provider: `${offlineName} (repli)`, note: `LLM indisponible : ${llmErrorMessage(err)}. ` };
  }
}

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const trace = new Trace();
  let transcript: Turn[];
  let lang: Lang;
  let confidence: number;

  /* 1–2. Langue et reconnaissance vocale */
  if (input.audio) {
    const audio = input.audio;
    const cfg = asrConfig();
    if (input.languagePref !== "auto") {
      lang = input.languagePref;
      confidence = 1;
      trace.set("detection_langue", { status: "done", provider: "choix du praticien", detail: lang, duration_ms: 0 });
      const t0 = performance.now();
      transcript = await transcribe(audio, lang);
      trace.set("reconnaissance_vocale", { status: "done", provider: asrProviderName(lang), duration_ms: since(t0), detail: `${transcript.length} segments` });
    } else {
      if (!cfg.fr && !cfg.wo && !cfg.scribe) {
        throw new AsrUnavailableError("Reconnaissance vocale non configurée (ELEVENLABS_API_KEY, ou ASR_FR_URL / ASR_WO_URL).");
      }
      // Détection automatique : première passe en français, puis en wolof si l'on reconnaît du wolof.
      const t0 = performance.now();
      const firstLang: Lang = cfg.fr || cfg.scribeFr ? "fr" : "wo";
      transcript = await transcribe(audio, firstLang);
      const guess = detectLanguage(transcript);
      lang = guess.lang;
      confidence = guess.confidence;
      let provider = asrProviderName(firstLang);
      if (lang !== firstLang && asrProviderName(lang) !== "non configuré") {
        transcript = await transcribe(audio, lang);
        provider = `${provider} → ${asrProviderName(lang)}`;
      }
      trace.set("detection_langue", { status: "done", provider: "lexical", duration_ms: 0, detail: `${lang} (confiance ${confidence.toFixed(2)})` });
      trace.set("reconnaissance_vocale", { status: "done", provider, duration_ms: since(t0), detail: `${transcript.length} segments` });
    }
  } else {
    transcript = input.turns ?? [];
    const guess = detectLanguage(transcript);
    if (input.languagePref === "auto" && input.detectedLanguage) {
      // Langue identifiée par la reconnaissance vocale (Scribe) sur l'audio.
      lang = input.detectedLanguage.lang;
      confidence = input.detectedLanguage.confidence;
      trace.set("detection_langue", { status: "done", provider: input.detectedLanguage.provider, duration_ms: 0, detail: `${lang} (confiance ${confidence.toFixed(2)})` });
    } else if (input.languagePref === "auto") {
      lang = guess.lang;
      confidence = guess.confidence;
      trace.set("detection_langue", { status: "done", provider: "lexical", duration_ms: 0, detail: `${lang} (confiance ${confidence.toFixed(2)})` });
    } else {
      lang = input.languagePref;
      confidence = 1;
      const mismatch = guess.lang !== lang ? ` — l'analyse lexicale suggère « ${guess.lang} »` : "";
      trace.set("detection_langue", { status: "done", provider: "choix du praticien", duration_ms: 0, detail: `${lang}${mismatch}` });
    }
    trace.set(
      "reconnaissance_vocale",
      input.transcriptProvider
        ? { status: "done", provider: input.transcriptProvider, duration_ms: null, detail: `${transcript.length} segments, transcrits pendant la consultation` }
        : { status: "skipped", provider: "transcription saisie", detail: "" },
    );
  }

  // Tours sans locuteur (ASR, dictée, saisie libre) : attribution automatique Médecin / Patient.
  transcript = inferSpeakers(transcript);

  /* 3. Traduction */
  let transcriptFr = transcript;
  if (lang === "wo") {
    const t0 = performance.now();
    const r = await withFallback(() => translateWithLlm(transcript), () => translateWithGlossary(transcript), "glossaire wolof→français (démo)");
    transcriptFr = r.value;
    trace.set("traduction", { status: "done", provider: r.provider, duration_ms: since(t0), detail: `${r.note}${transcript.length} tours traduits` });
  } else {
    trace.set("traduction", { status: "skipped", provider: "consultation en français", detail: "" });
  }

  /* 4. Extraction clinique */
  const t4 = performance.now();
  const ex = await withFallback(() => extractWithLlm(transcriptFr), () => extractWithRules(transcriptFr), "règles");
  const extraction = ex.value;
  trace.set("extraction_clinique", {
    status: "done",
    provider: ex.provider,
    duration_ms: since(t4),
    detail: `${ex.note}${extraction.symptomes.filter((s) => s.present).length} symptômes, ${extraction.constantes.length} constantes`,
  });

  /* 5. Pistes diagnostiques */
  const t5 = performance.now();
  const sg = await withFallback(
    () => suggestWithLlm(extraction, transcriptFr, input.patient),
    () => suggestWithKnowledgeBase(extraction, transcriptFr, input.patient),
    "base de connaissances v1",
  );
  const suggestions = sg.value;
  const nDx = suggestions.filter((s) => s.type === "diagnostic").length;
  const nAl = suggestions.filter((s) => s.type === "alerte").length;
  trace.set("suggestions_diagnostiques", {
    status: "done",
    provider: sg.provider,
    duration_ms: since(t5),
    detail: `${sg.note}${nDx} piste(s)${nAl ? `, ${nAl} signe(s) d'alerte` : ""}`,
  });

  /* 6. SOAP */
  const t6 = performance.now();
  const soap = buildSoap(extraction, suggestions, input.patient);
  trace.set("generation_soap", { status: "done", provider: "gabarit SOAP v1", duration_ms: since(t6), detail: "S, O, A, P" });

  /* 7. Validation : l'agent s'arrête ici, la suite appartient au médecin. */
  trace.set("validation_medecin", { status: "pending", provider: "humain", detail: "" });

  return {
    language: lang,
    languageConfidence: confidence,
    transcriptSource: turnsToText(transcript),
    transcriptFr: turnsToText(transcriptFr),
    extraction,
    soap,
    suggestions,
    steps: trace.steps,
  };
}

export function providersInfo(): Providers {
  const asr = asrConfig();
  const wolof = wolofEnabled();
  return {
    asr_fr: asr.scribeFr ? asrProviderName("fr") : asr.fr ? `Whisper (${asr.frModel})` : "Dictée du navigateur",
    asr_wo: !wolof
      ? "En pause"
      : asr.scribe
        ? asrProviderName("wo")
        : asr.wo
          ? "Kiriku-Wolof-ASR (AI Hub Senegal)"
          : "Reconnaissance vocale wolof non configurée",
    kiriku_model: wolof && !asr.scribe && asr.wo ? process.env.KIRIKU_MODEL_ID || "AIHubSN/Kiriku-Wolof-ASR" : null,
    scribe_fr: asr.scribeFr,
    scribe_wo: wolof && asr.scribe,
    translation: !wolof ? "Non utilisée (français seul)" : llmEnabled() ? llmLabel() : "Glossaire wolof → français",
    llm: llmEnabled() ? "Claude" : "Règles hors-ligne",
    llm_model: llmEnabled() ? LLM_MODEL : null,
    asr_fr_ready: !!asr.fr,
    asr_wo_ready: wolof && !!asr.wo,
    wolof_enabled: wolof,
  };
}

export { AsrUnavailableError };
