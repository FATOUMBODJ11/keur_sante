import "server-only";
import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import type {
  AnnotatedCase,
  AuditEntry,
  Consultation,
  EvalRun,
  Lang,
  PasswordReset,
  PatientRecord,
  UsabilitySurvey,
  User,
} from "@/lib/types";

/**
 * Stockage de Keur Santé, sous forme de documents JSON rangés par collection.
 *
 *  - En ligne : Postgres (Supabase), dès que DATABASE_URL est défini.
 *    Utilisez la chaîne « Transaction pooler » de Supabase (port 6543) sur Vercel.
 *  - En local : un fichier JSON (data/keur-sante.json), sans aucune installation.
 *
 * Aucun nom ni téléphone de patient n'est stocké : le patient n'est identifié
 * que par un code pseudonyme (KS-P-000001).
 */

type Collection = "users" | "patients" | "consultations" | "cases" | "audit" | "evalRuns" | "resets" | "surveys";

interface Backend {
  get<T>(col: Collection, id: string): Promise<T | undefined>;
  /** Documents d'une collection, du plus ancien au plus récent ; filtrés par propriétaire si fourni. */
  list<T>(col: Collection, owner?: string): Promise<T[]>;
  put(col: Collection, id: string, data: unknown, owner?: string | null): Promise<void>;
  remove(col: Collection, id: string): Promise<boolean>;
  /** Incrémente un compteur et renvoie sa nouvelle valeur (atomique en Postgres). */
  next(name: string): Promise<number>;
}

/* ------------------------------------------------------------------ */
/* Postgres (Supabase)                                                 */
/* ------------------------------------------------------------------ */

export const SCHEMA_SQL = `
create table if not exists ks_docs (
  collection text not null,
  id         text not null,
  owner      text,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists ks_docs_owner on ks_docs (collection, owner);
create table if not exists ks_counters (
  name  text primary key,
  value integer not null default 0
);
-- Accès réservé au serveur : l'API REST publique de Supabase ne voit rien.
alter table ks_docs enable row level security;
alter table ks_counters enable row level security;
`;

