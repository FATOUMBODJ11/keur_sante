"use client";

import { ClipboardList, Mic, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LangTag, Loading, StatusBadge } from "@/components/ui";
import { dt } from "@/lib/client/api";
import { cap, fmtDate, profile } from "@/lib/client/format";
import type { Consultation } from "@/lib/types";

const FILTERS: [string, string][] = [
  ["all", "Toutes"],
  ["review", "À valider"],
  ["validated", "Validées"],
  ["archived", "Archivées"],
];

export default function ConsultationsPage() {
  const router = useRouter();
  const [list, setList] = useState<Consultation[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    dt.listConsultations().then(setList).catch((e) => setError(e.message));
  }, []);

  const shown = useMemo(
    () =>
      (list || []).filter(
        (c) => (filter === "all" || c.status === filter) && (!q || `${c.patient.code} ${c.motif || ""}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [list, filter, q],
  );
  const count = (f: string) => (list || []).filter((c) => f === "all" || c.status === f).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Dossiers</div>
          <h1>Consultations</h1>
          <p>Retrouvez chaque consultation, son compte rendu et l&apos;état de sa validation.</p>
        </div>
        <button className="btn btn-primary" onClick={() => router.push("/consultations/nouvelle")}>
          <Mic size={16} />
          Nouvelle consultation
        </button>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="seg" role="tablist">
            {FILTERS.map(([k, label]) => (
              <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)} role="tab" aria-selected={filter === k}>
                {label} <span className="faint num">{list ? count(k) : ""}</span>
              </button>
            ))}
          </div>
          <div style={{ position: "relative", width: 260, maxWidth: "100%" }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: 11, color: "var(--text-3)" }} />
            <input id="search" className="input" placeholder="Code patient ou motif" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 34 }} />
          </div>
        </div>
        {error && (
          <div className="card-pad">
            <div className="error-box">{error}</div>
          </div>
        )}
        {!list ? (
          <Loading />
        ) : shown.length === 0 ? (
          <div className="empty">
            <ClipboardList size={26} />
            <span>{list.length === 0 ? "Aucune consultation pour l'instant." : "Aucune consultation ne correspond."}</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Motif de consultation</th>
                  <th>Langue</th>
                  <th>Date</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => router.push(`/consultations/${c.id}`)}>
                    <td>
                      <div className="mono" style={{ color: "var(--text)" }}>
                        {c.patient.code}
                      </div>
                      <div className="tiny faint">{profile(c.patient)}</div>
                    </td>
                    <td className="strong" style={{ minWidth: 220 }}>
                      {cap(c.motif) || <span className="faint">En attente de l&apos;analyse</span>}
                    </td>
                    <td>
                      <LangTag code={c.language_detected} />
                    </td>
                    <td className="small muted" style={{ whiteSpace: "nowrap" }}>
                      {fmtDate(c.created_at)}
                    </td>
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
    </>
  );
}
