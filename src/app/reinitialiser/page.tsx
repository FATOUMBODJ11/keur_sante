"use client";

import { ArrowLeft, CircleCheck, KeyRound, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { Loading } from "@/components/ui";
import { dt } from "@/lib/client/api";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await dt.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-card" onSubmit={submit}>
      <div className="stack" style={{ gap: 6 }}>
        <h2>Nouveau mot de passe</h2>
        <p className="muted">8 caractères au moins.</p>
      </div>
      {!token && <div className="error-box">Lien incomplet : ouvrez le lien reçu en entier.</div>}
      {done ? (
        <div className="info-box">
          <CircleCheck size={15} />
          <span>Mot de passe modifié. Vous pouvez vous connecter.</span>
        </div>
      ) : (
        <>
          <div className="field">
            <label className="label" htmlFor="pwd">
              Nouveau mot de passe
            </label>
            <input id="pwd" className="input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="pwd2">
              Confirmer le mot de passe
            </label>
            <input id="pwd2" className="input" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || !token}>
            {busy ? <LoaderCircle size={18} className="spin" /> : <KeyRound size={18} />}
            Enregistrer le mot de passe
          </button>
        </>
      )}
      <Link href="/bienvenue" className="row small strong" style={{ gap: 6, justifyContent: "center" }}>
        <ArrowLeft size={14} />
        Aller à la connexion
      </Link>
    </form>
  );
}

export default function ResetPassword() {
  return (
    <AuthFrame title={<>Choisissez un nouveau mot de passe.</>} lede="Ce lien vous a été envoyé par e-mail ou transmis par l'administrateur de la plateforme.">
      <Suspense fallback={<Loading />}>
        <ResetForm />
      </Suspense>
    </AuthFrame>
  );
}