function pgBackend(url: string): Backend {
  // prepare:false : obligatoire avec le pooler en mode transaction de Supabase.
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const sql = postgres(url, { prepare: false, ssl: local ? false : "require", max: 3, idle_timeout: 20, connect_timeout: 15 });
  let ready: Promise<void> | null = null;
  const init = () => (ready ??= sql.unsafe(SCHEMA_SQL).then(() => undefined));

  return {
    async get<T>(col: Collection, id: string) {
      await init();
      const rows = await sql`select data from ks_docs where collection = ${col} and id = ${id}`;
      return rows[0]?.data as T | undefined;
    },
    async list<T>(col: Collection, owner?: string) {
      await init();
      const rows = owner
        ? await sql`select data from ks_docs where collection = ${col} and owner = ${owner} order by created_at, id`
        : await sql`select data from ks_docs where collection = ${col} order by created_at, id`;
      return rows.map((r) => r.data as T);
    },
    async put(col: Collection, id: string, data: unknown, owner: string | null = null) {
      await init();
      await sql`
        insert into ks_docs (collection, id, owner, data)
        values (${col}, ${id}, ${owner}, ${sql.json(data as postgres.JSONValue)})
        on conflict (collection, id) do update set data = excluded.data, owner = excluded.owner`;
    },
    async remove(col: Collection, id: string) {
      await init();
      const rows = await sql`delete from ks_docs where collection = ${col} and id = ${id} returning id`;
      return rows.length > 0;
    },
    async next(name: string) {
      await init();
      const rows = await sql`
        insert into ks_counters (name, value) values (${name}, 1)
        on conflict (name) do update set value = ks_counters.value + 1
        returning value`;
      return rows[0].value as number;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Fichier JSON (développement local)                                  */
/* ------------------------------------------------------------------ */

interface FileData {
  docs: Record<string, Record<string, { owner: string | null; data: unknown }>>;
  counters: Record<string, number>;
}

function fileBackend(): Backend {
  const dir = process.env.KS_DATA_DIR || path.join(process.cwd(), "data");
  const file = path.join(dir, "keur-sante.json");
  const g = globalThis as unknown as { __ksFile?: FileData };
  const load = (): FileData => {
    if (!g.__ksFile) {
      try {
        g.__ksFile = JSON.parse(fs.readFileSync(file, "utf8")) as FileData;
        if (!g.__ksFile.docs) throw new Error("ancien format");
      } catch {
        g.__ksFile = { docs: {}, counters: {} };
      }
    }
    return g.__ksFile;
  };
  const save = () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(g.__ksFile, null, 2));
    fs.renameSync(`${file}.tmp`, file);
  };
  const col = (c: Collection) => (load().docs[c] ??= {});

  return {
    async get<T>(c: Collection, id: string) {
      return col(c)[id]?.data as T | undefined;
    },
    async list<T>(c: Collection, owner?: string) {
      return Object.values(col(c))
        .filter((d) => !owner || d.owner === owner)
        .map((d) => d.data as T);
    },
    async put(c: Collection, id: string, data: unknown, owner: string | null = null) {
      col(c)[id] = { owner, data };
      save();
    },
    async remove(c: Collection, id: string) {
      const had = id in col(c);
      delete col(c)[id];
      save();
      return had;
    },
    async next(name: string) {
      const d = load();
      d.counters[name] = (d.counters[name] ?? 0) + 1;
      save();
      return d.counters[name];
    },
  };
}

/* ------------------------------------------------------------------ */

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const g = globalThis as unknown as { __ksBackend?: Backend };
const backend = (): Backend => (g.__ksBackend ??= dbUrl ? pgBackend(dbUrl) : fileBackend());

export const storageKind = () => (dbUrl ? "postgres" : "fichier");

/** Erreurs fréquentes de chaîne de connexion Supabase, détectées sans se connecter. */
function urlHint(url: string): string | null {
  if (/\[YOUR-PASSWORD\]|\[|\]/.test(url)) return "DATABASE_URL contient encore « [YOUR-PASSWORD] » ou des crochets : remplacez-les par le mot de passe de la base.";
  if (/@db\.[a-z0-9]+\.supabase\.co/.test(url)) return "DATABASE_URL utilise la connexion directe (db.….supabase.co) : prenez la chaîne « Shared pooler / Transaction pooler » (….pooler.supabase.com:6543).";
  if (/pooler\.supabase\.com:5432/.test(url)) return "DATABASE_URL utilise le port 5432 (mode session) : prenez le port 6543 (mode transaction).";
  if (/pooler\.supabase\.com/.test(url) && /\/\/postgres:/.test(url)) return "Avec le pooler, l'utilisateur doit être « postgres.<identifiant-du-projet> » et non « postgres ».";
  return null;
}

/** Vérifie la base : chaîne de connexion plausible, connexion et création des tables. */
export async function checkDatabase(): Promise<{ kind: string; ok: boolean; message: string }> {
  if (!dbUrl) {
    return {
      kind: "fichier",
      ok: process.env.NODE_ENV !== "production",
      message:
        process.env.NODE_ENV === "production"
          ? "DATABASE_URL n'est pas défini : en ligne, les données seraient perdues. Ajoutez la chaîne Supabase dans Vercel puis redéployez."
          : "Stockage local (data/keur-sante.json).",
    };
  }
  const hint = urlHint(dbUrl);
  if (hint) return { kind: "postgres", ok: false, message: hint };
  try {
    await backend().list("users");
    return { kind: "postgres", ok: true, message: "Connexion à Postgres réussie, tables prêtes." };
  } catch (err) {
    return { kind: "postgres", ok: false, message: describeDbError(err) };
  }
}

/** Message d'erreur de base de données lisible, sans jamais révéler la chaîne de connexion. */
export function describeDbError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const hint = dbUrl ? urlHint(dbUrl) : null;
  if (hint) return hint;
  const msg = (e?.message ?? String(err)).replace(/postgres(ql)?:\/\/\S+/g, "[chaîne masquée]");
  if (e?.code === "28P01" || /password authentication failed/i.test(msg)) return "Mot de passe de la base refusé : vérifiez celui placé dans DATABASE_URL (ou réinitialisez-le dans Supabase).";
  if (/tenant(\/| or )user .*not found/i.test(msg)) return "Utilisateur inconnu du pooler : l'utilisateur doit être « postgres.<identifiant-du-projet> ».";
  if (e?.code === "ENOTFOUND" || /getaddrinfo/i.test(msg)) return "Adresse de la base introuvable : vérifiez l'hôte dans DATABASE_URL.";
  if (/timeout|ETIMEDOUT|ECONNREFUSED/i.test(msg)) return "La base ne répond pas : vérifiez l'hôte et le port (6543) de DATABASE_URL.";
  return `Erreur de base de données : ${msg}`;
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

/** Compte de démonstration, créé au premier accès (désactivable avec KS_DEMO_ACCOUNT=off). */
let seeded: Promise<void> | null = null;
function ensureSeed() {
  return (seeded ??= (async () => {
    if (process.env.KS_DEMO_ACCOUNT === "off") return;
    if (await backend().get("users", "u_demo")) return;
    const demo: User = {
      id: "u_demo",
      email: "demo@keursante.sn",
      full_name: "Dr Awa Ndiaye",
      role: "medecin",
      facility: "Centre de santé de Grand-Yoff (démo)",
      structure_type: "centre_sante",
      validator: true,
      created_at: now(),
      passwordHash: hashPassword("keursante"),
    };
    await backend().put("users", demo.id, demo, demo.email);
  })());
}

const now = () => new Date().toISOString();
const byDate = <T extends { created_at: string }>(a: T, b: T) => b.created_at.localeCompare(a.created_at);

export const db = {
  /* Utilisateurs (propriétaire = e-mail, pour la recherche à la connexion) */
  async findUserByEmail(email: string) {
    await ensureSeed();
    const [u] = await backend().list<User>("users", email.toLowerCase().trim());
    return u;
  },
  async findUser(id: string) {
    await ensureSeed();
    return backend().get<User>("users", id);
  },
  async createUser(
    u: Pick<User, "email" | "full_name" | "facility"> & Partial<Pick<User, "structure_type" | "specialty">> & { password: string },
  ): Promise<User> {
    const user: User = {
      id: `u_${randomBytes(6).toString("hex")}`,
      email: u.email.trim().toLowerCase(),
      full_name: u.full_name.trim(),
      facility: u.facility.trim(),
      structure_type: u.structure_type,
      specialty: u.specialty?.trim() || undefined,
      role: "medecin",
      validator: false,
      created_at: now(),
      passwordHash: hashPassword(u.password),
    };
    await backend().put("users", user.id, user, user.email);
    return user;
  },
  async listUsers() {
    await ensureSeed();
    return (await backend().list<User>("users")).sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  },
  async updateUser(id: string, patch: Partial<User>) {
    const u = await backend().get<User>("users", id);
    if (!u) return undefined;
    const next: User = { ...u, ...patch, id: u.id, email: u.email };
    await backend().put("users", id, next, next.email);
    return next;
  },

  /* Réinitialisation du mot de passe (jeton haché, usage unique) */
  async putReset(r: PasswordReset) {
    await backend().put("resets", r.token_hash, r, r.user_id);
  },
  async getReset(tokenHash: string) {
    return backend().get<PasswordReset>("resets", tokenHash);
  },

  /* Questionnaires d'usage (SUS) */
  async insertSurvey(sv: UsabilitySurvey) {
    await backend().put("surveys", sv.id, sv, sv.user_id);
    return sv;
  },
  async listSurveys() {
    return (await backend().list<UsabilitySurvey>("surveys")).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  /* Patients pseudonymisés (propriétaire = praticien) */
  async createPatient(doctorId: string, sex: PatientRecord["sex"], birthYear: number | null): Promise<PatientRecord> {
    const n = await backend().next("patient");
    const p: PatientRecord = {
      code: `KS-P-${String(n).padStart(6, "0")}`,
      sex,
      birth_year: birthYear,
      doctor_id: doctorId,
      created_at: now(),
    };
    await backend().put("patients", p.code, p, doctorId);
    return p;
  },
  async findPatient(doctorId: string, code: string) {
    const p = await backend().get<PatientRecord>("patients", code.trim().toUpperCase());
    return p && p.doctor_id === doctorId ? p : undefined;
  },
  async listPatients(doctorId: string) {
    return (await backend().list<PatientRecord>("patients", doctorId)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async updatePatient(code: string, patch: Partial<PatientRecord>) {
    const p = await backend().get<PatientRecord>("patients", code);
    if (!p) return undefined;
    const next: PatientRecord = { ...p, ...patch, code: p.code, doctor_id: p.doctor_id, updated_at: now() };
    await backend().put("patients", code, next, next.doctor_id);
    return next;
  },
  async listAudit(limit = 300) {
    return (await backend().list<AuditEntry>("audit")).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  },

  /* Consultations (propriétaire = praticien) */
  async nextConsultationId() {
    return `C-${String(await backend().next("consultation")).padStart(5, "0")}`;
  },
  async listConsultations(doctorId: string) {
    return (await backend().list<Consultation>("consultations", doctorId)).sort(byDate);
  },
  async getConsultation(id: string) {
    return backend().get<Consultation>("consultations", id);
  },
  async insertConsultation(c: Consultation) {
    await backend().put("consultations", c.id, c, c.doctor_id);
    return c;
  },
  async updateConsultation(id: string, patch: Partial<Consultation>) {
    const c = await backend().get<Consultation>("consultations", id);
    if (!c) return undefined;
    const next = { ...c, ...patch, updated_at: now() };
    await backend().put("consultations", id, next, next.doctor_id);
    return next;
  },

  /* Jeu de cas annotés (partagé) */
  async listCases() {
    return (await backend().list<AnnotatedCase>("cases")).sort((a, b) => a.case_id.localeCompare(b.case_id));
  },
  async getCase(id: string) {
    return backend().get<AnnotatedCase>("cases", id);
  },
  async insertCase(c: Omit<AnnotatedCase, "case_id">): Promise<AnnotatedCase> {
    const n = await backend().next(c.language === "wo" ? "case_wo" : "case_fr");
    const full: AnnotatedCase = { ...c, case_id: `KS-${(c.language as Lang).toUpperCase()}-${String(n).padStart(3, "0")}` };
    await backend().put("cases", full.case_id, full);
    return full;
  },
  async updateCase(id: string, patch: Partial<AnnotatedCase>) {
    const c = await backend().get<AnnotatedCase>("cases", id);
    if (!c) return undefined;
    const next = { ...c, ...patch, case_id: c.case_id };
    await backend().put("cases", id, next);
    return next;
  },
  async deleteCase(id: string) {
    return backend().remove("cases", id);
  },

  /* Journal d'audit (propriétaire = consultation) */
  async audit(entry: Omit<AuditEntry, "at">) {
    const at = now();
    await backend().put("audit", `${at}-${randomBytes(4).toString("hex")}`, { at, ...entry }, entry.consultation_id);
  },
  async auditFor(consultationId: string) {
    return backend().list<AuditEntry>("audit", consultationId);
  },

  /* Évaluations */
  async listEvalRuns() {
    return (await backend().list<EvalRun>("evalRuns")).sort((a, b) => b.id - a.id).slice(0, 20);
  },
  async insertEvalRun(run: Omit<EvalRun, "id">): Promise<EvalRun> {
    const full = { ...run, id: await backend().next("evalRun") };
    await backend().put("evalRuns", String(full.id), full);
    return full;
  },
};
