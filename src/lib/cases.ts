import "server-only";
import type { AnnotatedCase } from "@/lib/types";
import { ValidationError } from "@/lib/consultations";
import { wolofEnabled } from "@/lib/features";

/** Champs saisis par l'utilisateur pour un cas annoté. */
export type CaseInput = Partial<Omit<AnnotatedCase, "case_id" | "created_at" | "created_by">>;

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

const str = (v: unknown, max = 20_000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Valide et normalise un cas. Les annotations de référence restent celles du praticien. */
export function parseCase(input: CaseInput): Omit<AnnotatedCase, "case_id" | "created_at" | "created_by"> {
  const language = input.language === "wo" ? "wo" : input.language === "fr" ? "fr" : null;
  if (!language) throw new ValidationError("Langue du cas requise (français ou wolof).");
  if (language === "wo" && !wolofEnabled()) throw new ValidationError("Le wolof est en pause : seuls les cas en français sont acceptés.");
  const reference_transcript = str(input.reference_transcript);
  if (reference_transcript.length < 10) throw new ValidationError("La transcription de référence est requise.");
  const reference_diagnosis = str(input.reference_diagnosis, 200);
  if (!reference_diagnosis) throw new ValidationError("Le diagnostic de référence est requis.");
  const reference_transcript_fr = str(input.reference_transcript_fr);
  const asr_hypothesis = str(input.asr_hypothesis);
  return {
    language,
    scenario: str(input.scenario, 500),
    reference_transcript,
    ...(reference_transcript_fr ? { reference_transcript_fr } : {}),
    ...(asr_hypothesis ? { asr_hypothesis } : {}),
    reference_entities: {
      symptomes_presents: list(input.reference_entities?.symptomes_presents),
      constantes: list(input.reference_entities?.constantes),
    },
    reference_diagnosis,
    differentials: list(input.differentials),
    reference_plan: list(input.reference_plan),
    annotated_by: str(input.annotated_by, 200),
    validated: input.validated === true,
    source_consultation: input.source_consultation ?? null,
  };
}
