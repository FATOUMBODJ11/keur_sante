"use client";

import { ArrowLeft, Printer, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { BrandMark, Loading } from "@/components/ui";
import { dt } from "@/lib/client/api";
import { STRUCTURE_LABELS, cap, fmtDate, profile } from "@/lib/client/format";
import type { Consultation } from "@/lib/types";

const SECTIONS = [
  ["S", "Subjectif"],
  ["O", "Objectif"],
  ["A", "Analyse"],
  ["P", "Plan"],
] as const;

/** Compte rendu imprimable (et enregistrable en PDF via le navigateur). */
export default function PrintReport() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [c, setC] = useState<Consultation | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    dt.getConsultation(id)
      .then((r) => {
        setC(r);
        // Trace l'impression dans le journal d'audit (même règle que l'export).
        if (r.status === "validated" || r.status === "archived") dt.exportText(id).catch(() => {});
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="error-box">{error}</div>;
  if (!c || !user) return <Loading />;
  if (c.status !== "validated" && c.status !== "archived") {
    return (
      <div className="error-box">
        <TriangleAlert size={15} />
        L&apos;impression est réservée aux comptes rendus validés par le praticien.
      </div>
    );
  }

  const retained = c.suggestions.filter((s) => s.type === "diagnostic" && s.decision === "accepted");
  const alerts = c.suggestions.filter((s) => s.type === "alerte");

  return (
    <>
      <div className="row no-print" style={{ marginBottom: 16, justifyContent: "space-between" }}>
        <Link href={`/consultations/${c.id}`} className="row small strong" style={{ gap: 6 }}>
          <ArrowLeft size={14} />
          Retour au compte rendu
        </Link>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} />
          Imprimer / enregistrer en PDF
        </button>
      </div>

      <article className="print-sheet">
        <header className="print-head">
          <div className="row" style={{ gap: 12 }}>
            <BrandMark size={40} />
            <div>
              <div className="print-facility">{user.facility}</div>
              <div className="tiny">{user.structure_type ? STRUCTURE_LABELS[user.structure_type] : "Structure de santé"}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="strong">{user.full_name}</div>
            {user.specialty && <div className="tiny">{user.specialty}</div>}
            <div className="tiny">{user.email}</div>
          </div>
        </header>

        <h1 className="print-title">Compte rendu de consultation</h1>

        <div className="print-meta">
          <div>
            <span>Patient</span>
            <b className="mono">{c.patient.code}</b>
          </div>
          <div>
            <span>Profil</span>
            <b>{profile(c.patient)}</b>
          </div>
          <div>
            <span>Date</span>
            <b>{fmtDate(c.created_at, { dateStyle: "long", timeStyle: "short" })}</b>
          </div>
          <div>
            <span>Motif</span>
            <b>{cap(c.motif) || "—"}</b>
          </div>
        </div>

        {SECTIONS.map(([k, title]) => (
          <section key={k} className="print-section">
            <h2>
              <span className={`soap-letter ${k}`}>{k}</span>
              {title}
            </h2>
            <p>{c.soap_final?.[k] || "—"}</p>
          </section>
        ))}

        {retained.length > 0 && (
          <section className="print-section">
            <h2>Diagnostic(s) retenu(s)</h2>
            <ul>
              {retained.map((d) => (
                <li key={d.id}>
                  {d.label}
                  {d.code ? ` — CIM-10 ${d.code}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}
        {alerts.length > 0 && (
          <section className="print-section">
            <h2>Signes d&apos;alerte relevés</h2>
            <ul>
              {alerts.map((a) => (
                <li key={a.id}>{a.label}</li>
              ))}
            </ul>
          </section>
        )}

        <footer className="print-foot">
          <div>
            Compte rendu relu et validé par {c.validated_by} le {fmtDate(c.validated_at, { dateStyle: "long", timeStyle: "short" })}.
            <br />
            Document préparé avec Keur Santé : les suggestions de l&apos;IA ne constituent pas une décision médicale.
          </div>
          <div className="print-sign">Signature et cachet</div>
        </footer>
      </article>
    </>
  );
}
