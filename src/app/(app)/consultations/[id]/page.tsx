"use client";

import {
  Archive,
  ArrowLeft,
  Bot,
  Check,
  ClipboardCheck,
  Copy,
  Database,
  FileDown,
  FileText,
  Info,
  ListChecks,
  LoaderCircle,
  Lock,
  Pencil,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRefreshCounts, useToast } from "@/components/providers";
import { AgentSteps, LangTag, Loading, Modal, StatusBadge } from "@/components/ui";
import { dt } from "@/lib/client/api";
import { LANG, cap, entitiesFor, fmtDate, highlight, parseTurns, profile, whoLabel } from "@/lib/client/format";
import type { Consultation, Decision, Soap, SoapKey, Suggestion } from "@/lib/types";

const SOAP_ROWS: [SoapKey, string, string][] = [
  ["S", "Subjectif", "ce que rapporte le patient"],
  ["O", "Objectif", "observations et mesures"],
  ["A", "Analyse", "synthèse et pistes"],
  ["P", "Plan", "prise en charge"],
];

function BackLink() {
  return (
    <Link href="/consultations" className="row small strong" style={{ marginBottom: 14, gap: 6, width: "fit-content" }}>
      <ArrowLeft size={14} />
      Consultations
    </Link>
  );
}

function Fact({ k, children }: { k: string; children: ReactNode }) {
  const empty = children == null || children === "" || (Array.isArray(children) && children.length === 0);
  return (
    <div className="fact">
      <span>{k}</span>
      <div className={empty ? "faint" : ""}>{empty ? "Non mentionné" : children}</div>
    </div>
  );
}

