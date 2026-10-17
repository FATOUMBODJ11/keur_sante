"use client";

import type {
  AnnotatedCase,
  Consultation,
  Decision,
  EvalRun,
  LangPref,
  Providers,
  PublicUser,
  Soap,
  Stats,
} from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith("/api/auth/")) window.dispatchEvent(new Event("ks:logout"));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Erreur ${res.status}`);
  return data as T;
}

export interface NewConsultation {
  language: LangPref;
  consent_patient: boolean;
  consent_practitioner: boolean;
  patient_code?: string;
  patient?: { sex: string; birth_year: number | null };
}

export type CaseDraft = Omit<AnnotatedCase, "case_id" | "created_at" | "created_by">;

/** Client de l'API Keur Santé (équivalent du module `dt` de la maquette). */
export const dt = {
  me: () => call<{ user: PublicUser }>("/api/auth/me").then((r) => r.user),
  login: (email: string, password: string) =>
    call<{ user: PublicUser }>("/api/auth/login", { method: "POST", json: { email, password } }),
  register: (body: { full_name: string; facility: string; email: string; password: string }) =>
    call<{ user: PublicUser }>("/api/auth/register", { method: "POST", json: body }),
  logout: () => call("/api/auth/logout", { method: "POST" }).catch(() => {}),

  stats: () => call<Stats>("/api/stats"),
  providers: () => call<Providers>("/api/providers"),

  listConsultations: () => call<Consultation[]>("/api/consultations"),
  getConsultation: (id: string) => call<Consultation>(`/api/consultations/${id}`),
  createConsultation: (body: NewConsultation) => call<Consultation>("/api/consultations", { method: "POST", json: body }),
  submitTranscript: (id: string, text: string, source: "dictee" | "texte") =>
    call<Consultation>(`/api/consultations/${id}/transcript`, { method: "POST", json: { text, source } }),
  uploadAudio: (id: string, blob: Blob) => {
    const form = new FormData();
    form.append("audio", blob, "consultation.webm");
    return call<Consultation>(`/api/consultations/${id}/audio`, { method: "POST", body: form });
  },
  decide: (id: string, sid: string, decision: Decision) =>
    call<Consultation>(`/api/consultations/${id}/suggestions/${sid}`, { method: "PATCH", json: { decision } }),
  editSoap: (id: string, soap: Soap) => call<Consultation>(`/api/consultations/${id}/soap`, { method: "PATCH", json: soap }),
  validate: (id: string) => call<Consultation>(`/api/consultations/${id}/validate`, { method: "POST" }),
  archive: (id: string) => call<Consultation>(`/api/consultations/${id}/archive`, { method: "POST" }),
  exportText: (id: string) => call<{ text: string }>(`/api/consultations/${id}/export`).then((r) => r.text),

  listCases: () => call<AnnotatedCase[]>("/api/cases"),
  createCase: (c: CaseDraft) => call<AnnotatedCase>("/api/cases", { method: "POST", json: c }),
  updateCase: (id: string, c: CaseDraft) => call<AnnotatedCase>(`/api/cases/${id}`, { method: "PUT", json: c }),
  deleteCase: (id: string) => call(`/api/cases/${id}`, { method: "DELETE" }),

  listRuns: () => call<EvalRun[]>("/api/eval"),
  runEval: () => call<EvalRun>("/api/eval", { method: "POST" }),
};
