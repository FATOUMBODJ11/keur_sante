"use client";

import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CircleHelp,
  Clock,
  FileText,
  Languages,
  ListChecks,
  LoaderCircle,
  Lock,
  Mic,
  Plus,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth, useAuthRedirect } from "@/components/providers";
import { STRUCTURE_LABELS } from "@/lib/client/format";
import type { StructureType } from "@/lib/types";
import { BrandMark, ThemeSeg } from "@/components/ui";
import { Waves } from "@/components/Waves";
import "../accueil.css";

/** Photo libre de droits (licence Unsplash) : Ato Aikins, https://unsplash.com/photos/TPT4pevJEmQ */
const HERO_PHOTO = "https://images.unsplash.com/photo-1678695972687-033fa0bdbac9?w=900&q=80&auto=format&fit=crop";
const PHOTO_CREDIT = "https://unsplash.com/fr/photos/une-femme-vetue-dun-manteau-blanc-et-dun-stethoscope-TPT4pevJEmQ";

/** Anneau en pointillés : `value` entre 0 et 1. */
function DotRing({ value, dots = 36 }: { value: number; dots?: number }) {
  const on = Math.round(value * dots);
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      {Array.from({ length: dots }, (_, i) => {
        const a = (i / dots) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={+(60 + Math.cos(a) * 50).toFixed(2)}
            cy={+(60 + Math.sin(a) * 50).toFixed(2)}
            r={i < on ? 2.6 : 2}
            fill={i < on ? "#CBE896" : "#ffffff40"}
          />
        );
      })}
    </svg>
  );
}