function Transcript({ c }: { c: Consultation }) {
  const wolof = c.language_detected === "wo";
  const [view, setView] = useState<"src" | "fr">(wolof ? "src" : "fr");
  const entities = useMemo(() => entitiesFor(c.extraction), [c.extraction]);
  const turns = parseTurns(view === "src" ? c.transcript_source : c.transcript_fr);
  return (
    <div className="card">
      <div className="card-head">
        <h2>
          <FileText size={16} />
          Transcription
        </h2>
        {wolof && (
          <div className="seg">
            <button className={view === "src" ? "on" : ""} onClick={() => setView("src")}>
              Wolof
            </button>
            <button className={view === "fr" ? "on" : ""} onClick={() => setView("fr")}>
              Traduction
            </button>
          </div>
        )}
      </div>
      <div className="card-pad scroll-pane" style={{ paddingTop: 10 }}>
        {turns.map((t, i) => (
          <div key={i} className="turn">
            <span className={`who ${t.who}`}>{whoLabel(t.who)}</span>
            <span>
              {highlight(t.text, view === "fr" || !wolof ? entities : []).map((p, k) =>
                p.cls != null ? (
                  <mark key={k} className={`ent ${p.cls}`} title={p.title}>
                    {p.t}
                  </mark>
                ) : (
                  <span key={k}>{p.t}</span>
                ),
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="card-head" style={{ borderTop: "1px solid var(--border)", borderBottom: 0, justifyContent: "flex-start", gap: 12 }}>
        <span className="tiny row" style={{ gap: 5 }}>
          <mark className="ent">symptôme</mark>
        </span>
        <span className="tiny row" style={{ gap: 5 }}>
          <mark className="ent neg">absent</mark>
        </span>
        <span className="tiny row" style={{ gap: 5 }}>
          <mark className="ent vit">constante</mark>
        </span>
        <span className="tiny row" style={{ gap: 5 }}>
          <mark className="ent hist">antécédent</mark>
        </span>
      </div>
    </div>
  );
}

function ExportModal({ text, onClose }: { text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      const el = document.getElementById("export-doc");
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };
  return (
    <Modal
      title="Compte rendu validé"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Fermer
          </button>
          <button className="btn btn-primary" onClick={copy}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copié" : "Copier le texte"}
          </button>
        </>
      }
    >
      <div id="export-doc" className="doc">
        {text}
      </div>
    </Modal>
  );
}

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const refreshCounts = useRefreshCounts();
  const router = useRouter();
  const [c, setC] = useState<Consultation | null>(null);
  const [soap, setSoap] = useState<Soap | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [exported, setExported] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const load = useCallback(
    () =>
      dt
        .getConsultation(id)
        .then((r) => {
          setC(r);
          setSoap(r.soap_final);
          setDirty(false);
        })
        .catch((e) => setError(e.message)),
    [id],
  );
  useEffect(() => {
    let alive = true;
    dt.getConsultation(id)
      .then((r) => {
        if (!alive) return;
        setC(r);
        setSoap(r.soap_final);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);
  useEffect(() => {
    if (c?.status !== "processing") return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [c?.status, load]);

  const reviewing = c?.status === "review";
  const dx = useMemo(
    () => (c?.suggestions || []).filter((s) => s.type === "diagnostic").sort((a, b) => (b.confiance || 0) - (a.confiance || 0)),
    [c],
  );
  const plan = useMemo(() => (c?.suggestions || []).filter((s) => s.type === "prise_en_charge"), [c]);
  const alerts = useMemo(() => (c?.suggestions || []).filter((s) => s.type === "alerte"), [c]);
  const decided = dx.filter((s) => s.decision !== "pending").length;

  if (error && !c)
    return (
      <div className="error-box">
        <TriangleAlert size={15} />
        {error}
      </div>
    );
  if (!c) return <Loading />;

  const run = async <T,>(name: string, fn: () => Promise<T>, msg?: string): Promise<T | undefined> => {
    setBusy(name);
    setError("");
    try {
      const r = await fn();
      if (r && typeof r === "object" && "id" in r) {
        const next = r as unknown as Consultation;
        setC(next);
        if (name !== "decide") {
          setSoap(next.soap_final);
          setDirty(false);
        }
      }
      if (msg) toast(msg);
      refreshCounts();
      return r;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const save = () => run("save", () => dt.editSoap(c.id, soap!), "Compte rendu enregistré").then(() => setEditing(false));
  const decide = (s: Suggestion, d: Decision) => run("decide", () => dt.decide(c.id, s.id, s.decision === d ? "pending" : d));
  const validate = async () => {
    if (dirty && !(await run("save", () => dt.editSoap(c.id, soap!)))) return;
    setEditing(false);
    await run("validate", () => dt.validate(c.id), "Compte rendu validé");
  };
  const archive = () => run("archive", () => dt.archive(c.id), "Consultation archivée").then(() => setConfirmArchive(false));
  const doExport = () =>
    run("export", async () => {
      setExported(await dt.exportText(c.id));
    });

  if (c.status === "processing" || c.status === "recording") {
    return (
      <>
        <BackLink />
        <div className="card processing">
          <div className="card-head">
            <h2>
              <LoaderCircle size={16} className="spin" />
              {c.status === "recording" ? "Consultation sans capture" : "Analyse en cours"}
            </h2>
            <StatusBadge status={c.status} />
          </div>
          <div className="card-pad stack">
            {c.status === "recording" ? (
              <p className="muted">Cette consultation a été ouverte mais aucun audio ni aucune transcription n&apos;a été transmis.</p>
            ) : (
              <AgentSteps steps={c.steps} live={1} />
            )}
          </div>
        </div>
      </>
    );
  }
  if (c.status === "failed") {
    return (
      <>
        <BackLink />
        <div className="error-box">
          <TriangleAlert size={15} />
          <div>
            <b>L&apos;analyse a échoué.</b> {c.error}
          </div>
        </div>
      </>
    );
  }

  const ex = c.extraction;
  // Après validation, A et P sont reformulées d'après les décisions : seul compte ce que le médecin a réécrit.
  const edited = (k: SoapKey) =>
    c.status === "review" ? (c.soap_draft?.[k] || "") !== (soap?.[k] || "") : (c.soap_edited ?? []).includes(k);

  return (
    <>
      <BackLink />
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <FileText size={13} />
            Compte rendu de consultation
          </div>
          <h1>{cap(ex?.motif) || "Consultation"}</h1>
        </div>
        <div className="row wrap">
          <StatusBadge status={c.status} />
          {c.status !== "review" && (
            <span className="badge b-grey">
              <Lock size={11} />
              Lecture seule
            </span>
          )}
        </div>
      </div>

      <div className="card review-head" style={{ marginBottom: 16 }}>
        <div className="kv">
          <span>Patient</span>
          <b className="mono" style={{ fontSize: 13 }}>
            {c.patient.code}
          </b>
        </div>
        <div className="kv">
          <span>Profil</span>
          <b>{profile(c.patient)}</b>
        </div>
        <div className="kv">
          <span>Langue</span>
          <b className="row" style={{ gap: 6 }}>
            <LangTag code={c.language_detected} />
            {c.language_detected ? LANG[c.language_detected] : "—"}
            {c.language_requested === "auto" && <span className="tiny faint">détectée</span>}
          </b>
        </div>
        <div className="kv">
          <span>Consultation</span>
          <b>{fmtDate(c.created_at)}</b>
        </div>
        {c.validated_at && (
          <div className="kv">
            <span>Validée le</span>
            <b>{fmtDate(c.validated_at)}</b>
          </div>
        )}
        <div className="kv">
          <span>Consentement</span>
          <b className="row" style={{ gap: 5, color: "var(--success)" }}>
            <ShieldCheck size={14} />
            Patient et praticien
          </b>
        </div>
      </div>

      {error && (
        <div className="error-box" style={{ marginBottom: 16 }}>
          <TriangleAlert size={15} />
          {error}
        </div>
      )}

      <div className="review">
        <div className="stack-lg">
          <Transcript c={c} />
          <div className="card">
            <div className="card-head">
              <h2>
                <ListChecks size={16} />
                Informations extraites
              </h2>
              <span className="badge b-lime">IA</span>
            </div>
            <div className="facts">
              <Fact k="Motif">{cap(ex?.motif)}</Fact>
              <Fact k="Durée">{ex?.duree}</Fact>
              <Fact k="Symptômes">
                {(ex?.symptomes || [])
                  .filter((s) => s.present)
                  .map((s) => (
                    <span key={s.nom} className="chip pro" title={s.source ?? undefined}>
                      {s.nom}
                      {s.duree ? ` · ${s.duree}` : ""}
                    </span>
                  ))}
              </Fact>
              <Fact k="Signes absents">
                {(ex?.symptomes || [])
                  .filter((s) => !s.present)
                  .map((s) => (
                    <span key={s.nom} className="chip">
                      {s.nom}
                    </span>
                  ))}
              </Fact>
              <Fact k="Localisation">{(ex?.localisations || []).join(", ")}</Fact>
              <Fact k="Antécédents">{(ex?.antecedents || []).join(", ")}</Fact>
              <Fact k="Traitements">{(ex?.traitements || []).join(", ")}</Fact>
              <Fact k="Constantes">
                {(ex?.constantes || []).length ? (
                  <div>
                    {ex!.constantes.map((v) => (
                      <span key={v.nom} className="vital">
                        <b>
                          {v.valeur}
                          {v.unite && !v.unite.includes("/") ? ` ${v.unite}` : ""}
                        </b>
                        <span>{cap(v.nom)}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </Fact>
              <Fact k="Observations">{(ex?.observations || []).join(" ")}</Fact>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>
              <ClipboardCheck size={16} />
              Compte rendu SOAP
            </h2>
            {reviewing &&
              (editing ? (
                <div className="row">
                  <button
                    className="btn btn-quiet btn-sm"
                    onClick={() => {
                      setSoap(c.soap_final);
                      setDirty(false);
                      setEditing(false);
                    }}
                  >
                    Annuler
                  </button>
                  <button className="btn btn-primary btn-sm" disabled={!dirty || busy === "save"} onClick={save}>
                    {busy === "save" ? <LoaderCircle size={13} className="spin" /> : <Save size={13} />}
                    Enregistrer
                  </button>
                </div>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                  <Pencil size={13} />
                  Modifier
                </button>
              ))}
          </div>
          {SOAP_ROWS.map(([k, title, hint]) => (
            <div key={k} className={`soap-block ${k}`}>
              <span className="soap-letter">{k}</span>
              <div style={{ minWidth: 0 }}>
                <h3>
                  {title} <small>{hint}</small>
                  {edited(k) && (
                    <span className="badge b-amber" style={{ marginLeft: "auto" }}>
                      <span className="edited-dot" />
                      Modifié
                    </span>
                  )}
                </h3>
                {editing ? (
                  <>
                    <textarea
                      id={`soap-${k}`}
                      className="textarea"
                      value={soap?.[k] || ""}
                      onChange={(e) => {
                        setSoap({ ...soap!, [k]: e.target.value });
                        setDirty(true);
                      }}
                    />
                    {edited(k) && (
                      <button
                        className="btn btn-quiet btn-sm"
                        style={{ marginTop: 6 }}
                        onClick={() => {
                          setSoap({ ...soap!, [k]: c.soap_draft![k] });
                          setDirty(true);
                        }}
                      >
                        <RotateCcw size={12} />
                        Rétablir la proposition IA
                      </button>
                    )}
                  </>
                ) : (
                  <div className="soap-text">{soap?.[k] || <span className="faint">—</span>}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="stack-lg col-sticky">
          <div className="card">
            <div className="card-head">
              <h2>
                <Sparkles size={16} />
                Pistes diagnostiques
              </h2>
              <span className="tiny faint num">
                {decided}/{dx.length} tranchées
              </span>
            </div>
            <div className="card-pad stack">
              {alerts.map((a) => (
                <div key={a.id} className="sugg-alert">
                  <TriangleAlert size={16} />
                  <div>
                    <b>Signe d&apos;alerte</b>
                    <div className="small">{a.label}</div>
                  </div>
                </div>
              ))}
              {dx.map((s, i) => (
                <div key={s.id} className={`sugg ${s.decision} ${i === 0 && s.decision === "pending" ? "top" : ""}`}>
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="sugg-title">{s.label}</div>
                      <div className="tiny faint">
                        {i === 0 ? "Hypothèse principale" : "Diagnostic différentiel"}
                        {s.code ? ` · CIM-10 ${s.code}` : ""}
                      </div>
                    </div>
                    {s.decision !== "pending" && (
                      <span className={`badge ${s.decision === "accepted" ? "b-green" : "b-red"}`}>{s.decision === "accepted" ? "Retenue" : "Écartée"}</span>
                    )}
                  </div>
                  <div className="conf" title="Score de concordance calculé par l'agent">
                    <div className="bar">
                      <i style={{ width: `${Math.max(3, (s.confiance || 0) * 100)}%` }} />
                    </div>
                    <b>{Math.round((s.confiance || 0) * 100)} %</b>
                  </div>
                  <div>
                    {s.arguments_pour.map((a) => (
                      <span key={a} className="chip pro">
                        + {a}
                      </span>
                    ))}
                    {s.arguments_contre.map((a) => (
                      <span key={a} className="chip contra">
                        − {a}
                      </span>
                    ))}
                  </div>
                  {reviewing && (
                    <div className="row">
                      <button
                        className={`btn btn-sm btn-ok ${s.decision === "accepted" ? "on" : ""}`}
                        onClick={() => decide(s, "accepted")}
                        disabled={busy === "decide"}
                        aria-pressed={s.decision === "accepted"}
                      >
                        <Check size={14} />
                        Retenir
                      </button>
                      <button
                        className={`btn btn-sm btn-no ${s.decision === "rejected" ? "on" : ""}`}
                        onClick={() => decide(s, "rejected")}
                        disabled={busy === "decide"}
                        aria-pressed={s.decision === "rejected"}
                      >
                        <X size={14} />
                        Écarter
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {dx.length === 0 && <p className="small muted">Aucune piste proposée : les informations recueillies ne suffisent pas.</p>}
            </div>
          </div>

          {plan.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h2>
                  <ListChecks size={16} />
                  Prise en charge suggérée
                </h2>
              </div>
              <div className="card-pad" style={{ paddingTop: 6, paddingBottom: 6 }}>
                {plan.map((p) => (
                  <div key={p.id} className={`plan-item ${p.decision}`}>
                    <span>{p.label}</span>
                    <div className="mini-toggle">
                      <button className={`ok ${p.decision === "accepted" ? "on" : ""}`} onClick={() => decide(p, "accepted")} disabled={!reviewing} aria-label="Retenir" title="Retenir">
                        <Check size={14} />
                      </button>
                      <button className={`no ${p.decision === "rejected" ? "on" : ""}`} onClick={() => decide(p, "rejected")} disabled={!reviewing} aria-label="Écarter" title="Écarter">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <p className="tiny faint" style={{ padding: "8px 0" }}>
                  Suggestions issues des protocoles de la base de connaissances. À adapter au patient.
                </p>
              </div>
            </div>
          )}

          <details className="card">
            <summary className="card-head" style={{ cursor: "pointer", borderBottom: 0 }}>
              <h2>
                <Bot size={16} />
                Trace de l&apos;agent
              </h2>
              <span className="tiny faint">{c.steps.length} étapes</span>
            </summary>
            <div className="card-pad" style={{ paddingTop: 0 }}>
              <AgentSteps steps={c.steps} />
            </div>
          </details>
        </div>
      </div>

      <div className="actionbar">
        {c.status === "review" ? (
          <>
            <div className="progress-ring">
              <div className="bar lg" style={{ width: 90 }}>
                <i style={{ width: `${dx.length ? (decided / dx.length) * 100 : 100}%` }} />
              </div>
              <span>
                <b className="num">
                  {decided}/{dx.length}
                </b>{" "}
                pistes tranchées
              </span>
            </div>
            <span className="disclaimer" style={{ flex: 1, minWidth: 220 }}>
              <Info size={14} />
              En validant, vous attestez avoir relu le compte rendu. Les suggestions IA ne constituent pas une décision médicale.
            </span>
            <button
              className="btn btn-success btn-lg"
              onClick={validate}
              disabled={!!busy || decided < dx.length}
              title={decided < dx.length ? "Retenez ou écartez chaque piste diagnostique" : ""}
            >
              {busy === "validate" ? <LoaderCircle size={18} className="spin" /> : <ShieldCheck size={18} />}
              Valider le compte rendu
            </button>
          </>
        ) : (
          <>
            <span className="row small" style={{ flex: 1, minWidth: 220, color: "var(--success)" }}>
              <ShieldCheck size={16} />
              <b>Validé par le praticien</b>
              <span className="muted">· {fmtDate(c.validated_at)}</span>
            </span>
            <button
              className="btn btn-ghost"
              onClick={() => router.push(`/evaluation?depuis=${c.id}`)}
              title="Utiliser cette transcription comme cas du jeu d'évaluation"
            >
              <Database size={16} />
              Ajouter au jeu de cas
            </button>
            <button className="btn btn-ghost" onClick={doExport}>
              <FileDown size={16} />
              Exporter
            </button>
            {c.status === "validated" && (
              <button className="btn btn-navy" onClick={() => setConfirmArchive(true)}>
                <Archive size={16} />
                Archiver
              </button>
            )}
          </>
        )}
      </div>

      {exported != null && <ExportModal text={exported} onClose={() => setExported(null)} />}
      {confirmArchive && (
        <Modal
          title="Archiver la consultation ?"
          onClose={() => setConfirmArchive(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirmArchive(false)}>
                Annuler
              </button>
              <button className="btn btn-navy" onClick={archive} disabled={busy === "archive"}>
                {busy === "archive" ? <LoaderCircle size={15} className="spin" /> : <Archive size={15} />}
                Archiver
              </button>
            </>
          }
        >
          <p className="muted">Le compte rendu passera en lecture seule de façon définitive. Il restera consultable et exportable.</p>
        </Modal>
      )}
    </>
  );
}
