"use client";

import {
  ArrowRight,
  CircleCheck,
  FileText,
  Info,
  Keyboard,
  Languages,
  LoaderCircle,
  Mic,
  RotateCcw,
  Square,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRefreshCounts } from "@/components/providers";
import { AgentSteps } from "@/components/ui";
import { Waves } from "@/components/Waves";
import { dt } from "@/lib/client/api";
import { dictationSupported, startDictation } from "@/lib/client/dictation";
import { inferSpeaker } from "@/lib/agent/speakers";
import { LANG } from "@/lib/client/format";
import type { Consultation, LangPref, Providers, Speaker } from "@/lib/types";

type Job = { kind: "audio"; blob: Blob } | { kind: "transcript"; text: string; source: "dictee" | "texte" };

const STEPS = ["Patient et consentement", "Capture", "Analyse par l'agent", "Validation"];

function Stepper({ at }: { at: number }) {
  return (
    <div className="stepper" aria-label="Progression">
      {STEPS.map((label, i) => (
        <span key={label} className="row" style={{ gap: 6 }}>
          {i > 0 && <span className="sep" />}
          <span className={`st ${i === at ? "on" : i < at ? "done" : ""}`}>
            <b>{i < at ? "✓" : i + 1}</b>
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function NewConsultation() {
  const [step, setStep] = useState(0);
  const [consult, setConsult] = useState<Consultation | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Nouvelle consultation</div>
          <h1>{["Avant de commencer", "Consultation en cours", "L'agent prépare le compte rendu"][step]}</h1>
        </div>
      </div>
      <Stepper at={step} />
      {step === 0 && (
        <PatientConsent
          onReady={(c) => {
            setConsult(c);
            setStep(1);
          }}
        />
      )}
      {step === 1 && consult && (
        <Capture
          consult={consult}
          onDone={(j) => {
            setJob(j);
            setStep(2);
          }}
        />
      )}
      {step === 2 && consult && job && <Processing consult={consult} job={job} onRetry={() => setStep(1)} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 1 : patient et consentement                                   */
/* ------------------------------------------------------------------ */

function PatientConsent({ onReady }: { onReady: (c: Consultation) => void }) {
  const [kind, setKind] = useState<"new" | "existing">("new");
  const [code, setCode] = useState("");
  const [sex, setSex] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [language, setLanguage] = useState<LangPref>("auto");
  const [wolof, setWolof] = useState<boolean | null>(null);
  useEffect(() => {
    dt.providers()
      .then((p) => {
        setWolof(p.wolof_enabled);
        if (!p.wolof_enabled) setLanguage("fr");
      })
      .catch(() => setWolof(false));
  }, []);
  const [consentPatient, setConsentPatient] = useState(false);
  const [consentPractitioner, setConsentPractitioner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      onReady(
        await dt.createConsultation({
          language,
          consent_patient: consentPatient,
          consent_practitioner: consentPractitioner,
          ...(kind === "existing"
            ? { patient_code: code.trim() }
            : { patient: { sex, birth_year: birthYear ? Number(birthYear) : null } }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const both = consentPatient && consentPractitioner;

  return (
    <div className="grid g-2" style={{ alignItems: "start" }}>
      <div className="card">
        <div className="card-head">
          <h2>
            <UserRound size={16} />
            Patient
          </h2>
          <div className="seg">
            <button className={kind === "new" ? "on" : ""} onClick={() => setKind("new")}>
              Nouveau
            </button>
            <button className={kind === "existing" ? "on" : ""} onClick={() => setKind("existing")}>
              Déjà suivi
            </button>
          </div>
        </div>
        <div className="card-pad stack-lg">
          {kind === "new" ? (
            <div className="grid g-2" style={{ gap: 12 }}>
              <div className="field">
                <span className="label">Sexe</span>
                <div className="seg">
                  {[
                    ["", "Non précisé"],
                    ["F", "Femme"],
                    ["M", "Homme"],
                  ].map(([k, label]) => (
                    <button key={k} className={sex === k ? "on" : ""} onClick={() => setSex(k)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="label" htmlFor="by">
                  Année de naissance
                </label>
                <input
                  id="by"
                  className="input"
                  inputMode="numeric"
                  placeholder="ex. 1987"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>
            </div>
          ) : (
            <div className="field">
              <label className="label" htmlFor="code">
                Code patient
              </label>
              <input id="code" className="input mono" placeholder="KS-P-000102" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            </div>
          )}
          <div className="info-box">
            <Info size={15} />
            <span>Le patient est identifié par un code pseudonyme. Ne saisissez ni nom ni numéro de téléphone.</span>
          </div>
          <div className="field">
            <span className="label">Langue de la consultation</span>
            <div className="choice-grid">
              {(
                [
                  ["auto", "Détection auto", "L'agent identifie la langue"],
                  ["fr", "Français", "Transcription directe"],
                  ["wo", "Wolof", "Kiriku-Wolof-ASR puis traduction"],
                ] as [LangPref, string, string][]
              )
                .filter(([k]) => wolof || k === "fr")
                .map(([k, t, d]) => (
                <button key={k} className={`choice ${language === k ? "on" : ""}`} onClick={() => setLanguage(k)} aria-pressed={language === k}>
                  <b>{t}</b>
                  <span>{d}</span>
                </button>
              ))}
            </div>
            {wolof === false && <span className="tiny faint">Le wolof est en pause : les consultations se font en français.</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <CircleCheck size={16} />
            Consentement
          </h2>
          <span className={`badge ${both ? "b-green" : "b-amber"}`}>{both ? "Recueilli" : "Requis"}</span>
        </div>
        <div className="card-pad stack">
          <label className={`consent ${consentPatient ? "on" : ""}`}>
            <input id="cp" type="checkbox" checked={consentPatient} onChange={(e) => setConsentPatient(e.target.checked)} />
            <div>
              <b>Le patient accepte l&apos;enregistrement</b>
              <span>
                Il a été informé, dans la langue de son choix, que l&apos;échange est analysé par un outil d&apos;aide à la
                documentation et que le médecin relit tout.
              </span>
            </div>
          </label>
          <label className={`consent ${consentPractitioner ? "on" : ""}`}>
            <input id="cm" type="checkbox" checked={consentPractitioner} onChange={(e) => setConsentPractitioner(e.target.checked)} />
            <div>
              <b>J&apos;accepte, en tant que praticien</b>
              <span>
                Les propositions de l&apos;IA ne remplacent pas mon jugement clinique. Je valide le compte rendu avant tout
                archivage.
              </span>
            </div>
          </label>
          {error && (
            <div className="error-box">
              <TriangleAlert size={15} />
              {error}
            </div>
          )}
          <button className="btn btn-primary btn-lg btn-block" disabled={!both || busy || (kind === "existing" && !code.trim())} onClick={start}>
            {busy ? <LoaderCircle size={18} className="spin" /> : <Mic size={18} />}
            Commencer la capture
          </button>
          {!both && (
            <p className="tiny faint" style={{ textAlign: "center" }}>
              Cochez les deux consentements pour continuer.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 2 : capture                                                   */
/* ------------------------------------------------------------------ */

function useTimer(running: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const noop = () => () => {};
const useDictationSupport = () => useSyncExternalStore(noop, dictationSupported, () => false);

interface Segment {
  who: Speaker;
  text: string;
}

const LABEL: Record<string, string> = { medecin: "Médecin", patient: "Patient" };
const nextWho = (w: Speaker): Speaker => (w === "medecin" ? "patient" : "medecin");

/** « auto » : l'agent devine qui parle ; sinon le locuteur choisi est imposé. */
type SpeakerMode = "auto" | "medecin" | "patient";

function Capture({ consult, onDone }: { consult: Consultation; onDone: (j: Job) => void }) {
  const lang = consult.language_requested;
  const [providers, setProviders] = useState<Providers | null>(null);
  const canDictate = useDictationSupport() && lang !== "wo";
  const serverAsr = providers
    ? lang === "fr"
      ? providers.asr_fr_ready
      : lang === "wo"
        ? providers.asr_wo_ready
        : providers.asr_fr_ready || providers.asr_wo_ready
    : false;
  const micAvailable = serverAsr || canDictate;

  const [mode, setMode] = useState<"mic" | "manual">("mic");
  const [live, setLive] = useState(false);
  const [level, setLevel] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState("");
  const [speaker, setSpeaker] = useState<SpeakerMode>("auto");
  const [phase, setPhase] = useState<"capture" | "review">("capture");
  const [draft, setDraft] = useState("");
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const timer = useTimer(live);

  const speakerRef = useRef<SpeakerMode>("auto");
  const stopDictation = useRef<(() => void) | null>(null);
  const rec = useRef<{ stream: MediaStream; ctx: AudioContext; mr: MediaRecorder | null; chunks: Blob[]; stopRaf: () => void } | null>(null);
  const pane = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dt.providers().then(setProviders).catch(() => {});
    return () => {
      stopDictation.current?.();
      const r = rec.current;
      if (r) {
        r.stopRaf();
        r.stream.getTracks().forEach((t) => t.stop());
        r.ctx.close();
      }
    };
  }, []);
  useEffect(() => {
    speakerRef.current = speaker;
  }, [speaker]);
  useEffect(() => {
    if (pane.current) pane.current.scrollTop = pane.current.scrollHeight;
  }, [segments, interim]);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let raf = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 5));
        raf = requestAnimationFrame(tick);
      };
      tick();

      // Enregistrement complet pour le serveur ASR (Whisper / Kiriku-Wolof-ASR).
      let mr: MediaRecorder | null = null;
      const chunks: Blob[] = [];
      if (serverAsr) {
        mr = new MediaRecorder(stream);
        mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        mr.start(1000);
      }
      rec.current = { stream, ctx, mr, chunks, stopRaf: () => cancelAnimationFrame(raf) };

      // Transcription en direct dans le navigateur (français).
      if (canDictate) {
        stopDictation.current = startDictation("fr-FR", {
          onFinal: (text) => {
            setSegments((s) => [
              ...s,
              { who: speakerRef.current === "auto" ? inferSpeaker(text, s.at(-1)?.who) : speakerRef.current, text },
            ]);
            setInterim("");
          },
          onInterim: setInterim,
          onError: (m) => setError(m),
        });
      }
      setLive(true);
    } catch (e) {
      setError(
        (e as DOMException)?.name === "NotAllowedError"
          ? "L'accès au micro a été refusé. Autorisez-le dans le navigateur, ou utilisez la saisie."
          : "Micro indisponible sur cet appareil. Utilisez la saisie.",
      );
    }
  }

  async function stop() {
    stopDictation.current?.();
    stopDictation.current = null;
    const r = rec.current;
    rec.current = null;
    let blob: Blob | null = null;
    if (r) {
      r.stopRaf();
      if (r.mr) {
        const mr = r.mr;
        blob = await new Promise<Blob>((resolve) => {
          mr.onstop = () => resolve(new Blob(r.chunks, { type: mr.mimeType || "audio/webm" }));
          mr.stop();
        });
      }
      r.stream.getTracks().forEach((t) => t.stop());
      r.ctx.close();
    }
    setLive(false);
    setLevel(0);

    if (serverAsr && blob && blob.size > 0) {
      onDone({ kind: "audio", blob });
      return;
    }
    const lastWho = segments.at(-1)?.who;
    const all = [
      ...segments,
      ...(interim ? [{ who: speakerRef.current === "auto" ? inferSpeaker(interim, lastWho) : speakerRef.current, text: interim }] : []),
    ];
    setInterim("");
    if (!all.length) {
      setError("Aucune parole n'a été reconnue. Vérifiez le micro et recommencez, ou utilisez la saisie.");
      return;
    }
    setDraft(all.map((s) => (s.who ? `${LABEL[s.who] ?? "Patient"}: ${s.text}` : s.text)).join("\n"));
    setPhase("review");
  }

  const restart = () => {
    setSegments([]);
    setDraft("");
    setPhase("capture");
    setError("");
  };

  const onRecButton = () => (live ? stop() : start());
  const canAnalyze = mode === "manual" ? manual.trim().length >= 10 : phase === "review" && draft.trim().length >= 10;
  const analyze = () =>
    onDone(mode === "manual" ? { kind: "transcript", text: manual, source: "texte" } : { kind: "transcript", text: draft, source: "dictee" });

  return (
    <div className="capture">
      <div className="stage">
        <Waves level={level} density={0.9} tilt={0.5} gain={1.15} />
        <div className="stage-top">
          <span className="pill">
            <Languages size={13} />
            {LANG[lang]}
          </span>
          <span className="pill mono" style={{ fontFamily: "var(--mono)" }}>
            {consult.patient.code}
          </span>
          {live ? (
            <span className="pill live">
              <i />
              En écoute
            </span>
          ) : (
            <span className="pill">{phase === "review" ? "Capture terminée" : "Prêt"}</span>
          )}
        </div>
        <div className="stage-bottom">
          <div className="timer" aria-live="off">
            {timer}
          </div>
          <button
            className={`rec-btn ${live ? "live" : ""}`}
            onClick={onRecButton}
            disabled={mode === "manual" || !micAvailable || phase === "review"}
            aria-label={live ? "Arrêter la consultation" : "Démarrer la capture"}
          >
            {live ? <Square size={26} fill="currentColor" /> : <Mic size={30} />}
          </button>
          <span className="small" style={{ color: "rgba(255,255,255,.75)", textAlign: "center" }}>
            {mode === "manual"
              ? "Saisie manuelle : le micro n'est pas utilisé"
              : !micAvailable
                ? "Micro indisponible pour cette langue"
                : live
                  ? "Touchez pour arrêter la consultation"
                  : phase === "review"
                    ? "Vérifiez la transcription, puis lancez l'analyse"
                    : "Touchez pour démarrer l'enregistrement"}
          </span>
        </div>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column" }}>
        <div className="card-head">
          <div className="seg" role="tablist" aria-label="Source">
            <button className={mode === "mic" ? "on" : ""} onClick={() => !live && setMode("mic")} disabled={live}>
              <Mic size={13} style={{ verticalAlign: -2 }} /> Micro
            </button>
            <button className={mode === "manual" ? "on" : ""} onClick={() => !live && setMode("manual")} disabled={live}>
              <Keyboard size={13} style={{ verticalAlign: -2 }} /> Saisie
            </button>
          </div>
          {mode === "mic" && canDictate && !serverAsr && phase === "capture" && (
            <div className="row" style={{ gap: 8 }}>
              <span className="tiny faint">Qui parle ?</span>
              <div className="seg" role="group" aria-label="Locuteur">
                {(["auto", "medecin", "patient"] as SpeakerMode[]).map((w) => (
                  <button key={w} className={speaker === w ? "on" : ""} onClick={() => setSpeaker(w)} title={w === "auto" ? "Détection automatique de qui parle" : undefined}>
                    {w === "auto" ? "Auto" : LABEL[w]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {mode === "mic" && (
          <>
            <div className="card-pad stack" style={{ paddingBottom: 0 }}>
              {!providers ? null : !micAvailable ? (
                <div className="info-box">
                  <Info size={15} />
                  <span>
                    {lang === "wo" ? (
                      <>
                        La transcription du wolof nécessite le serveur <b>Kiriku-Wolof-ASR</b> (voir le README) : la dictée du
                        navigateur ne reconnaît pas le wolof. En attendant, utilisez la <b>saisie</b>.
                      </>
                    ) : (
                      <>
                        La dictée en direct n&apos;est pas disponible dans ce navigateur (utilisez Chrome ou Edge) et le serveur
                        Whisper n&apos;est pas configuré. Utilisez la <b>saisie</b>.
                      </>
                    )}
                  </span>
                </div>
              ) : serverAsr ? (
                <div className="info-box">
                  <Info size={15} />
                  <span>
                    L&apos;enregistrement est transcrit à la fin de la capture par{" "}
                    <b>{lang === "wo" ? providers.asr_wo : lang === "fr" ? providers.asr_fr : `${providers.asr_fr} / ${providers.asr_wo}`}</b>
                    , puis supprimé.
                    {canDictate && " Le texte affiché pendant l'écoute n'est qu'un aperçu."}
                  </span>
                </div>
              ) : (
                <div className="info-box">
                  <Info size={15} />
                  <span>
                    Transcription en direct par la <b>dictée du navigateur</b> (français). L&apos;audio est traité par le service
                    de reconnaissance du navigateur ; pour de vraies données de patients, configurez le serveur Whisper local.
                    Qui parle est détecté automatiquement : touchez « Médecin » ou « Patient » devant une phrase pour corriger.
                  </span>
                </div>
              )}
            </div>

            {phase === "capture" ? (
              <div className="live-transcript" ref={pane} aria-live="polite">
                {segments.length === 0 && !interim && (
                  <div className="empty" style={{ padding: 30 }}>
                    <FileText size={22} />
                    <span>La transcription apparaît ici, tour de parole par tour de parole.</span>
                  </div>
                )}
                {segments.map((s, i) => (
                  <div key={i} className="turn enter">
                    <button
                      className={`who ${s.who}`}
                      title="Changer de locuteur"
                      onClick={() => setSegments((all) => all.map((x, k) => (k === i ? { ...x, who: nextWho(x.who) } : x)))}
                    >
                      {s.who ? LABEL[s.who] : "—"}
                    </button>
                    <span>{s.text}</span>
                  </div>
                ))}
                {interim && (
                  <div className="turn">
                    <span className={`who ${speaker === "auto" ? "" : speaker}`}>{speaker === "auto" ? "…" : LABEL[speaker]}</span>
                    <span>
                      {interim}
                      <span className="caret" />
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="card-pad stack" style={{ flex: 1 }}>
                <label className="label" htmlFor="draft">
                  Transcription à vérifier
                </label>
                <textarea id="draft" className="textarea" style={{ minHeight: 260, flex: 1 }} value={draft} onChange={(e) => setDraft(e.target.value)} />
                <p className="tiny faint">Corrigez les mots mal reconnus et les locuteurs (« Médecin: », « Patient: ») avant l&apos;analyse.</p>
              </div>
            )}
          </>
        )}

        {mode === "manual" && (
          <div className="card-pad stack" style={{ flex: 1 }}>
            <label className="label" htmlFor="manual">
              Transcription de la consultation
            </label>
            <textarea
              id="manual"
              className="textarea"
              style={{ minHeight: 260, flex: 1 }}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder={"Médecin: …\nPatient: …"}
            />
            <p className="tiny faint">Une ligne par tour de parole, préfixée par « Médecin: » ou « Patient: ».</p>
          </div>
        )}

        <div className="card-head" style={{ borderTop: "1px solid var(--border)", borderBottom: 0, marginTop: "auto" }}>
          {error ? (
            <div className="error-box" style={{ flex: 1 }}>
              <TriangleAlert size={15} />
              {error}
            </div>
          ) : (
            <span className="small muted">
              {mode === "mic" && phase === "review" ? "Consultation terminée. Lancez l'analyse." : "Arrêtez la capture, puis lancez l'analyse."}
            </span>
          )}
          <div className="row">
            {mode === "mic" && phase === "review" && (
              <button className="btn btn-ghost" onClick={restart}>
                <RotateCcw size={15} />
                Recommencer
              </button>
            )}
            {(mode === "manual" || phase === "review") && (
              <button className="btn btn-primary" disabled={!canAnalyze} onClick={analyze}>
                Analyser la consultation
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 3 : analyse par l'agent                                       */
/* ------------------------------------------------------------------ */

function Processing({ consult, job, onRetry }: { consult: Consultation; job: Job; onRetry: () => void }) {
  const router = useRouter();
  const refresh = useRefreshCounts();
  const [result, setResult] = useState<Consultation | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (job.kind === "transcript" ? dt.submitTranscript(consult.id, job.text, job.source) : dt.uploadAudio(consult.id, job.blob))
      .then(setResult)
      .catch((e) => setError((e as Error).message));
  }, [consult.id, job]);

  useEffect(() => {
    if (error || tick >= 6 || (!result && tick >= (job.kind === "audio" ? 1 : 2))) return;
    const t = setTimeout(() => setTick((x) => x + 1), result ? 520 : 700);
    return () => clearTimeout(t);
  }, [tick, result, error, job.kind]);

  const done = !!result && tick >= 6;
  useEffect(() => {
    if (!done) return;
    refresh();
    const t = setTimeout(() => router.replace(`/consultations/${consult.id}`), 1400);
    return () => clearTimeout(t);
  }, [done, refresh, router, consult.id]);

  return (
    <div className="card processing">
      <div className="card-head">
        <h2>
          {done ? <CircleCheck size={16} /> : <LoaderCircle size={16} className="spin" />}
          {done ? "Compte rendu prêt à relire" : "Analyse en cours"}
        </h2>
        <span className="mono faint">{consult.patient.code}</span>
      </div>
      <div className="card-pad stack-lg">
        <AgentSteps steps={result?.steps || []} live={done ? -1 : tick} />
        {error && (
          <div className="error-box">
            <TriangleAlert size={15} />
            <div>
              <b>L&apos;analyse n&apos;a pas abouti.</b> {error}
            </div>
          </div>
        )}
        {error && (
          <button className="btn btn-ghost" onClick={onRetry}>
            <RotateCcw size={15} />
            Revenir à la capture
          </button>
        )}
        {done && (
          <button className="btn btn-primary btn-lg" onClick={() => router.push(`/consultations/${consult.id}`)}>
            Relire et valider
            <ArrowRight size={18} />
          </button>
        )}
        <p className="disclaimer">
          <Info size={14} />
          L&apos;agent enchaîne des outils spécialisés et trace chaque décision. Il s&apos;arrête à la validation : la suite vous
          appartient.
        </p>
      </div>
    </div>
  );
}
