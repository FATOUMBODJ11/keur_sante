"use client";

import { BadgeCheck, Database, FlaskConical, Info, LoaderCircle, Pencil, Play, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/providers";
import { LangTag, Loading, Modal } from "@/components/ui";
import { dt, type CaseDraft } from "@/lib/client/api";
import { fmtDate, parseTurns, whoLabel } from "@/lib/client/format";
import { KNOWLEDGE_BASE } from "@/lib/data/knowledge";
import { SYMPTOMS } from "@/lib/data/lexicon";
import type { AnnotatedCase, CaseResult, EvalRun, EvalSummary, Lang } from "@/lib/types";

const METRICS: [keyof EvalSummary, string, string][] = [
  ["diagnostic_top1", "Diagnostic, rang 1", "La piste principale de l'IA correspond au diagnostic de référence."],
  ["diagnostic_top3", "Diagnostic, top 3", "Le diagnostic de référence figure parmi les trois premières pistes."],
  ["extraction_symptomes_f1", "Extraction des symptômes", "F1 entre symptômes extraits et symptômes annotés."],
  ["extraction_constantes_f1", "Extraction des constantes", "F1 sur les constantes mesurées (température, TA, FC…)."],
  ["plan_concordance", "Concordance du plan", "Part des éléments du plan de référence retrouvés dans les suggestions."],
  ["soap_completude", "Complétude SOAP", "Les quatre rubriques S, O, A, P sont renseignées."],
  ["detection_langue_exactitude", "Détection de la langue", "Français ou wolof correctement identifié."],
  ["traduction_f1", "Traduction wolof → français", "Préservation des termes cliniques après traduction."],
];

const level = (x: number | null | undefined) => (x == null ? "na" : x >= 0.85 ? "hi" : x >= 0.6 ? "mid" : "lo");
const pct = (x: number | null | undefined) => (x == null ? "n/d" : `${Math.round(x * 100)} %`);

export default function EvaluationPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const fromConsultation = params.get("depuis");
  const [cases, setCases] = useState<AnnotatedCase[] | null>(null);
  const [runs, setRuns] = useState<EvalRun[] | null>(null);
  const [runIdx, setRunIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [langFilter, setLangFilter] = useState<"all" | Lang>("all");
  const [editor, setEditor] = useState<{ initial: CaseDraft; id?: string } | null>(null);
  const [wolof, setWolof] = useState(false);
  useEffect(() => {
    dt.providers()
      .then((p) => setWolof(p.wolof_enabled))
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([dt.listCases(), dt.listRuns()])
      .then(([c, r]) => {
        setCases(c);
        setRuns(r);
      })
      .catch((e) => setError(e.message));
  }, []);

  // « Ajouter au jeu de cas » depuis une consultation validée : seule la transcription est reprise.
  useEffect(() => {
    if (!fromConsultation) return;
    dt.getConsultation(fromConsultation)
      .then((c) => {
        const lang: Lang = c.language_detected ?? "fr";
        setEditor({
          initial: {
            ...emptyCase(lang),
            scenario: `Consultation ${c.id} du ${fmtDate(c.created_at, { dateStyle: "long" })}`,
            reference_transcript: c.transcript_source,
            ...(lang === "wo" ? { reference_transcript_fr: c.transcript_fr } : {}),
            source_consultation: c.id,
          },
        });
        router.replace("/evaluation");
      })
      .catch((e) => setError(e.message));
  }, [fromConsultation, router]);

  const run = runs?.[runIdx];
  const perCase = useMemo(() => (run?.per_case || []).filter((r) => langFilter === "all" || r.langue === langFilter), [run, langFilter]);

  const runEval = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await dt.runEval();
      setRuns((prev) => [r, ...(prev || [])]);
      setRunIdx(0);
      toast(`Évaluation terminée sur ${r.summary.n_cas} cas`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saved = (c: AnnotatedCase, created: boolean) => {
    setCases((list) => (created ? [...(list || []), c] : (list || []).map((x) => (x.case_id === c.case_id ? c : x))).sort((a, b) => a.case_id.localeCompare(b.case_id)));
    setEditor(null);
    toast(created ? `Cas ${c.case_id} ajouté` : `Cas ${c.case_id} enregistré`);
  };

  const remove = async (c: AnnotatedCase) => {
    if (!window.confirm(`Supprimer le cas ${c.case_id} ?`)) return;
    try {
      await dt.deleteCase(c.case_id);
      setCases((list) => (list || []).filter((x) => x.case_id !== c.case_id));
      setDetail(null);
      toast(`Cas ${c.case_id} supprimé`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error && !cases)
    return (
      <div className="error-box">
        <TriangleAlert size={15} />
        {error}
      </div>
    );
  if (!cases || !runs) return <Loading />;

  const summary = run?.summary;
  const validatedCount = cases.filter((c) => c.validated).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <FlaskConical size={13} />
            Qualité
          </div>
          <h1>Validation clinique</h1>
          <p>
            L&apos;agent est comparé à un jeu de cas annotés par des professionnels de santé. Chaque composant est évalué
            séparément : langue, extraction, diagnostic, plan et compte rendu.
          </p>
        </div>
        <div className="row wrap">
          {runs.length > 1 && (
            <select id="run" className="select" style={{ width: "auto" }} value={runIdx} onChange={(e) => setRunIdx(Number(e.target.value))}>
              {runs.map((r, i) => (
                <option key={r.id} value={i}>
                  Évaluation n° {r.id} · {fmtDate(r.created_at, { dateStyle: "short", timeStyle: "short" })}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-ghost" onClick={() => setEditor({ initial: emptyCase("fr") })}>
            <Plus size={16} />
            Ajouter un cas
          </button>
          <button className="btn btn-primary" onClick={runEval} disabled={busy || cases.length === 0}>
            {busy ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
            Lancer une évaluation
          </button>
        </div>
      </div>

      {error && (
        <div className="error-box" style={{ marginBottom: 16 }}>
          <TriangleAlert size={15} />
          {error}
        </div>
      )}

      <div className="grid g-3" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <span className="stat-label">
            <Database size={15} />
            Cas annotés
          </span>
          <span className="stat-value">{cases.length}</span>
          <span className="stat-sub">
            {cases.filter((c) => c.language === "fr").length} en français · {cases.filter((c) => c.language === "wo").length} en wolof
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">
            <BadgeCheck size={15} />
            Références validées
          </span>
          <span className="stat-value">
            {validatedCount}
            <small>/{cases.length}</small>
          </span>
          <span className="stat-sub">
            {cases.length === 0 ? "Aucun cas pour l'instant" : validatedCount < cases.length ? "En attente de relecture médicale" : "Toutes relues par un médecin"}
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">
            <FlaskConical size={15} />
            Dernière évaluation
          </span>
          <span className="stat-value" style={{ fontSize: 22, paddingTop: 6 }}>
            {run ? fmtDate(run.created_at) : "—"}
          </span>
          <span className="stat-sub">Moteur : {run?.config.llm || "—"}</span>
        </div>
      </div>

      {cases.length > 0 && validatedCount < cases.length && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          <Info size={15} />
          <span>
            Certaines références ne sont <b>pas encore validées</b>. Les résultats deviendront une mesure de concordance clinique
            quand chaque référence aura été établie ou validée par un professionnel de santé (§ 7.2 du cahier des charges).
          </span>
        </div>
      )}

      {summary && (
        <div className="grid g-4" style={{ marginBottom: 16 }}>
          {METRICS.filter(([k]) => wolof || k !== "traduction_f1").map(([k, name, desc]) => {
            const v = summary[k] as number | null;
            return (
              <div key={k} className="card metric">
                <div className="metric-top">
                  <span className="metric-name">{name}</span>
                  <span className={`score ${level(v)}`}>{pct(v)}</span>
                </div>
                <div className="bar">
                  <i style={{ width: `${(v ?? 0) * 100}%` }} />
                </div>
                <span className="metric-desc">{desc}</span>
              </div>
            );
          })}
        </div>
      )}

      {summary && (
        <div className="grid g-main" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-head">
              <h2>Résultats par cas</h2>
              {wolof && (
              <div className="seg">
                {(
                  [
                    ["all", "Tous"],
                    ["fr", "Français"],
                    ["wo", "Wolof"],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} className={langFilter === k ? "on" : ""} onClick={() => setLangFilter(k)}>
                    {label}
                  </button>
                ))}
              </div>
              )}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cas</th>
                    <th>Diagnostic de référence</th>
                    <th>Rang IA</th>
                    <th className="num">Symptômes</th>
                    <th className="num">Constantes</th>
                    <th className="num">Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {perCase.map((r) => (
                    <tr key={r.case_id} className="clickable" onClick={() => setDetail(r.case_id)}>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="mono" style={{ color: "var(--text)", whiteSpace: "nowrap" }}>
                            {r.case_id}
                          </span>
                          <LangTag code={r.langue} />
                        </div>
                      </td>
                      <td style={{ minWidth: 180 }}>
                        <div className="strong">{r.diagnostic_reference}</div>
                        {r.diagnostic.rang !== 1 && <div className="tiny faint">IA : {r.diagnostics_ia[0] ?? "aucune piste"}</div>}
                      </td>
                      <td>
                        {r.diagnostic.rang ? (
                          <span className={`badge ${r.diagnostic.rang === 1 ? "b-green" : "b-amber"}`}>n° {r.diagnostic.rang}</span>
                        ) : (
                          <span className="badge b-red">absent</span>
                        )}
                      </td>
                      <td className="num">
                        <span className={`score ${level(r.extraction_symptomes.f1)}`}>{pct(r.extraction_symptomes.f1)}</span>
                      </td>
                      <td className="num">
                        <span
                          className={`score ${level(r.extraction_constantes.f1)}`}
                          title={r.extraction_constantes.manquants.length ? `Manquant : ${r.extraction_constantes.manquants.join(", ")}` : ""}
                        >
                          {pct(r.extraction_constantes.f1)}
                        </span>
                      </td>
                      <td className="num">
                        <span className={`score ${level(r.plan_concordance)}`}>{pct(r.plan_concordance)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="stack-lg">
            <div className="card">
              <div className="card-head">
                <h2>Par langue</h2>
              </div>
              <div className="card-pad stack">
                {Object.entries(summary.par_langue || {}).map(([l, v]) => (
                  <div key={l} className="stack" style={{ gap: 6 }}>
                    <div className="row">
                      <LangTag code={l as Lang} />
                      <b>{l === "wo" ? "Wolof" : "Français"}</b>
                      <span className="faint small">{v!.n} cas</span>
                      <span className="spacer" />
                      <span className={`score ${level(v!.top1)}`}>{pct(v!.top1)}</span>
                    </div>
                    <div className="bar">
                      <i style={{ width: `${v!.top1 * 100}%` }} />
                    </div>
                    <span className="tiny faint">Diagnostic au rang 1 · de bout en bout : {pct(v!.top1_bout_en_bout)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h2>Reconnaissance vocale</h2>
                <span className="badge b-grey">WER {summary.wer_moyen == null ? "n/d" : pct(summary.wer_moyen)}</span>
              </div>
              <div className="card-pad small muted stack">
                <p>Le taux d&apos;erreur de mots (WER) se mesure sur des enregistrements audio réels comparés à la transcription de référence.</p>
                <p>
                  {wolof
                    ? "Pour le wolof, Kiriku-Wolof-ASR (AI Hub Senegal) est en phase de test : ajoutez une hypothèse ASR à chaque cas pour l'évaluer."
                    : "Le wolof est en pause : seuls les cas en français sont évalués."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>
            <Database size={16} />
            Jeu de cas annotés
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditor({ initial: emptyCase("fr") })}>
            <Plus size={14} />
            Ajouter un cas
          </button>
        </div>
        {cases.length === 0 ? (
          <div className="empty">
            <Database size={26} />
            <span>
              Aucun cas annoté. Chaque cas associe une transcription de consultation à une référence établie ou validée par un
              professionnel de santé : diagnostic, symptômes, constantes et plan. Ajoutez vos cas, ou reprenez la transcription
              d&apos;une consultation validée (« Ajouter au jeu de cas »).
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => setEditor({ initial: emptyCase("fr") })}>
              <Plus size={14} />
              Ajouter un cas
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cas</th>
                  <th>Scénario</th>
                  <th>Diagnostic de référence</th>
                  <th>Référence</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.case_id} className="clickable" onClick={() => setDetail(c.case_id)}>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="mono" style={{ color: "var(--text)", whiteSpace: "nowrap" }}>
                          {c.case_id}
                        </span>
                        <LangTag code={c.language} />
                      </div>
                    </td>
                    <td className="small muted">{c.scenario || "—"}</td>
                    <td className="strong">{c.reference_diagnosis}</td>
                    <td>{c.validated ? <span className="badge b-green">Validée</span> : <span className="badge b-amber">À valider</span>}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-quiet btn-icon btn-sm" title="Modifier" aria-label="Modifier" onClick={() => setEditor({ initial: toDraft(c), id: c.case_id })}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-quiet btn-icon btn-sm" title="Supprimer" aria-label="Supprimer" onClick={() => remove(c)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <CaseDetail
          c={cases.find((x) => x.case_id === detail)}
          r={run?.per_case.find((x) => x.case_id === detail)}
          onClose={() => setDetail(null)}
          onEdit={(c) => {
            setDetail(null);
            setEditor({ initial: toDraft(c), id: c.case_id });
          }}
        />
      )}
      {editor && <CaseEditor initial={editor.initial} id={editor.id} wolof={wolof} onClose={() => setEditor(null)} onSaved={saved} />}
    </>
  );
}

/* ------------------------------------------------------------------ */

function emptyCase(language: Lang): CaseDraft {
  return {
    language,
    scenario: "",
    reference_transcript: "",
    reference_entities: { symptomes_presents: [], constantes: [] },
    reference_diagnosis: "",
    differentials: [],
    reference_plan: [],
    annotated_by: "",
    validated: false,
    source_consultation: null,
  };
}

function toDraft(c: AnnotatedCase): CaseDraft {
  const { case_id: _id, created_at: _at, created_by: _by, ...rest } = c;
  void _id;
  void _at;
  void _by;
  return rest;
}

function CaseDetail({
  c,
  r,
  onClose,
  onEdit,
}: {
  c: AnnotatedCase | undefined;
  r: CaseResult | undefined;
  onClose: () => void;
  onEdit: (c: AnnotatedCase) => void;
}) {
  if (!c) return null;
  return (
    <Modal
      title={`Cas ${c.case_id}`}
      onClose={onClose}
      wide
      footer={
        <button className="btn btn-ghost" onClick={() => onEdit(c)}>
          <Pencil size={15} />
          Modifier le cas
        </button>
      }
    >
      <div className="stack-lg">
        <div className="row wrap">
          <LangTag code={c.language} />
          <span className="muted">{c.scenario}</span>
          <span className="spacer" />
          {c.validated ? (
            <span className="badge b-green">
              <BadgeCheck size={12} />
              Référence validée
            </span>
          ) : (
            <span className="badge b-amber">{c.annotated_by || "À valider"}</span>
          )}
        </div>
        <div className="case-detail">
          <div className="stack">
            <span className="label">Transcription de référence</span>
            <div className="doc" style={{ fontFamily: "var(--font)", fontSize: 13 }}>
              {parseTurns(c.reference_transcript).map((t, i) => (
                <div key={i} className="turn" style={{ padding: "3px 0" }}>
                  <span className={`who ${t.who}`}>{whoLabel(t.who)}</span>
                  <span>{t.text}</span>
                </div>
              ))}
            </div>
            {c.reference_transcript_fr && (
              <>
                <span className="label">Traduction de référence</span>
                <div className="doc" style={{ fontFamily: "var(--font)", fontSize: 13 }}>
                  {c.reference_transcript_fr}
                </div>
              </>
            )}
          </div>
          <div className="stack">
            <span className="label">Annotation médicale</span>
            <div className="facts card" style={{ boxShadow: "none" }}>
              <div className="fact">
                <span>Diagnostic</span>
                <b>{c.reference_diagnosis}</b>
              </div>
              <div className="fact">
                <span>Différentiels</span>
                <div>{c.differentials.join(", ") || "—"}</div>
              </div>
              <div className="fact">
                <span>Symptômes</span>
                <div>
                  {c.reference_entities.symptomes_presents.map((s) => (
                    <span key={s} className="chip pro">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="fact">
                <span>Constantes</span>
                <div>{c.reference_entities.constantes.join(", ") || "—"}</div>
              </div>
              <div className="fact">
                <span>Plan</span>
                <div>
                  {c.reference_plan.map((p) => (
                    <div key={p}>· {p}</div>
                  ))}
                </div>
              </div>
            </div>
            {r && (
              <>
                <span className="label">Proposition de l&apos;IA</span>
                <div className="facts card" style={{ boxShadow: "none" }}>
                  <div className="fact">
                    <span>Pistes</span>
                    <div>
                      {r.diagnostics_ia.length === 0 && "Aucune"}
                      {r.diagnostics_ia.map((d, i) => (
                        <div key={d} className={i + 1 === r.diagnostic.rang ? "strong" : ""} style={i + 1 === r.diagnostic.rang ? { color: "var(--success)" } : undefined}>
                          {i + 1}. {d}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="fact">
                    <span>Manquants</span>
                    <div>{[...r.extraction_symptomes.manquants, ...r.extraction_constantes.manquants].join(", ") || "Aucun"}</div>
                  </div>
                  <div className="fact">
                    <span>En trop</span>
                    <div>{[...r.extraction_symptomes.en_trop, ...r.extraction_constantes.en_trop].join(", ") || "Aucun"}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

const csv = (xs: string[]) => xs.join(", ");
const fromCsv = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function CaseEditor({
  initial,
  id,
  wolof,
  onClose,
  onSaved,
}: {
  initial: CaseDraft;
  id?: string;
  wolof: boolean;
  onClose: () => void;
  onSaved: (c: AnnotatedCase, created: boolean) => void;
}) {
  const [f, setF] = useState(initial);
  const [symptoms, setSymptoms] = useState(csv(initial.reference_entities.symptomes_presents));
  const [vitals, setVitals] = useState(csv(initial.reference_entities.constantes));
  const [differentials, setDifferentials] = useState(csv(initial.differentials));
  const [plan, setPlan] = useState(initial.reference_plan.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof CaseDraft>(k: K, v: CaseDraft[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError("");
    const body: CaseDraft = {
      ...f,
      reference_entities: { symptomes_presents: fromCsv(symptoms), constantes: fromCsv(vitals) },
      differentials: fromCsv(differentials),
      reference_plan: plan
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
    };
    try {
      onSaved(id ? await dt.updateCase(id, body) : await dt.createCase(body), !id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={id ? `Modifier le cas ${id}` : "Nouveau cas annoté"}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <LoaderCircle size={15} className="spin" /> : <BadgeCheck size={15} />}
            Enregistrer le cas
          </button>
        </>
      }
    >
      <div className="stack-lg case-form">
        {f.source_consultation && (
          <div className="info-box">
            <Info size={15} />
            <span>
              Transcription reprise de la consultation <b>{f.source_consultation}</b>. Établissez la référence (diagnostic,
              symptômes, plan) <b>indépendamment des propositions de l&apos;IA</b>, sinon l&apos;évaluation mesurerait l&apos;IA contre
              elle-même.
            </span>
          </div>
        )}
        <div className="grid g-2">
          <div className="field">
            <span className="label">Langue de la consultation</span>
            <div className="seg">
              {(["fr", "wo"] as Lang[]).filter((l) => wolof || l === "fr" || f.language === l).map((l) => (
                <button key={l} className={f.language === l ? "on" : ""} onClick={() => !id && set("language", l)} disabled={!!id && f.language !== l}>
                  {l === "fr" ? "Français" : "Wolof"}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="scenario">
              Scénario clinique
            </label>
            <input id="scenario" className="input" placeholder="ex. Adulte, fièvre depuis 3 jours" value={f.scenario} onChange={(e) => set("scenario", e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="rt">
            Transcription de référence
          </label>
          <textarea
            id="rt"
            className="textarea"
            value={f.reference_transcript}
            onChange={(e) => set("reference_transcript", e.target.value)}
            placeholder={"Médecin: …\nPatient: …"}
          />
          <span className="tiny faint">Une ligne par tour de parole, préfixée par « Médecin: » ou « Patient: ».</span>
        </div>
        {f.language === "wo" && (
          <div className="field">
            <label className="label" htmlFor="rtfr">
              Traduction française de référence
            </label>
            <textarea id="rtfr" className="textarea" value={f.reference_transcript_fr ?? ""} onChange={(e) => set("reference_transcript_fr", e.target.value)} />
          </div>
        )}
        <div className="grid g-2">
          <div className="field">
            <label className="label" htmlFor="dx">
              Diagnostic de référence
            </label>
            <input id="dx" className="input" list="kb-dx" value={f.reference_diagnosis} onChange={(e) => set("reference_diagnosis", e.target.value)} />
            <datalist id="kb-dx">
              {KNOWLEDGE_BASE.map((k) => (
                <option key={k.name} value={k.name} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label className="label" htmlFor="diff">
              Diagnostics différentiels
            </label>
            <input id="diff" className="input" placeholder="séparés par des virgules" value={differentials} onChange={(e) => setDifferentials(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="sym">
              Symptômes présents
            </label>
            <input id="sym" className="input" placeholder="séparés par des virgules" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
            <span className="tiny faint">Vocabulaire : {Object.keys(SYMPTOMS).slice(0, 10).join(", ")}…</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="vit">
              Constantes mesurées
            </label>
            <input id="vit" className="input" placeholder="température, tension artérielle, SpO2…" value={vitals} onChange={(e) => setVitals(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="plan">
            Plan de prise en charge de référence
          </label>
          <textarea id="plan" className="textarea" placeholder="Une action par ligne" value={plan} onChange={(e) => setPlan(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="asr">
            Hypothèse ASR <span className="faint">(facultatif)</span>
          </label>
          <textarea
            id="asr"
            className="textarea"
            style={{ minHeight: 70 }}
            placeholder="Sortie brute de Whisper ou de Kiriku-Wolof-ASR sur l'enregistrement, pour mesurer le WER"
            value={f.asr_hypothesis ?? ""}
            onChange={(e) => set("asr_hypothesis", e.target.value)}
          />
        </div>
        <div className="grid g-2">
          <div className="field">
            <label className="label" htmlFor="by">
              Annoté par
            </label>
            <input id="by" className="input" placeholder="ex. Dr …, médecin généraliste" value={f.annotated_by} onChange={(e) => set("annotated_by", e.target.value)} />
          </div>
          <label className={`consent ${f.validated ? "on" : ""}`}>
            <input type="checkbox" checked={f.validated} onChange={(e) => set("validated", e.target.checked)} />
            <div>
              <b>Référence validée par un professionnel de santé</b>
              <span>Le diagnostic, les symptômes et le plan ont été établis ou relus par un soignant.</span>
            </div>
          </label>
        </div>
        {error && (
          <div className="error-box">
            <TriangleAlert size={15} />
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
