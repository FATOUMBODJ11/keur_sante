"use client";

import { ArrowRight, Lock, LoaderCircle, ShieldCheck, Stethoscope, UserCheck, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth, useAuthRedirect } from "@/components/providers";
import { BrandMark, ThemeSeg } from "@/components/ui";
import { Waves } from "@/components/Waves";

export default function Landing() {
  useAuthRedirect(false);
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  // Compte de démonstration local (voir src/lib/store.ts).
  const [email, setEmail] = useState("demo@keursante.sn");
  const [password, setPassword] = useState("keursante");
  const [fullName, setFullName] = useState("");
  const [facility, setFacility] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Wolof en pause par défaut : le texte de l'accueil suit l'interrupteur KS_WOLOF.
  const [wolof, setWolof] = useState(false);
  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then((f: { wolof_enabled?: boolean }) => setWolof(!!f.wolof_enabled))
      .catch(() => {});
  }, []);

  const switchMode = (m: "login" | "register") => {
    setMode(m);
    setError("");
    if (m === "register") {
      setEmail("");
      setPassword("");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await login(email, password);
      else await register({ full_name: fullName, facility, email, password });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing">
      <section className="hero">
        <Waves zoom={1.2} gain={1.5} size={11} offsetY={0.42} />
        <div className="hero-brand">
          <BrandMark size={44} />
          <div className="brand-name">
            Keur <span>Santé</span>
          </div>
        </div>
        <div className="hero-copy">
          <div className="eyebrow" style={{ color: "#A7E9A7" }}>
            <Stethoscope size={14} />
            Scribe médical ambiant · Sénégal
          </div>
          <h1>
            Parlez à votre patient. <em>Le compte rendu s&apos;écrit.</em>
          </h1>
          <p className="lede">
            Keur Santé écoute la consultation {wolof ? "en français ou en wolof" : "en français"}, en extrait les
            informations cliniques et prépare un compte rendu SOAP. Vous relisez, corrigez et validez. Rien n&apos;est archivé
            sans votre accord.
          </p>
          {wolof ? (
            <div className="wolof-line" aria-label="Exemple de traduction">
              « Dama am tàngoor ak sama bopp dafay metti lool, ñetti fan. »<span>→ fièvre · céphalées · depuis trois jours</span>
            </div>
          ) : (
            <div className="wolof-line" aria-label="Exemple d'extraction">
              « J&apos;ai de la fièvre et très mal à la tête depuis trois jours. »<span>→ fièvre · céphalées · depuis trois jours</span>
            </div>
          )}
        </div>
        <div className="proof">
          {wolof ? (
            <div>
              <b>FR + WO</b>
              <span>Wolof transcrit avec Kiriku-Wolof-ASR puis traduit</span>
            </div>
          ) : (
            <div>
              <b>En direct</b>
              <span>La consultation se transcrit pendant que vous parlez</span>
            </div>
          )}
          <div>
            <b>SOAP</b>
            <span>Subjectif, Objectif, Analyse, Plan, prêts à relire</span>
          </div>
          <div>
            <b>100 %</b>
            <span>des suggestions soumises à la décision du médecin</span>
          </div>
        </div>
      </section>

      <section className="auth">
        <div className="theme-toggle">
          <ThemeSeg compact />
        </div>
        <form className="auth-card" onSubmit={submit}>
          <div className="seg" role="tablist" aria-label="Accès">
            <button type="button" className={mode === "login" ? "on" : ""} onClick={() => switchMode("login")} role="tab" aria-selected={mode === "login"}>
              Connexion
            </button>
            <button type="button" className={mode === "register" ? "on" : ""} onClick={() => switchMode("register")} role="tab" aria-selected={mode === "register"}>
              Créer un compte
            </button>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <h2>{mode === "login" ? "Connexion praticien" : "Nouveau compte praticien"}</h2>
            <p className="muted">
              {mode === "login"
                ? "Le compte de démonstration est déjà renseigné."
                : "Vos consultations restent visibles par vous seul. Aucune donnée de patient n'est demandée."}
            </p>
          </div>
          {mode === "register" && (
            <>
              <div className="field">
                <label className="label" htmlFor="name">
                  Nom complet
                </label>
                <input id="name" className="input" autoComplete="name" placeholder="Dr Prénom Nom" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="field">
                <label className="label" htmlFor="facility">
                  Structure de santé
                </label>
                <input
                  id="facility"
                  className="input"
                  autoComplete="organization"
                  placeholder="ex. Centre de santé, poste de santé, hôpital"
                  value={facility}
                  onChange={(e) => setFacility(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          <div className="field">
            <label className="label" htmlFor="email">
              Adresse e-mail
            </label>
            <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {mode === "register" && <p className="tiny faint">8 caractères au moins.</p>}
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? <LoaderCircle size={18} className="spin" /> : mode === "login" ? <ArrowRight size={18} /> : <UserPlus size={18} />}
            {mode === "login" ? "Ouvrir la démonstration" : "Créer mon compte"}
          </button>
          <p className="tiny faint" style={{ textAlign: "center" }}>
            {mode === "login" ? (
              <>
                demo@keursante.sn · keursante ·{" "}
                <button type="button" className="btn btn-quiet btn-sm" style={{ display: "inline", padding: 0 }} onClick={() => switchMode("register")}>
                  Créer un compte praticien
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-quiet btn-sm" style={{ display: "inline", padding: 0 }} onClick={() => switchMode("login")}>
                J&apos;ai déjà un compte
              </button>
            )}
          </p>
        </form>
        <div className="trust">
          <div className="or">Conçu pour la pratique clinique</div>
          <div className="trust-item">
            <UserCheck size={18} />
            <div>
              <b>Consentement d&apos;abord</b>
              Aucune capture sans l&apos;accord explicite du patient et du praticien.
            </div>
          </div>
          <div className="trust-item">
            <ShieldCheck size={18} />
            <div>
              <b>Le médecin décide</b>
              Pistes diagnostiques et plan de prise en charge sont des suggestions, acceptées ou rejetées une à une.
            </div>
          </div>
          <div className="trust-item">
            <Lock size={18} />
            <div>
              <b>Patients pseudonymisés</b>
              Un code patient suffit. Chaque action est tracée dans un journal d&apos;audit.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