function AuthForm() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  // Compte de démonstration local (voir src/lib/store.ts).
  const [email, setEmail] = useState("demo@keursante.sn");
  const [password, setPassword] = useState("keursante");
  const [fullName, setFullName] = useState("");
  const [facility, setFacility] = useState("");
  const [structureType, setStructureType] = useState<StructureType | "">("");
  const [specialty, setSpecialty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      else
        await register({
          full_name: fullName,
          facility,
          email,
          password,
          specialty: specialty || undefined,
          ...(structureType ? { structure_type: structureType } : {}),
        });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
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
          <div className="grid g-2" style={{ gap: 12 }}>
            <div className="field">
              <label className="label" htmlFor="stype">
                Type de structure
              </label>
              <select id="stype" className="select" value={structureType} onChange={(e) => setStructureType(e.target.value as StructureType)}>
                <option value="">Non précisé</option>
                {Object.entries(STRUCTURE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="spec">
                Spécialité
              </label>
              <input id="spec" className="input" placeholder="ex. Médecine générale" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
            </div>
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
      {mode === "register" ? (
        <p className="tiny faint">8 caractères au moins.</p>
      ) : (
        <Link href="/mot-de-passe-oublie" className="small strong" style={{ alignSelf: "flex-end" }}>
          Mot de passe oublié ?
        </Link>
      )}
      {error && <div className="error-box">{error}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
        {busy ? <LoaderCircle size={18} className="spin" /> : mode === "login" ? <ArrowRight size={18} /> : <UserPlus size={18} />}
        {mode === "login" ? "Ouvrir la démonstration" : "Créer mon compte"}
      </button>
      <p className="tiny faint" style={{ textAlign: "center" }}>
        {mode === "login" ? (
          <>
            demo@keursante.sn · keursante ·{" "}
            <button type="button" className="btn btn-quiet btn-sm" style={{ display: "inline", padding: 0, height: "auto" }} onClick={() => switchMode("register")}>
              Créer un compte praticien
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-quiet btn-sm" style={{ display: "inline", padding: 0, height: "auto" }} onClick={() => switchMode("login")}>
            J&apos;ai déjà un compte
          </button>
        )}
      </p>
    </form>
  );
}

export default function Landing() {
  useAuthRedirect(false);
  // Le texte de l'accueil suit l'activation du wolof (clé ElevenLabs ou KS_WOLOF).
  const [wolof, setWolof] = useState(false);
  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then((f: { wolof_enabled?: boolean }) => setWolof(!!f.wolof_enabled))
      .catch(() => {});
  }, []);

  const steps: { icon: typeof Mic; title: string; text: string; x: number; y: number; final?: boolean }[] = [
    { icon: Mic, title: "Écoute", text: "avec le consentement du patient", x: 10.1, y: 78.9 },
    { icon: Users, title: "Voix séparées", text: "médecin, patient, accompagnant", x: 26.4, y: 49.6 },
    wolof
      ? { icon: Languages, title: "Traduction", text: "wolof → français", x: 40.9, y: 36.3 }
      : { icon: AudioLines, title: "Transcription", text: "mot à mot, relue par vous", x: 40.9, y: 36.3 },
    { icon: ListChecks, title: "Extraction", text: "symptômes, constantes, antécédents", x: 59.1, y: 36.3 },
    { icon: FileText, title: "Compte rendu", text: "SOAP structuré", x: 73.6, y: 49.6 },
    { icon: UserCheck, title: "Validation", text: "le médecin relit et décide", x: 89.9, y: 78.9, final: true },
  ];

  const faq: [string, string][] = [
    [
      "Keur Santé remplace-t-il le médecin ?",
      "Non. L'outil prépare un brouillon : transcription, compte rendu SOAP et pistes diagnostiques. Chaque suggestion doit être acceptée ou rejetée par le praticien, et rien n'est archivé sans sa validation.",
    ],
    [
      "Que devient l'enregistrement audio ?",
      "L'audio sert uniquement à la transcription et n'est jamais conservé. Seul le texte relu par le médecin est enregistré, avec un code patient pseudonymisé à la place du nom.",
    ],
    [
      wolof ? "Le wolof est-il bien reconnu ?" : "Quelles langues sont prises en charge ?",
      wolof
        ? "Le wolof est transcrit par un modèle de reconnaissance vocale spécialisé, puis traduit en français. La précision reste moyenne sur les termes médicaux : la relecture par le praticien est indispensable et prévue à chaque consultation."
        : "Le français est pris en charge aujourd'hui. Le wolof est prévu : il s'active dès que le service de reconnaissance vocale correspondant est configuré.",
    ],
    [
      "Comment la fiabilité est-elle mesurée ?",
      "Une validation clinique compare les résultats de l'agent à des cas annotés par des médecins : rappel des symptômes, exactitude des diagnostics proposés, accord entre annotateurs. Un questionnaire d'utilisabilité (SUS) complète l'évaluation.",
    ],
    [
      "Faut-il une connexion internet ?",
      "Oui : la transcription et l'analyse se font en ligne. Sans modèle d'IA configuré, l'application bascule sur une extraction par règles, plus limitée.",
    ],
  ];

  return (
    <div className="site">
      <div className="site-frame">
        <div className="site-top">
          <Waves zoom={1.2} gain={1.5} size={11} offsetY={0.42} />
          <header className="site-nav">
            <Link href="/bienvenue" className="site-brand" aria-label="Keur Santé — accueil">
              <BrandMark size={36} />
              <span className="brand-name">
                Keur <span>Santé</span>
              </span>
            </Link>
            <nav className="site-menu" aria-label="Sections">
              <a href="#top" className="on">
                Accueil
              </a>
              <a href="#fonctionnement">Fonctionnement</a>
              <a href="#confiance">Confiance</a>
              <a href="#faq">FAQ</a>
            </nav>
            <div className="site-actions">
              <ThemeSeg compact />
              <a href="#connexion" className="btn btn-pill">
                <span className="lbl">Se connecter</span>
                <span className="dot">
                  <ArrowRight size={15} />
                </span>
              </a>
            </div>
          </header>

          <section className="site-hero" id="top">
            <div className="site-hero-copy">
              <div className="eyebrow">Scribe médical ambiant · Sénégal</div>
              <h1>
                Parlez à votre patient. <em>Le compte rendu s&apos;écrit.</em>
              </h1>
              <p className="lede">
                Keur Santé écoute la consultation {wolof ? "en français ou en wolof" : "en français"}, en extrait les informations
                cliniques et prépare un compte rendu SOAP. Vous relisez, corrigez et validez.
              </p>
              <div className="row wrap">
                <a href="#connexion" className="btn btn-primary">
                  Essayer la démonstration
                </a>
                <a href="#fonctionnement" className="btn btn-glass">
                  Voir le fonctionnement
                </a>
              </div>
              {wolof ? (
                <div className="sample-line" aria-label="Exemple de traduction">
                  <i>« Dama am tàngoor ak sama bopp dafay metti lool, ñetti fan. »</i>→ fièvre · céphalées · depuis trois jours
                </div>
              ) : (
                <div className="sample-line" aria-label="Exemple d'extraction">
                  <i>« J&apos;ai de la fièvre et très mal à la tête depuis trois jours. »</i>→ fièvre · céphalées · depuis trois jours
                </div>
              )}
            </div>
            <div className="hero-visual">
              <div className="hero-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={HERO_PHOTO} alt="Une médecin souriante en blouse blanche, un stéthoscope autour du cou" />
              </div>
              <span className="chip-float" style={{ top: 70, left: "4%" }}>
                <span className="ic">
                  <Mic size={13} />
                </span>
                {wolof ? "Langue détectée" : "Transcription"}
                <em>{wolof ? "Wolof" : "En cours"}</em>
              </span>
              <span className="chip-float" style={{ top: 250, left: "10%" }}>
                <span className="ic">
                  <FileText size={13} />
                </span>
                Compte rendu
                <em>SOAP prêt</em>
              </span>
              <div className="score-card">
                <div className="t">Décision médicale</div>
                <div className="ring-wrap" style={{ marginTop: 6 }}>
                  <DotRing value={1} />
                  <div className="ring-label">
                    <b style={{ fontSize: 30 }}>100 %</b>
                    <span>des pistes validées
                      <br />
                      par le médecin
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="section" id="fonctionnement">
          <div className="tag">[ Fonctionnement ]</div>
          <h2>L&apos;IA écoute la consultation</h2>
          <p className="sub">
            Pendant que vous examinez le patient, l&apos;agent transforme la conversation en informations cliniques claires et
            structurées, prêtes à relire.
          </p>
          <div className="arc">
            <svg viewBox="0 0 860 250" preserveAspectRatio="none" aria-hidden="true">
              <path d="M 40 230 Q 430 -60 820 230" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeDasharray="5 6" />
              <path d="M 120 238 Q 430 20 740 238" fill="none" stroke="var(--sky-soft)" strokeWidth="40" strokeLinecap="round" opacity=".55" />
            </svg>
            <div className="arc-core">IA</div>
            {steps.map(({ icon: Icon, title, text, x, y, final }) => (
              <div key={title} className={`arc-node${final ? " final" : ""}`} style={{ left: `${x}%`, top: `${y}%` }}>
                <span className="ic">
                  <Icon size={19} />
                </span>
                <b>{title}</b>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section" style={{ paddingTop: 20 }}>
          <div className="tag">[ Compte rendu ]</div>
          <h2>Du son au compte rendu.</h2>
          <p className="sub">Trois étapes, et le médecin garde la main à chacune.</p>
          <div className="features">
            <div className="feature dark">
              <div className="serif-t">{wolof ? "Il écoute, en français et en wolof" : "Il écoute la consultation"}</div>
              <p>Les voix du médecin et du patient sont séparées automatiquement, puis la transcription vous est soumise.</p>
              <div className="glass">
                <div className="wave" aria-hidden="true">
                  {[30, 55, 40, 80, 62, 95, 70, 45, 85, 58, 35, 66, 90, 50, 28, 60, 75, 42, 30, 20].map((h, i) => (
                    <i key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="tiny" style={{ marginTop: 8, opacity: 0.85 }}>
                  {wolof ? "Wolof détecté · traduit en français" : "Transcription relue par le praticien"}
                </div>
              </div>
            </div>
            <div className="feature">
              <div className="serif-t">Un compte rendu SOAP</div>
              <p>Subjectif, Objectif, Analyse, Plan : chaque rubrique est rédigée à partir de la transcription, et modifiable.</p>
              <div className="glass soap-mini">
                <div className="tiny faint">Exemple</div>
                <div>
                  <b>S</b>Fièvre et céphalées depuis trois jours
                </div>
                <div>
                  <b>O</b>Température 38,4 °C
                </div>
                <div>
                  <b>A</b>Piste : paludisme, à confirmer
                </div>
                <div>
                  <b>P</b>Test de diagnostic rapide
                </div>
              </div>
            </div>
            <div className="feature">
              <div className="serif-t">Le médecin décide</div>
              <p>Chaque piste diagnostique est acceptée ou rejetée une à une, avec les arguments pour et contre.</p>
              <div className="glass decide">
                <div className="tiny faint">Exemple</div>
                <div>
                  Paludisme simple<em className="ok">Acceptée</em>
                </div>
                <div>
                  Syndrome grippal<em className="no">Rejetée</em>
                </div>
                <div>
                  Test de diagnostic rapide<em className="ok">Accepté</em>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="figures" id="confiance">
          <div className="figure">
            <div className="n">{wolof ? "2 langues" : "Français"}</div>
            <span className="ic">
              <Languages size={16} />
            </span>
            <b>{wolof ? "Français et wolof" : "Wolof en préparation"}</b>
            <span>{wolof ? "Détection automatique de la langue, traduction du wolof en français." : "Transcription et analyse en français."}</span>
          </div>
          <div className="figure">
            <div className="n">0 audio</div>
            <span className="ic">
              <Lock size={16} />
            </span>
            <b>Aucun enregistrement conservé</b>
            <span>Seul le texte relu est gardé, avec un code patient pseudonymisé et un journal d&apos;audit.</span>
          </div>
          <div className="figure">
            <div className="n">100 %</div>
            <span className="ic">
              <ShieldCheck size={16} />
            </span>
            <b>Validé par le praticien</b>
            <span>Aucune suggestion n&apos;entre dans le dossier sans la décision du médecin.</span>
          </div>
        </div>

        <section className="section" id="connexion">
          <div className="access">
            <div>
              <div className="tag">[ Démonstration ]</div>
              <h2>Essayez Keur Santé</h2>
              <p className="sub" style={{ margin: 0 }}>
                Le compte de démonstration est prêt. Vous pouvez aussi créer votre compte praticien : vos consultations restent
                visibles par vous seul.
              </p>
              <div className="trust">
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
                  <Clock size={18} />
                  <div>
                    <b>Du temps rendu au patient</b>
                    Le compte rendu se prépare pendant l&apos;examen, au lieu d&apos;être rédigé après.
                  </div>
                </div>
              </div>
            </div>
            <AuthForm />
          </div>
        </section>

        <section className="section" id="faq" style={{ paddingTop: 24 }}>
          <div className="tag">[ Questions ]</div>
          <h2>Questions fréquentes</h2>
          <div className="faq">
            {faq.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>
                  {q}
                  <Plus size={16} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
            <div className="ask-bar">
              <div className="row" style={{ gap: 12 }}>
                <CircleHelp size={22} />
                <div>
                  <b>Encore une question ?</b>
                  <span>Le plus simple est d&apos;essayer : la démonstration ne demande aucune donnée réelle.</span>
                </div>
              </div>
              <a href="#connexion" className="btn btn-sm">
                Essayer la démonstration
              </a>
            </div>
          </div>
        </section>

        <footer className="site-foot">
          <div>
            <div className="brand-name">
              Keur <span>Santé</span>
            </div>
            <p>Scribe médical ambiant pour les consultations au Sénégal : transcrire, structurer, et laisser le médecin décider.</p>
          </div>
          <div>
            <h4>Produit</h4>
            <ul>
              <li>
                <a href="#fonctionnement">Fonctionnement</a>
              </li>
              <li>
                <a href="#confiance">Confiance</a>
              </li>
              <li>
                <a href="#faq">FAQ</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Accès</h4>
            <ul>
              <li>
                <a href="#connexion">Connexion</a>
              </li>
              <li>
                <Link href="/mot-de-passe-oublie">Mot de passe oublié</Link>
              </li>
              <li>
                <Link href="/confidentialite">Confidentialité</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Projet</h4>
            <ul>
              <li>Mastère Stratégie Digitale</li>
              <li>ISM Digital Campus</li>
              <li>Prototype de recherche</li>
            </ul>
          </div>
          <div className="legal">
            <span>© Keur Santé · Prototype, ne remplace pas un avis médical.</span>
            <span>
              Photo :{" "}
              <a href={PHOTO_CREDIT} target="_blank" rel="noreferrer">
                Ato Aikins sur Unsplash
              </a>{" "}
              <ArrowUpRight size={11} style={{ verticalAlign: -1 }} />
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
