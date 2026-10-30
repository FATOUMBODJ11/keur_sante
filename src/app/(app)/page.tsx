"use client";

import { Activity, ArrowRight, Bot, CircleCheck, FileClock, Mic } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { DotRing, LangTag, Loading, StatusBadge } from "@/components/ui";
import { dt, type SurveyResults } from "@/lib/client/api";
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
  const [survey, setSurvey] = useState<SurveyResults | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([dt.stats(), dt.listConsultations(), dt.providers()])
      .then(([s, l, p]) => {
        setStats(s);
        setList(l);
        setProviders(p);
      })
      .catch((e) => setError(e.message));
    dt.surveys().then(setSurvey).catch(() => {});
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

  const last = list[0] ?? null;
  const vitals = last?.extraction?.constantes.slice(0, 4) ?? [];
  const weeks = stats.par_semaine ?? [];
  const maxWeek = Math.max(1, ...weeks.map((x) => x.n));

  return (
    <div className="stack-lg">
      <section className="dash-head">
        <div>
          <div className="eyebrow">{cap(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}</div>
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

      <div className="dash-grid">
        <div className="card tile">
          <div className="tile-title">
            Activité
            <span className="tiny faint" style={{ fontFamily: "var(--font)" }}>
              8 dernières semaines
            </span>
          </div>
          <div className="week-bars">
            {weeks.map((w) => (
              <div key={w.semaine} title={`Semaine du ${w.semaine} : ${w.n} consultation(s)`}>
                <span className="tiny num faint">{w.n || ""}</span>
                <i className={w.n ? "" : "zero"} style={{ height: `${Math.max(w.n ? 8 : 4, (w.n / maxWeek) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="tile-rows">
            <div>
              <span>Consultations</span>
              <b>{stats.total}</b>
            </div>
            <div>
              <span>À valider</span>
              <b>{st.review || 0}</b>
            </div>
            <div>
              <span>Validées</span>
              <b>{validated}</b>
            </div>
            <div>
              <span>Patients suivis</span>
              <b>{stats.patients}</b>
            </div>
          </div>
        </div>

        <div className="card tile">
          <div className="tile-title">Pistes IA retenues</div>
          <div className="ring-wrap">
            <DotRing value={rate ?? 0} />
            <div className="ring-label">
              <b>{rate == null ? "—" : `${Math.round(rate * 100)} %`}</b>
              <span>acceptées par vous</span>
            </div>
          </div>
          <DecisionsBar d={d} />
        </div>

        <div className="card tile">
          <div className="tile-title">
            Dernière consultation
            {last && <StatusBadge status={last.status} />}
          </div>
          {last ? (
            <>
              <div>
                <div className="strong">{cap(last.motif) || "Motif à préciser"}</div>
                <div className="tiny faint">
                  {last.patient.code} · {profile(last.patient)} · {fmtRelative(last.created_at)}
                </div>
              </div>
              {vitals.length ? (
                <div className="vitals">
                  {vitals.map((v) => (
                    <div key={v.nom}>
                      <span>{cap(v.nom)}</span>
                      <b>
                        {v.valeur}
                        {v.unite ? <small className="muted" style={{ fontSize: 12, fontWeight: 500 }}> {v.unite}</small> : null}
                      </b>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="small muted">Aucune constante relevée dans cette consultation.</p>
              )}
              <Link href={`/consultations/${last.id}`} className="btn btn-ghost btn-sm" style={{ marginTop: "auto", alignSelf: "flex-start" }}>
                Ouvrir le compte rendu
                <ArrowRight size={13} />
              </Link>
            </>
          ) : (
            <div className="empty" style={{ padding: 20 }}>
              <span>Aucune consultation pour l&apos;instant.</span>
            </div>
          )}
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
                <Activity size={16} />
                Indicateurs cliniques
              </h2>
            </div>
            <div className="facts">
              <div className="fact">
                <span>Délai médian jusqu&apos;à la validation</span>
                <div className="strong">{stats.delai_validation_median === null ? "—" : `${stats.delai_validation_median} min`}</div>
              </div>
              <div className="fact">
                <span>Questionnaire SUS</span>
                <div className="strong">{survey?.sus_moyen == null ? "—" : `${survey.sus_moyen} / 100`}{survey?.n ? <span className="tiny faint"> · {survey.n} réponse{survey.n > 1 ? "s" : ""}</span> : null}</div>
              </div>
              <div className="fact">
                <span>Diagnostics les plus retenus</span>
                <div>
                  {(stats.top_diagnostics ?? []).length === 0 ? (
                    <span className="faint">Pas encore de diagnostic retenu</span>
                  ) : (
                    stats.top_diagnostics.map((d) => (
                      <div key={d.label} className="row small" style={{ gap: 8 }}>
                        <span style={{ flex: 1 }}>{d.label}</span>
                        <b className="num">{d.n}</b>
                      </div>
                    ))
                  )}
                </div>
              </div>
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

      <div className="card cta-tile">
        <div>
          <div className="tile-title">La validation clinique</div>
          <p className="small muted" style={{ marginTop: 4, maxWidth: "62ch" }}>
            Comparez les résultats de l&apos;agent aux cas annotés par des médecins : symptômes retrouvés, diagnostics proposés,
            accord entre annotateurs.
          </p>
        </div>
        <Link href="/evaluation" className="btn btn-primary">
          Ouvrir la validation
          <ArrowRight size={15} />
        </Link>
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
