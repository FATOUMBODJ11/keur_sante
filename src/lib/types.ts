/* Modèle de données — aligné sur la maquette « Keur Santé.html ». */

export type Lang = "fr" | "wo";
export type LangPref = Lang | "auto";

export type ConsultationStatus =
  | "recording" // consultation ouverte, consentement recueilli, capture en attente
  | "processing" // l'agent travaille
  | "review" // compte rendu à valider
  | "validated" // validé par le praticien, lecture seule
  | "archived"
  | "failed";

export type Speaker = "medecin" | "patient" | "accompagnant" | "";

export interface Turn {
  who: Speaker;
  text: string;
}

export interface Symptom {
  nom: string;
  present: boolean;
  duree: string | null;
  /** Phrase de la transcription d'où provient l'information. */
  source: string | null;
}

export interface Vital {
  nom: string;
  valeur: string;
  unite: string;
}

export interface Extraction {
  motif: string | null;
  duree: string | null;
  symptomes: Symptom[];
  localisations: string[];
  antecedents: string[];
  traitements: string[];
  constantes: Vital[];
  observations: string[];
  autres: string[];
}

export interface Soap {
  S: string;
  O: string;
  A: string;
  P: string;
}

export type SoapKey = keyof Soap;

export type Decision = "pending" | "accepted" | "rejected";

export interface Suggestion {
  id: string;
  type: "diagnostic" | "prise_en_charge" | "alerte";
  label: string;
  /** Code CIM-10, pour un diagnostic. */
  code: string | null;
  /** Score de concordance calculé par l'agent (0–1). */
  confiance: number | null;
  arguments_pour: string[];
  arguments_contre: string[];
  /** Pour une prise en charge : diagnostic auquel elle se rattache. */
  lie_a: string | null;
  decision: Decision;
  decided_at?: string;
}

export type StepName =
  | "detection_langue"
  | "reconnaissance_vocale"
  | "traduction"
  | "extraction_clinique"
  | "suggestions_diagnostiques"
  | "generation_soap"
  | "validation_medecin"
  | "archivage";

export interface Step {
  name: StepName;
  status: "done" | "skipped" | "error" | "pending";
  provider: string;
  duration_ms: number | null;
  detail: string;
}

export interface Patient {
  code: string;
  sex: "F" | "M" | null;
  birth_year: number | null;
}

export interface PatientRecord extends Patient {
  doctor_id: string;
  created_at: string;
  /** Dossier : informations conservées d'une consultation à l'autre. */
  allergies?: string[];
  antecedents?: string[];
  traitements?: string[];
  notes?: string;
  updated_at?: string;
}

/** Contexte du patient transmis à l'agent pour l'analyse. */
export interface PatientContext {
  age: number | null;
  sex: "F" | "M" | null;
  allergies: string[];
  antecedents: string[];
  traitements: string[];
}

export interface Consultation {
  id: string;
  doctor_id: string;
  patient: Patient;
  language_requested: LangPref;
  language_detected: Lang | null;
  language_confidence: number | null;
  consent: { patient: boolean; practitioner: boolean; at: string };
  status: ConsultationStatus;
  /** audio : enregistrement transcrit par le serveur ASR ; dictee : reconnaissance vocale du navigateur ; texte : saisie. */
  source: "audio" | "dictee" | "texte" | null;
  created_at: string;
  updated_at: string;
  motif: string | null;
  /** Transcription d'origine, une ligne par tour (« Médecin: … »). */
  transcript_source: string;
  /** Transcription en français (traduite si la consultation est en wolof). */
  transcript_fr: string;
  extraction: Extraction | null;
  /** Proposition de l'agent. */
  soap_draft: Soap | null;
  /** Version relue par le médecin. */
  soap_final: Soap | null;
  /** Rubriques réécrites par le médecin (figé à la validation). */
  soap_edited?: SoapKey[];
  suggestions: Suggestion[];
  steps: Step[];
  error: string | null;
  validated_at: string | null;
  validated_by: string | null;
  archived_at: string | null;
}

export type StructureType = "hopital" | "centre_sante" | "clinique" | "cabinet" | "poste_sante" | "autre";

export interface User {
  id: string;
  email: string;
  full_name: string;
  /** admin : administrateur de la plateforme (KS_ADMIN_EMAILS). */
  role: "medecin" | "admin";
  /** Médecin validateur : établit les références du jeu de cas (§ 7). */
  validator?: boolean;
  facility: string;
  structure_type?: StructureType;
  specialty?: string;
  created_at?: string;
  failed_logins?: number;
  locked_until?: string | null;
  passwordHash: string;
}

export type PublicUser = Omit<User, "passwordHash" | "failed_logins" | "locked_until">;

