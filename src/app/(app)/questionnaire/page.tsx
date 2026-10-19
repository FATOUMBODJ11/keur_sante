"use client";

import { CircleCheck, LoaderCircle, MessageSquareHeart, Send, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/providers";
import { Loading } from "@/components/ui";
import { dt, type SurveyResults } from "@/lib/client/api";
import { fmtDate } from "@/lib/client/format";
import { SUS_ITEMS, susGrade } from "@/lib/survey";

const SCALE = [
  [1, "Pas du tout d'accord"],
  [2, ""],
  [3, ""],
  [4, ""],
  [5, "Tout à fait d'accord"],
] as const;

export default function SurveyPage() {
  const toast = useToast();
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(10).fill(null));
  const [timeSaved, setTimeSaved] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    dt.surveys().then(setResults).catch((e) => setError(e.message));
  }, []);

  const complete = answers.every((a) => a !== null);
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await dt.submitSurvey({ answers: answers as number[], time_saved_minutes: timeSaved === "" ? null : Number(timeSaved.replace(",", ".")), comment });
      setResults(await dt.surveys());
      setSent(true);
      toast("Merci pour votre réponse");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <MessageSquareHeart size={13} />
            Qualité
          </div>
          <h1>Questionnaire d&apos;usage</h1>
          <p>
            Questionnaire SUS (System Usability Scale), la référence pour mesurer la facilité d&apos;utilisation d&apos;un logiciel.
            À remplir par chaque praticien après quelques consultations réelles.
          </p>
        </div>
      </div>

      <div className="grid g-3" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <span className="stat-label">Score SUS moyen</span>
          <span className="stat-value">
            {results?.sus_moyen ?? "—"}
            <small>/100</small>
          </span>
          <span className="stat-sub">{susGrade(results?.sus_moyen ?? null)} · seuil d&apos;acceptabilité : 68</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Réponses</span>
          <span className="stat-value">{results?.n ?? "—"}</span>
          <span className="stat-sub">praticiens ayant répondu</span>
        </div>
        <div className="card stat">
          <span className="stat-label">Temps gagné déclaré</span>
          <span className="stat-value">
            {results?.temps_gagne_moyen ?? "—"}
            <small> min</small>
          </span>
          <span className="stat-sub">par consultation, en moyenne</span>
        </div>
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
            <h2>Votre avis</h2>
            <span className="tiny faint">{answers.filter((a) => a !== null).length}/10</span>
          </div>
          {sent ? (
            <div className="card-pad">
              <div className="info-box">
                <CircleCheck size={15} />
                <span>Réponse enregistrée. Merci ! Vous pourrez répondre à nouveau après de nouvelles consultations.</span>
              </div>
            </div>
          ) : (
            <div className="card-pad stack-lg">
              {SUS_ITEMS.map((item, i) => (
                <div key={i} className="stack" style={{ gap: 8 }}>
                  <div className="strong">
                    {i + 1}. {item}
                  </div>
                  <div className="seg" role="radiogroup" aria-label={item} style={{ flexWrap: "wrap" }}>
                    {SCALE.map(([v, label]) => (
                      <button
                        key={v}
                        role="radio"
                        aria-checked={answers[i] === v}
                        className={answers[i] === v ? "on" : ""}
                        onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? v : x)))}
                        title={label || String(v)}
                      >
                        {v}
                        {label && <span className="tiny faint" style={{ marginLeft: 6 }}>{label}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="grid g-2" style={{ gap: 12 }}>
                <div className="field">
                  <label className="label" htmlFor="time">
                    Temps gagné par consultation (minutes)
                  </label>
                  <input id="time" className="input" inputMode="decimal" placeholder="ex. 5" value={timeSaved} onChange={(e) => setTimeSaved(e.target.value.replace(/[^0-9.,]/g, ""))} />
                </div>
              </div>
              <div className="field">
                <label className="label" htmlFor="comment">
                  Commentaire libre
                </label>
                <textarea id="comment" className="textarea" placeholder="Ce qui vous a aidé, ce qui vous a gêné, ce qui manque…" value={comment} onChange={(e) => setComment(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-lg" disabled={!complete || busy} onClick={submit}>
                {busy ? <LoaderCircle size={18} className="spin" /> : <Send size={18} />}
                Envoyer ma réponse
              </button>
              {!complete && <p className="tiny faint">Répondez aux 10 affirmations pour envoyer.</p>}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Réponses reçues</h2>
          </div>
          {!results ? (
            <Loading />
          ) : results.surveys.length === 0 ? (
            <div className="empty">
              <span>Aucune réponse pour l&apos;instant.</span>
            </div>
          ) : (
            <div className="card-pad stack">
              {results.surveys.map((s) => (
                <div key={s.id} className="stack" style={{ gap: 4, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                  <div className="row">
                    <b>{s.user_name}</b>
                    <span className="spacer" />
                    <span className={`score ${s.score >= 72 ? "hi" : s.score >= 52 ? "mid" : "lo"}`}>SUS {s.score}</span>
                  </div>
                  <span className="tiny faint">
                    {fmtDate(s.created_at)}
                    {s.time_saved_minutes !== null ? ` · ${s.time_saved_minutes} min gagnées` : ""}
                  </span>
                  {s.comment && <span className="small muted">« {s.comment} »</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
