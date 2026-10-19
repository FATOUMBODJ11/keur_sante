"use client";

import { ArrowLeft, LoaderCircle, Mail } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { dt } from "@/lib/client/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setDone((await dt.forgot(email)).message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title={<>Mot de passe oublié ?</>} lede="Indiquez l'adresse e-mail de votre compte praticien : vous recevrez un lien pour choisir un nouveau mot de passe.">
      <form className="auth-card" onSubmit={submit}>
        <div className="stack" style={{ gap: 6 }}>
          <h2>Réinitialiser le mot de passe</h2>
          <p className="muted">Le lien est valable une heure et ne sert qu&apos;une fois.</p>
        </div>
        {done ? (
          <div className="info-box">
            <Mail size={15} />
            <span>{done}</span>
          </div>
        ) : (
          <>
            <div className="field">
              <label className="label" htmlFor="email">
                Adresse e-mail
              </label>
              <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {error && <div className="error-box">{error}</div>}
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? <LoaderCircle size={18} className="spin" /> : <Mail size={18} />}
              Envoyer le lien
            </button>
          </>
        )}
        <Link href="/bienvenue" className="row small strong" style={{ gap: 6, justifyContent: "center" }}>
          <ArrowLeft size={14} />
          Retour à la connexion
        </Link>
      </form>
    </AuthFrame>
  );
}
