import { SYMPTOMS } from "@/lib/data/lexicon";
import type { ConsultationStatus, Extraction, Patient, Speaker, StepName } from "@/lib/types";

export const STATUS: Record<ConsultationStatus, { label: string; cls: string }> = {
  recording: { label: "Capture", cls: "b-red" },
  processing: { label: "Analyse IA", cls: "b-teal" },
  review: { label: "À valider", cls: "b-amber" },
  validated: { label: "Validé", cls: "b-green" },
  archived: { label: "Archivé", cls: "b-navy" },
  failed: { label: "Échec", cls: "b-red" },
};

export const LANG = { fr: "Français", wo: "Wolof", auto: "Détection auto" } as const;

export const STEP_LABELS: Record<StepName, string> = {
  detection_langue: "Détection de la langue",
  reconnaissance_vocale: "Reconnaissance vocale",
  traduction: "Traduction wolof → français",
  extraction_clinique: "Extraction clinique",
  suggestions_diagnostiques: "Pistes diagnostiques",
  generation_soap: "Génération du compte rendu SOAP",
  validation_medecin: "Validation médecin",
  archivage: "Archivage",
};

export const STEP_ORDER: StepName[] = [
  "detection_langue",
  "reconnaissance_vocale",
  "traduction",
  "extraction_clinique",
  "suggestions_diagnostiques",
  "generation_soap",
  "validation_medecin",
];

export const fmtDate = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) =>
  iso ? new Date(iso).toLocaleString("fr-FR", opts) : "—";

/** « Aujourd'hui, 10:42 », « Hier, 08:15 » ou « 3 oct., 14:00 ». */
export function fmtRelative(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.round((new Date(new Date().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (days === 0) return `Aujourd'hui, ${time}`;
  if (days === 1) return `Hier, ${time}`;
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}, ${time}`;
}

const age = (y: number | null) => (y ? `${new Date().getFullYear() - y} ans` : null);
const sexLabel = (s: Patient["sex"]) => (s === "F" ? "Femme" : s === "M" ? "Homme" : null);
export const profile = (p: Patient | undefined) => [sexLabel(p?.sex ?? null), age(p?.birth_year ?? null)].filter(Boolean).join(" · ") || "Non renseigné";
export const cap = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s ?? "");

export interface ParsedTurn {
  who: Speaker;
  text: string;
}

/** Découpe une transcription « Médecin: … / Patient: … » en tours de parole. */
export function parseTurns(text: string | null | undefined): ParsedTurn[] {
  return (text || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(médecin|medecin|docteur|dr|patient|patiente|accompagnant)\s*:\s*(.*)$/i);
      if (!m) return { who: "" as Speaker, text: l };
      const k = m[1].toLowerCase();
      return { who: (k.startsWith("pat") ? "patient" : k.startsWith("acc") ? "accompagnant" : "medecin") as Speaker, text: m[2] };
    });
}

export const whoLabel = (w: Speaker) => (w === "patient" ? "Patient" : w === "medecin" ? "Médecin" : w === "accompagnant" ? "Accomp." : "—");

/* ---------- Surlignage des entités dans la transcription ---------- */

export interface Entity {
  term: string;
  cls: string;
  title: string;
}

export function entitiesFor(ex: Extraction | null): Entity[] {
  if (!ex) return [];
  const out: Entity[] = [];
  for (const s of ex.symptomes) {
    for (const term of SYMPTOMS[s.nom]?.terms ?? [s.nom]) {
      out.push({ term, cls: s.present ? "" : "neg", title: `${s.nom}${s.present ? "" : " (absent)"}${s.duree ? ` · ${s.duree}` : ""}` });
    }
  }
  for (const a of ex.antecedents) out.push({ term: a.replace(/\s*\(.*\)$/, ""), cls: "hist", title: "Antécédent" });
  for (const t of ex.traitements) out.push({ term: t.replace(/\s*\(.*\)$/, ""), cls: "hist", title: "Traitement mentionné" });
  if (ex.duree) out.push({ term: ex.duree, cls: "", title: "Durée" });
  return out.filter((e) => e.term && e.term.length > 2).sort((a, b) => b.term.length - a.term.length);
}

const VITALS = /(\d{2,3}\s*\/\s*\d{1,3}|\d{1,3}(?:[,.]\d)?\s*(?:degrés|°C?|bpm|battements|kg|%|g\/l|mmol)|TDR[^.,;]*?(?:positif|négatif))/gi;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface Piece {
  t: string;
  cls?: string;
  title?: string;
}

export function highlight(text: string, entities: Entity[]): Piece[] {
  if (!text) return [];
  const out: Piece[] = [];
  const alt = entities.map((e) => esc(e.term)).join("|");
  const re = new RegExp(`${alt ? `(${alt})|` : ""}${VITALS.source}`, "gi");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    const hit = entities.find((e) => e.term.toLowerCase() === m![0].toLowerCase());
    out.push(hit ? { t: m[0], cls: hit.cls, title: hit.title } : { t: m[0], cls: "vit", title: "Constante / examen" });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}
