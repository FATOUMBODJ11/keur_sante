"use client";

import { KeyRound, LoaderCircle, Save, TriangleAlert, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth, useToast } from "@/components/providers";
import { dt } from "@/lib/client/api";
import { STRUCTURE_LABELS } from "@/lib/client/format";
import type { StructureType } from "@/lib/types";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [facility, setFacility] = useState(user?.facility ?? "");
  const [structureType, setStructureType] = useState<StructureType | "">(user?.structure_type ?? "");
  const [specialty, setSpecialty] = useState(user?.specialty ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState("");

  if (!user) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setUser(
        await dt.updateProfile({
          full_name: fullName,
          facility,
          specialty,
          ...(structureType ? { structure_type: structureType } : {}),
        }),
      );
      toast("Profil enregistré");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setPwdError("Les deux nouveaux mots de passe ne sont pas identiques.");
      return;
    }
    setPwdBusy(true);
    setPwdError("");
    try {
      await dt.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("Mot de passe modifié");
    } catch (err) {
      setPwdError((err as Error).message);
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Compte</div>
          <h1>Mon profil</h1>
          <p>Ces informations figurent sur vos comptes rendus imprimés.</p>
        </div>
      </div>
      <div className="grid g-2" style={{ alignItems: "start" }}>
        <form className="card" onSubmit={save}>
          <div className="card-head">
            <h2>
              <UserRound size={16} />
              Informations du praticien
            </h2>
            {user.validator && <span className="badge b-teal">Médecin validateur</span>}
          </div>
          <div className="card-pad stack-lg">
            <div className="field">
              <label className="label" htmlFor="name">
                Nom complet
              </label>
              <input id="name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="spec">
                Spécialité
              </label>
              <input id="spec" className="input" placeholder="ex. Médecine générale, Pédiatrie…" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="facility">
                Structure de santé
              </label>
              <input id="facility" className="input" value={facility} onChange={(e) => setFacility(e.target.value)} required />
            </div>
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
              <span className="label">Adresse e-mail</span>
              <span className="muted">{user.email}</span>
            </div>
            {error && (
              <div className="error-box">
                <TriangleAlert size={15} />
                {error}
              </div>
            )}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
              Enregistrer
            </button>
          </div>
        </form>

        <form className="card" onSubmit={changePassword}>
          <div className="card-head">
            <h2>
              <KeyRound size={16} />
              Changer de mot de passe
            </h2>
          </div>
          <div className="card-pad stack-lg">
            <div className="field">
              <label className="label" htmlFor="cur">
                Mot de passe actuel
              </label>
              <input id="cur" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="new">
                Nouveau mot de passe
              </label>
              <input id="new" className="input" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="new2">
                Confirmer
              </label>
              <input id="new2" className="input" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            {pwdError && (
              <div className="error-box">
                <TriangleAlert size={15} />
                {pwdError}
              </div>
            )}
            <button className="btn btn-ghost" disabled={pwdBusy}>
              {pwdBusy ? <LoaderCircle size={16} className="spin" /> : <KeyRound size={16} />}
              Modifier le mot de passe
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
