import "server-only";
import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AnnotatedCase, AuditEntry, Consultation, EvalRun, Lang, PatientRecord, User } from "@/lib/types";

/**
 * Stockage du prototype : un fichier JSON (data/keur-sante.json).
 * Suffisant pour un poste de démonstration ; à remplacer par une vraie base
 * pour un pilote. Aucun nom ni téléphone de patient n'y est stocké :
 * le patient n'est identifié que par un code pseudonyme (KS-P-000001).
 */

interface DB {
  users: User[];
  patients: PatientRecord[];
  consultations: Consultation[];
  cases: AnnotatedCase[];
  audit: AuditEntry[];
  evalRuns: EvalRun[];
  counters: { patient: number; consultation: number; evalRun: number; case_fr: number; case_wo: number };
}

const DATA_DIR = process.env.KS_DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "keur-sante.json");

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

function seed(): DB {
  return {
    users: [
      {
        id: "u_demo",
        email: "demo@keursante.sn",
        full_name: "Dr Awa Ndiaye",
        role: "medecin",
        facility: "Centre de santé de Grand-Yoff (démo)",
        passwordHash: hashPassword("keursante"),
      },
    ],
    patients: [],
    consultations: [],
    cases: [],
    audit: [],
    evalRuns: [],
    counters: { patient: 0, consultation: 0, evalRun: 0, case_fr: 0, case_wo: 0 },
  };
}

const g = globalThis as unknown as { __ksDb?: DB };

function load(): DB {
  if (g.__ksDb) return g.__ksDb;
  try {
    g.__ksDb = { ...seed(), ...(JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Partial<DB>) } as DB;
  } catch {
    g.__ksDb = seed();
    persist();
  }
  return g.__ksDb!;
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(g.__ksDb, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const now = () => new Date().toISOString();

export const db = {
  /* Utilisateurs */
  findUserByEmail(email: string) {
    return load().users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  },
  findUser(id: string) {
    return load().users.find((u) => u.id === id);
  },
  createUser(u: Omit<User, "id" | "role" | "passwordHash"> & { password: string }): User {
    const d = load();
    const user: User = {
      id: `u_${randomBytes(6).toString("hex")}`,
      email: u.email.trim().toLowerCase(),
      full_name: u.full_name.trim(),
      facility: u.facility.trim(),
      role: "medecin",
      passwordHash: hashPassword(u.password),
    };
    d.users.push(user);
    persist();
    return user;
  },

  /* Patients (pseudonymisés) */
  createPatient(doctorId: string, sex: PatientRecord["sex"], birthYear: number | null): PatientRecord {
    const d = load();
    d.counters.patient += 1;
    const p: PatientRecord = {
      code: `KS-P-${String(d.counters.patient).padStart(6, "0")}`,
      sex,
      birth_year: birthYear,
      doctor_id: doctorId,
      created_at: now(),
    };
    d.patients.push(p);
    persist();
    return p;
  },
  findPatient(doctorId: string, code: string) {
    return load().patients.find((p) => p.doctor_id === doctorId && p.code === code.trim().toUpperCase());
  },

  /* Consultations */
  nextConsultationId() {
    const d = load();
    d.counters.consultation += 1;
    return `C-${String(d.counters.consultation).padStart(5, "0")}`;
  },
  listConsultations(doctorId: string) {
    return load()
      .consultations.filter((c) => c.doctor_id === doctorId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  getConsultation(id: string) {
    return load().consultations.find((c) => c.id === id);
  },
  insertConsultation(c: Consultation) {
    load().consultations.push(c);
    persist();
    return c;
  },
  updateConsultation(id: string, patch: Partial<Consultation>) {
    const c = load().consultations.find((x) => x.id === id);
    if (!c) return undefined;
    Object.assign(c, patch, { updated_at: now() });
    persist();
    return c;
  },

  /* Jeu de cas annotés */
  listCases() {
    return [...load().cases].sort((a, b) => a.case_id.localeCompare(b.case_id));
  },
  getCase(id: string) {
    return load().cases.find((c) => c.case_id === id);
  },
  insertCase(c: Omit<AnnotatedCase, "case_id">): AnnotatedCase {
    const d = load();
    const key = c.language === "wo" ? "case_wo" : "case_fr";
    d.counters[key] += 1;
    const full: AnnotatedCase = { ...c, case_id: `KS-${(c.language as Lang).toUpperCase()}-${String(d.counters[key]).padStart(3, "0")}` };
    d.cases.push(full);
    persist();
    return full;
  },
  updateCase(id: string, patch: Partial<AnnotatedCase>) {
    const c = load().cases.find((x) => x.case_id === id);
    if (!c) return undefined;
    Object.assign(c, patch, { case_id: c.case_id });
    persist();
    return c;
  },
  deleteCase(id: string) {
    const d = load();
    const before = d.cases.length;
    d.cases = d.cases.filter((c) => c.case_id !== id);
    persist();
    return d.cases.length < before;
  },

  /* Audit */
  audit(entry: Omit<AuditEntry, "at">) {
    load().audit.push({ at: now(), ...entry });
    persist();
  },
  auditFor(consultationId: string) {
    return load().audit.filter((a) => a.consultation_id === consultationId);
  },

  /* Évaluations */
  listEvalRuns() {
    return [...load().evalRuns].sort((a, b) => b.id - a.id);
  },
  insertEvalRun(run: Omit<EvalRun, "id">): EvalRun {
    const d = load();
    d.counters.evalRun += 1;
    const full = { ...run, id: d.counters.evalRun };
    d.evalRuns.push(full);
    d.evalRuns = d.evalRuns.sort((a, b) => b.id - a.id).slice(0, 20);
    persist();
    return full;
  },
};
