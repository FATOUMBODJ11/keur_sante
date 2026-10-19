"use client";

import { ArrowLeft, ClipboardList, FolderHeart, LoaderCircle, Mic, Pencil, Save, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/providers";
import { LangTag, Loading, StatusBadge } from "@/components/ui";
import { dt, type PatientConsultation } from "@/lib/client/api";
import { cap, fmtDate, profile } from "@/lib/client/format";
import type { PatientRecord } from "@/lib/types";

const toText = (xs?: string[]) => (xs ?? []).join(", ");
const toList = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

function Chips({ items, tone, empty }: { items?: string[]; tone?: string; empty: string }) {
  return items?.length ? (
    <div>
      {items.map((x) => (
        <span key={x} className={`chip ${tone ?? ""}`}>
          {x}
        </span>
      ))}
    </div>
  ) : (
    <div className="faint">{empty}</div>
  );
}

export default function PatientFile() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const toast = useToast();
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [history, setHistory] = useState<PatientConsultation[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ allergies: "", antecedents: "", traitements: "", notes: "" });

  useEffect(() => {
    dt.getPatient(code)
      .then((r) => {
        setPatient(r.patient);
        setHistory(r.consultations);
      })
      .catch((e) => setError(e.message));
  }, [code]);

  if (error && !patient)
    return (
      <div className="error-box">
        <TriangleAlert size={15} />
        {error}
      </div>
    );
  if (!patient) return <Loading />;

  const startEdit = () => {
    setForm({
      allergies: toText(patient.allergies),
      antecedents: toText(patient.antecedents),
      traitements: toText(patient.traitements),
      notes: patient.notes ?? "",
    });
    setEditing(true);
  };
  const save = async () => {
    setBusy(true);
    try {
      setPatient(
        await dt.updatePatient(patient.code, {
          allergies: toList(form.allergies),
          antecedents: toList(form.antecedents),
          traitements: toList(form.traitements),
          notes: form.notes,
        }),
      );
      setEditing(false);
      toast("Dossier enregistré");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link href="/patients" className="row small strong" style={{ marginBottom: 14, gap: 6, width: "fit-content" }}>
        <ArrowLeft size={14} />
        Patients
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">Dossier patient</div>
          <h1 className="mono">{patient.code}</h1>
          <p>
            {profile(patient)} · suivi depuis le {fmtDate(patient.created_at, { dateStyle: "long" })}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => router.push(`/consultations/nouvelle?patient=${patient.code}`)}>
          <Mic size={16} />
          Nouvelle consultation
        </button>
      </div>

      {error && (
        <div className="error-box" style={{ marginBottom: 16 }}>
          <TriangleAlert size={15} />
          {error}
        </div>
      )}

      <div className="grid g-main" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="card-head">
            <h2>
              <ClipboardList size={16} />
              Consultations
            </h2>
            <span className="tiny faint">{history.length}</span>
          </div>
          {history.length === 0 ? (
            <div className="empty">
              <span>Aucune consultation pour ce patient.</span>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Motif</th>
                    <th>Diagnostic retenu</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((c) => (
                    <tr key={c.id} className="clickable" onClick={() => router.push(`/consultations/${c.id}`)}>
                      <td className="small muted" style={{ whiteSpace: "nowrap" }}>
                        {fmtDate(c.created_at)}
                      </td>
                      <td className="strong">
                        <span className="row" style={{ gap: 6 }}>
                          {cap(c.motif) || <span className="faint">—</span>}
                          <LangTag code={c.language_detected} />
                        </span>
                      </td>
                      <td className="small">{c.diagnostic ?? <span className="faint">—</span>}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>
              <FolderHeart size={16} />
              Dossier
            </h2>
            {editing ? (
              <div className="row">
                <button className="btn btn-quiet btn-sm" onClick={() => setEditing(false)}>
                  Annuler
                </button>
                <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
                  {busy ? <LoaderCircle size={13} className="spin" /> : <Save size={13} />}
                  Enregistrer
                </button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={startEdit}>
                <Pencil size={13} />
                Modifier
              </button>
            )}
          </div>
          {editing ? (
            <div className="card-pad stack-lg">
              {(
                [
                  ["allergies", "Allergies", "ex. pénicilline, aspirine"],
                  ["antecedents", "Antécédents", "ex. HTA, diabète, asthme"],
                  ["traitements", "Traitements au long cours", "ex. amlodipine, metformine"],
                ] as const
              ).map(([k, label, ph]) => (
                <div key={k} className="field">
                  <label className="label" htmlFor={k}>
                    {label}
                  </label>
                  <input id={k} className="input" placeholder={ph} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  <span className="tiny faint">Séparez par des virgules.</span>
                </div>
              ))}
              <div className="field">
                <label className="label" htmlFor="notes">
                  Notes
                </label>
                <textarea id="notes" className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="facts">
              <div className="fact">
                <span>Allergies</span>
                <Chips items={patient.allergies} tone="contra" empty="Aucune connue" />
              </div>
              <div className="fact">
                <span>Antécédents</span>
                <Chips items={patient.antecedents} empty="Non renseigné" />
              </div>
              <div className="fact">
                <span>Traitements</span>
                <Chips items={patient.traitements} empty="Non renseigné" />
              </div>
              <div className="fact">
                <span>Notes</span>
                <div className={patient.notes ? "" : "faint"} style={{ whiteSpace: "pre-wrap" }}>
                  {patient.notes || "—"}
                </div>
              </div>
            </div>
          )}
          <p className="tiny faint card-pad" style={{ paddingTop: 0 }}>
            Ce dossier est transmis à l&apos;agent lors de l&apos;analyse : une allergie connue déclenche une alerte si une suggestion la
            contredit. Les antécédents et traitements confirmés s&apos;ajoutent à chaque validation.
          </p>
        </div>
      </div>
    </>
  );
}
