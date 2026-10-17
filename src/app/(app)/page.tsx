"use client";

import { ArrowRight, Bot, CircleCheck, ClipboardCheck, FileClock, Mic, Percent, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { LangTag, Loading, StatusBadge } from "@/components/ui";
import { Waves } from "@/components/Waves";
import { dt } from "@/lib/client/api";
import { cap, fmtRelative, profile } from "@/lib/client/format";
import type { Consultation, Providers, Stats } from "@/lib/types";

const greeting = () => (new Date().getHours() < 18 ? "Bonjour" : "Bonsoir");

function DecisionsBar({ d }: { d: Stats["decisions_diagnostiques"] }) {
  const total = d.accepted + d.rejected + d.pending || 1;
  const parts: [keyof typeof d, string, string][] = [
    ["accepted", "Acceptées", "var(--success)"],
    ["rejected", "Rejetées", "var(--danger)"],
    ["pending", "En attente", "var(--border-strong)"],
  ];
  return (
    <div className="stack">
      <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--surface-3)", gap: 2 }}>
        {parts.map(([k, , color]) => d[k] > 0 && <i key={k} style={{ width: `${(d[k] / total) * 100}%`, background: color }} title={`${d[k]}`} />)}
      </div>
      <div className="row wrap" style={{ gap: 16 }}>
        {parts.map(([k, label, color]) => (
          <span key={k} className="row small" style={{ gap: 6 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
            <span className="muted">{label}</span>
            <b className="num">{d[k]}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [list, setList] = useState<Consultation[] | null>(null);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([dt.stats(), dt.listConsultations(), dt.providers()])
      .then(([s, l, p]) => {
        setStats(s);
        setList(l);
        setProviders(p);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error-box">{error}</div>;
  if (!stats || !list || !user) return <Loading />;

  const st = stats.par_statut;
  const toReview = list.filter((c) => c.status === "review");
  const validated = (st.validated || 0) + (st.archived || 0);
  const d = stats.decisions_diagnostiques;
  const decided = d.accepted + d.rejected;
  const rate = decided ? d.accepted / decided : null;
  const n = toReview.length;

  return (
    <div className="stack-lg">
      <section className="welcome">
        <Waves density={0.8} tilt={0.55} zoom={1.1} gain={1.6} size={10} offsetX={0.8} />
        <div>
          <div className="eyebrow" style={{ color: "#A7E9A7" }}>
            {cap(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}
          </div>
          <h1>
            {greeting()}, {user.full_name}
          </h1>
          <p>
            {n ? `${n} compte${n > 1 ? "s" : ""} rendu${n > 1 ? "s" : ""} attend${n > 1 ? "ent" : ""} votre validation.` : "Tous vos comptes rendus sont validés."}{" "}
            Lancez une consultation : l&apos;agent prépare le compte rendu pendant que vous examinez le patient.
          </p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => router.push("/consultations/nouvelle")}>
          <Mic size={18} />
          Démarrer une consultation
        </button>
      </section>

      <div className="grid g-4">
        <div className="card stat">
          <span className="stat-label">
            <Stethoscope size={15} />
            Consultations
          </span>
          <span className="stat-value">{stats.total}</span>
          <span className="stat-sub">documentées avec Keur Santé</span>
        </div>
        <div className="card stat">
          <span className="stat-label">
            <FileClock size={15} />À valider
          </span>
          <span className="stat-value">{st.review || 0}</span>
          <span className="stat-sub">en attente de votre relecture</span>
        </div>
        <div className="card stat">
          <span className="stat-label">
            <ClipboardCheck size={15} />
            Validées
          </span>
          <span className="stat-value">{validated}</span>
          <span className="stat-sub">
            dont {st.archived || 0} archivée{(st.archived || 0) > 1 ? "s" : ""}
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">
            <Percent size={15} />
            Pistes IA retenues
          </span>
          <span className="stat-value">
            {rate == null ? "—" : Math.round(rate * 100)}
            <small>{rate == null ? "" : "%"}</small>
          </span>
          <span className="stat-sub">
            {d.accepted} acceptée{d.accepted > 1 ? "s" : ""} · {d.rejected} rejetée{d.rejected > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="grid g-main">
        <div className="card">
          <div className="card-head">
            <h2>
              <FileClock size={16} />À valider en priorité
            </h2>
            <Link href="/consultations" className="small strong">
              Toutes les consultations <ArrowRight size={13} style={{ verticalAlign: -2 }} />
            </Link>
          </div>
          {toReview.length === 0 ? (
            <div className="empty">
              <CircleCheck size={26} />
              <span>Aucun compte rendu en attente.</span>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {toReview.map((c) => (
                    <tr key={c.id} className="clickable" onClick={() => router.push(`/consultations/${c.id}`)}>
                      <td style={{ width: "40%" }}>
                        <div className="strong">{cap(c.motif) || "Motif à préciser"}</div>
                        <div className="tiny faint">
                          {c.patient.code} · {profile(c.patient)}
                        </div>
                      </td>
                      <td>
                        <LangTag code={c.language_detected} />
                      </td>
                      <td className="small muted">{fmtRelative(c.created_at)}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="btn btn-ghost btn-sm">
                          Relire
                          <ArrowRight size={13} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="card-head" style={{ borderTop: "1px solid var(--border)" }}>
            <h2>Activité récente</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {list
                  .filter((c) => c.status !== "review")
                  .slice(0, 5)
                  .map((c) => (
                    <tr key={c.id} className="clickable" onClick={() => router.push(`/consultations/${c.id}`)}>
                      <td style={{ width: "40%" }}>
                        <div className="strong">{cap(c.motif) || "Consultation en cours"}</div>
                        <div className="tiny faint">{c.patient.code}</div>
                      </td>
                      <td>
                        <LangTag code={c.language_detected} />
                      </td>
                      <td className="small muted">{fmtRelative(c.created_at)}</td>
                      <td style={{ textAlign: "right" }}>
                        <StatusBadge status={c.status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {list.filter((c) => c.status !== "review").length === 0 && (
              <div className="empty">
                <span>Aucune consultation pour l&apos;instant.</span>
              </div>
            )}
          </div>
        </div>

        <div className="stack-lg">
          <div className="card">
            <div className="card-head">
              <h2>
                <CircleCheck size={16} />
                Vos décisions sur les pistes IA
              </h2>
            </div>
            <div className="card-pad stack">
              <DecisionsBar d={d} />
              <p className="small muted">
                Chaque piste diagnostique proposée par l&apos;agent doit être acceptée ou rejetée avant la validation du compte
                rendu.
              </p>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2>
                <Bot size={16} />
                Agent IA
              </h2>
              <span className="badge b-green">
                <span className="pip" />
                Opérationnel
              </span>
            </div>
            <div className="card-pad stack">
              <div className="pipeline-diagram">
                {["Audio", "Langue", "Transcription", "Traduction", "Extraction", "SOAP", "Pistes"].map((x) => (
                  <Fragment key={x}>
                    <span>{x}</span>
                    <i>→</i>
                  </Fragment>
                ))}
                <span className="h">Médecin</span>
                <i>→</i>
                <span>Archive</span>
              </div>
              {providers && (
                <div className="facts" style={{ margin: "4px -20px -18px" }}>
                  <div className="fact">
                    <span>Français</span>
                    <div>{providers.asr_fr}</div>
                  </div>
                  <div className="fact">
                    <span>Wolof</span>
                    <div>
                      {providers.asr_wo}
                      {providers.kiriku_model ? ` · ${providers.kiriku_model}` : ""}
                    </div>
                  </div>
                  <div className="fact">
                    <span>Traduction</span>
                    <div>{providers.translation}</div>
                  </div>
                  <div className="fact">
                    <span>Extraction</span>
                    <div>
                      {providers.llm}
                      {providers.llm_model ? ` · ${providers.llm_model}` : ""}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flow">
          {[
            ["Consentement", "Patient et praticien acceptent l'enregistrement."],
            ["Capture", providers?.wolof_enabled === false ? "La consultation se déroule normalement, en français." : "La consultation se déroule normalement, en français ou en wolof."],
            ["Analyse", "L'agent transcrit, traduit, extrait et rédige le SOAP."],
            ["Validation", "Vous corrigez, tranchez chaque suggestion, puis validez."],
          ].map(([t, d2], i) => (
            <div key={t} className="flow-step">
              <span className="n">Étape {i + 1}</span>
              <b>{t}</b>
              <span>{d2}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
