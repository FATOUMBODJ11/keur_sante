import "server-only";
import { AsrUnavailableError, runAgent, type AgentInput } from "@/lib/agent";
import { decidedAssessmentAndPlan } from "@/lib/agent/soap";
import { wolofEnabled } from "@/lib/features";
import { db } from "@/lib/store";
import type { Consultation, LangPref, Soap, SoapKey, User } from "@/lib/types";

export class ValidationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export interface NewConsultationInput {
  language?: LangPref;
  consent_patient?: boolean;
  consent_practitioner?: boolean;
  /** Patient déjà suivi. */
  patient_code?: string;
  /** Nouveau patient : seules ces données, jamais de nom. */
  patient?: { sex?: string; birth_year?: number | null };
}

export async function newConsultation(user: User, input: NewConsultationInput): Promise<Consultation> {
  if (!input.consent_patient || !input.consent_practitioner) {
    throw new ValidationError("Les deux consentements sont requis avant toute capture.");
  }
  let patient;
  if (input.patient_code) {
    patient = await db.findPatient(user.id, input.patient_code);
    if (!patient) throw new ValidationError("Code patient inconnu. Vérifiez le code, ou choisissez « Nouveau ».", 404);
  } else {
    const year = input.patient?.birth_year ?? null;
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())) {
      throw new ValidationError("Année de naissance invalide.");
    }
    const sex = input.patient?.sex === "F" || input.patient?.sex === "M" ? input.patient.sex : null;
    patient = await db.createPatient(user.id, sex, year);
  }
  // Wolof en pause : toutes les consultations sont en français.
  const language: LangPref = !wolofEnabled() ? "fr" : input.language === "fr" || input.language === "wo" ? input.language : "auto";
  const iso = new Date().toISOString();
  return {
    id: await db.nextConsultationId(),
    doctor_id: user.id,
    patient: { code: patient.code, sex: patient.sex, birth_year: patient.birth_year },
    language_requested: language,
    language_detected: null,
    language_confidence: null,
    consent: { patient: true, practitioner: true, at: iso },
    status: "recording",
    source: null,
    created_at: iso,
    updated_at: iso,
    motif: null,
    transcript_source: "",
    transcript_fr: "",
    extraction: null,
    soap_draft: null,
    soap_final: null,
    suggestions: [],
    steps: [],
    error: null,
    validated_at: null,
    validated_by: null,
    archived_at: null,
  };
}

/** Lance l'agent sur une consultation en attente de capture (ou en échec). */
export async function analyze(
  c: Consultation,
  user: User,
  input: Omit<AgentInput, "languagePref">,
  source: NonNullable<Consultation["source"]>,
): Promise<Consultation> {
  // Relance possible tant que le compte rendu n'est pas validé (transcription corrigée).
  const rerun = c.status === "review";
  if (c.status !== "recording" && c.status !== "failed" && !rerun) {
    throw new ValidationError("Cette consultation a déjà été validée : l'analyse ne peut plus être relancée.", 409);
  }
  await db.updateConsultation(c.id, { status: "processing", source: rerun ? (c.source ?? source) : source, error: null });
  await db.audit({
    user_id: user.id,
    action: rerun ? "analyse_relancee" : "analyse_lancee",
    consultation_id: c.id,
    detail: rerun ? "transcription corrigée par le praticien" : source,
  });

  try {
    const out = await runAgent({ ...input, languagePref: c.language_requested });
    const updated = (await db.updateConsultation(c.id, {
      status: "review",
      language_detected: out.language,
      language_confidence: out.languageConfidence,
      motif: out.extraction.motif,
      transcript_source: out.transcriptSource,
      transcript_fr: out.transcriptFr,
      extraction: out.extraction,
      soap_draft: out.soap,
      soap_final: out.soap,
      suggestions: out.suggestions,
      steps: out.steps,
    }))!;
    await db.audit({ user_id: user.id, action: "compte_rendu_genere", consultation_id: c.id, detail: out.language });
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // ASR indisponible : on revient à la capture pour permettre la dictée ou la saisie.
    const asr = err instanceof AsrUnavailableError;
    // En cas d'échec d'une relance, le compte rendu précédent reste disponible.
    await db.updateConsultation(c.id, { status: rerun ? "review" : asr ? "recording" : "failed", error: message });
    await db.audit({ user_id: user.id, action: "analyse_echouee", consultation_id: c.id, detail: message });
    throw new ValidationError(message, asr ? 503 : 500);
  }
}

export function assertEditable(c: Consultation) {
  if (c.status !== "review") throw new ValidationError("Compte rendu non modifiable dans cet état.", 409);
}

export const editedKeys = (c: Consultation): SoapKey[] =>
  c.soap_draft && c.soap_final
    ? (["S", "O", "A", "P"] as SoapKey[]).filter((k) => c.soap_draft![k].trim() !== c.soap_final![k].trim())
    : [];

export async function validate(c: Consultation, user: User): Promise<Consultation> {
  if (c.status === "validated" || c.status === "archived") throw new ValidationError("Consultation déjà validée.", 409);
  if (c.status !== "review" || !c.soap_final) throw new ValidationError("Seul un compte rendu à valider peut l'être.", 409);
  const pending = c.suggestions.filter((s) => s.type === "diagnostic" && s.decision === "pending");
  if (pending.length) {
    throw new ValidationError(`Retenez ou écartez chaque piste diagnostique avant de valider (${pending.length} en attente).`, 409);
  }
  // Les rubriques A et P que le médecin n'a pas réécrites reflètent ses décisions.
  const edited = editedKeys(c);
  const decided = decidedAssessmentAndPlan(c.suggestions);
  const soap: Soap = {
    ...c.soap_final,
    A: edited.includes("A") ? c.soap_final.A : decided.A,
    P: edited.includes("P") ? c.soap_final.P : decided.P,
  };
  const at = new Date().toISOString();
  const steps = c.steps.map((s) => (s.name === "validation_medecin" ? { ...s, status: "done" as const, detail: `Validé par ${user.full_name}` } : s));
  const updated = (await db.updateConsultation(c.id, {
    status: "validated",
    soap_final: soap,
    soap_edited: edited,
    steps,
    validated_at: at,
    validated_by: user.full_name,
  }))!;
  await db.audit({ user_id: user.id, action: "compte_rendu_valide", consultation_id: c.id, detail: "" });
  return updated;
}
