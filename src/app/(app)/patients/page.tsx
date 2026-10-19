"use client";

import { Search, TriangleAlert, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loading } from "@/components/ui";
import { dt, type PatientRow } from "@/lib/client/api";
import { cap, fmtRelative, profile } from "@/lib/client/format";

export default function PatientsPage() {
  const router = useRouter();
  const [list, setList] = useState<PatientRow[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    dt.listPatients().then(setList).catch((e) => setError(e.message));
  }, []);

  const shown = useMemo(
    () => (list || []).filter((p) => !q || `${p.code} ${p.last_motif ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    [list, q],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Dossiers</div>
          <h1>Patients</h1>
          <p>Chaque patient est identifié par un code pseudonyme. Son dossier (allergies, antécédents, traitements) est pris en compte à chaque analyse.</p>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <h2>
            <Users size={16} />
            {list ? `${list.length} patient${list.length > 1 ? "s" : ""}` : "Patients"}
          </h2>
          <div style={{ position: "relative", width: 260, maxWidth: "100%" }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: 11, color: "var(--text-3)" }} />
            <input className="input" placeholder="Code patient ou motif" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 34 }} />
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
            <Users size={26} />
            <span>{list.length === 0 ? "Aucun patient pour l'instant : ils sont créés au début d'une consultation." : "Aucun patient ne correspond."}</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Dernier motif</th>
                  <th className="num">Consultations</th>
                  <th>Dernière visite</th>
                  <th>Allergies</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.code} className="clickable" onClick={() => router.push(`/patients/${p.code}`)}>
                    <td>
                      <div className="mono" style={{ color: "var(--text)" }}>
                        {p.code}
                      </div>
                      <div className="tiny faint">{profile(p)}</div>
                    </td>
                    <td className="strong">{cap(p.last_motif) || <span className="faint">—</span>}</td>
                    <td className="num">{p.consultations}</td>
                    <td className="small muted">{fmtRelative(p.last_at)}</td>
                    <td>
                      {p.allergies?.length ? (
                        <span className="badge b-red">
                          <TriangleAlert size={11} />
                          {p.allergies.join(", ")}
                        </span>
                      ) : (
                        <span className="tiny faint">Aucune connue</span>
                      )}
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