export interface PasswordReset {
  token_hash: string;
  user_id: string;
  expires_at: string;
  used: boolean;
}

/** Questionnaire SUS (System Usability Scale) : 10 réponses de 1 à 5. */
export interface UsabilitySurvey {
  id: string;
  user_id: string;
  user_name: string;
  answers: number[];
  score: number;
  time_saved_minutes: number | null;
  comment: string;
  created_at: string;
}

export interface AuditEntry {
  at: string;
  user_id: string;
  action: string;
  consultation_id: string | null;
  detail: string;
}

/* ---------- Jeu de cas annotés (§ 7 du cahier des charges) ---------- */

export interface AnnotatedCase {
  case_id: string;
  language: Lang;
  scenario: string;
  reference_transcript: string;
  /** Traduction française de référence (cas en wolof). */
  reference_transcript_fr?: string;
  /** Sortie brute d'un modèle ASR sur l'enregistrement, pour mesurer le WER. */
  asr_hypothesis?: string;
  reference_entities: { symptomes_presents: string[]; constantes: string[] };
  reference_diagnosis: string;
  differentials: string[];
  reference_plan: string[];
  /** Famille de pathologies (infectieux, respiratoire…), pour les résultats par famille. */
  family?: string;
  annotated_by: string;
  validated: boolean;
  /** Seconde annotation par le même médecin, plus tard et sans voir la première (accord intra-annotateur). */
  reannotation?: { reference_diagnosis: string; symptomes_presents: string[]; at: string } | null;
  created_at: string;
  created_by: string;
  /** Consultation dont provient la transcription, le cas échéant. */
  source_consultation?: string | null;
}

export interface PRF {
  precision: number;
  rappel: number;
  f1: number;
  manquants: string[];
  en_trop: string[];
}

export interface CaseResult {
  case_id: string;
  langue: Lang;
  family: string;
  diagnostic_reference: string;
  diagnostics_ia: string[];
  langue_detectee: Lang;
  langue_ok: boolean;
  extraction_symptomes: PRF;
  extraction_constantes: PRF;
  /** Sur la transcription française de référence (isole la traduction). */
  diagnostic: { top1: boolean; top3: boolean; rang: number | null };
  /** Sur la transcription d'origine, traduction comprise. */
  diagnostic_bout_en_bout: { top1: boolean; top3: boolean; rang: number | null };
  plan_concordance: number;
  soap_completude: number;
  wer: number | null;
  traduction_f1: number | null;
}

export interface EvalSummary {
  n_cas: number;
  n_valides: number;
  diagnostic_top1: number;
  diagnostic_top3: number;
  extraction_symptomes_f1: number;
  extraction_constantes_f1: number;
  plan_concordance: number;
  soap_completude: number;
  detection_langue_exactitude: number;
  traduction_f1: number | null;
  wer_moyen: number | null;
  par_langue: Partial<Record<Lang, { n: number; top1: number; top1_bout_en_bout: number }>>;
  par_famille: Record<string, { n: number; top1: number; top3: number; symptomes_f1: number }>;
  /** Accord intra-annotateur sur les cas réannotés (même médecin, plus tard). */
  accord_intra: { n: number; diagnostic_concordance: number | null; kappa: number | null; symptomes_jaccard: number | null };
}

export interface EvalRun {
  id: number;
  created_at: string;
  created_by: string;
  config: Record<string, string>;
  summary: EvalSummary;
  per_case: CaseResult[];
}

export interface Providers {
  asr_fr: string;
  asr_wo: string;
  kiriku_model: string | null;
  translation: string;
  llm: string;
  llm_model: string | null;
  asr_fr_ready: boolean;
  asr_wo_ready: boolean;
  /** Le micro passe par ElevenLabs Scribe (envoi direct depuis le navigateur, voix séparées). */
  scribe_fr: boolean;
  scribe_wo: boolean;
  /** Wolof activé (ELEVENLABS_API_KEY ou KS_WOLOF=on) ; sinon l'application est en français seul. */
  wolof_enabled: boolean;
}

export interface Stats {
  total: number;
  par_statut: Partial<Record<ConsultationStatus, number>>;
  decisions_diagnostiques: { accepted: number; rejected: number; pending: number };
  /** Diagnostics les plus souvent retenus par le praticien. */
  top_diagnostics: { label: string; n: number }[];
  /** Consultations par semaine (8 dernières semaines, de la plus ancienne à la plus récente). */
  par_semaine: { semaine: string; n: number }[];
  /** Délai médian entre l'ouverture et la validation du compte rendu (minutes). */
  delai_validation_median: number | null;
  patients: number;
}
