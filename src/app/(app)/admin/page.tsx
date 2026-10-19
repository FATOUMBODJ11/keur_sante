"use client";

import { BadgeCheck, Copy, History, KeyRound, LockOpen, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth, useToast } from "@/components/providers";
import { Loading, Modal } from "@/components/ui";
import { dt, type AdminUserRow } from "@/lib/client/api";
import { STRUCTURE_LABELS, fmtDate } from "@/lib/client/format";
import type { AuditEntry } from "@/lib/types";

const ACTIONS: Record<string, string> = {
  connexion: "Connexion",
  deconnexion: "Déconnexion",
  compte_cree: "Compte créé",
  compte_verrouille: "Compte verrouillé",
  profil_modifie: "Profil modifié",
  mot_de_passe_modifie: "Mot de passe modifié",
  mot_de_passe_reinitialise: "Mot de passe réinitialisé",
  reinitialisation_demandee: "Réinitialisation demandée",
  lien_reinitialisation_cree: "Lien de réinitialisation créé",
  compte_modifie_admin: "Compte modifié (admin)",
  consultation_ouverte: "Consultation ouverte",
  analyse_lancee: "Analyse lancée",
  analyse_relancee: "Analyse relancée",
  analyse_echouee: "Analyse échouée",
  compte_rendu_genere: "Compte rendu généré",
  soap_modifie: "SOAP modifié",
  suggestion_retenue: "Piste retenue",
  suggestion_ecartee: "Piste écartée",
  suggestion_reinitialisee: "Décision annulée",
  compte_rendu_valide: "Compte rendu validé",
  compte_rendu_exporte: "Compte rendu exporté",
  compte_rendu_imprime: "Compte rendu imprimé",
  consultation_archivee: "Consultation archivée",
  dossier_patient_modifie: "Dossier patient modifié",
  cas_ajoute: "Cas ajouté",
  cas_modifie: "Cas modifié",
  cas_supprime: "Cas supprimé",
  evaluation_lancee: "Évaluation lancée",
  questionnaire_envoye: "Questionnaire envoyé",
};

export default function AdminPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [audit, setAudit] = useState<(AuditEntry & { user_name: string })[] | null>(null);
  const [error, setError] = useState("");
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") return;
    Promise.all([dt.adminUsers(), dt.adminAudit()])
      .then(([u, a]) => {
        setUsers(u);
        setAudit(a);
      })
      .catch((e) => setError(e.message));
  }, [user?.role]);

  if (user?.role !== "admin") {
    return (
      <div className="error-box">
        <TriangleAlert size={15} />
        Page réservée aux administrateurs de la plateforme (variable KS_ADMIN_EMAILS).
      </div>
    );
  }
  if (error) return <div className="error-box">{error}</div>;
  if (!users || !audit) return <Loading />;

  const update = async (row: AdminUserRow, patch: { validator?: boolean; unlock?: boolean }) => {
    try {
      const u = await dt.adminUpdateUser(row.id, patch);
      setUsers((list) => (list || []).map((x) => (x.id === row.id ? { ...x, ...u, locked: patch.unlock ? false : x.locked } : x)));
      toast("Compte mis à jour");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const resetLink = async (row: AdminUserRow) => {
    try {
      setLink({ email: row.email, url: await dt.adminResetLink(row.id) });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <ShieldCheck size={13} />
            Plateforme
          </div>
          <h1>Administration</h1>
          <p>Comptes praticiens, médecins validateurs et journal d&apos;audit.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2>
            <Users size={16} />
            Praticiens
          </h2>
          <span className="tiny faint">{users.length} comptes</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Praticien</th>
                <th>Structure</th>
                <th className="num">Consultations</th>
                <th>Validateur</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="strong">
                      {u.full_name} {u.role === "admin" && <span className="badge b-navy">Admin</span>} {u.locked && <span className="badge b-red">Verrouillé</span>}
                    </div>
                    <div className="tiny faint">
                      {u.email}
                      {u.specialty ? ` · ${u.specialty}` : ""}
                    </div>
                  </td>
                  <td className="small">
                    {u.facility}
                    {u.structure_type && <div className="tiny faint">{STRUCTURE_LABELS[u.structure_type]}</div>}
                  </td>
                  <td className="num">{u.consultations}</td>
                  <td>
                    <button className={`btn btn-sm ${u.validator ? "btn-ok on" : "btn-ghost"}`} onClick={() => update(u, { validator: !u.validator })}>
                      <BadgeCheck size={14} />
                      {u.validator ? "Oui" : "Non"}
                    </button>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {u.locked && (
                      <button className="btn btn-quiet btn-sm" onClick={() => update(u, { unlock: true })} title="Déverrouiller">
                        <LockOpen size={14} />
                      </button>
                    )}
                    <button className="btn btn-quiet btn-sm" onClick={() => resetLink(u)} title="Créer un lien de réinitialisation du mot de passe">
                      <KeyRound size={14} />
                      Lien mot de passe
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <History size={16} />
            Journal d&apos;audit
          </h2>
          <span className="tiny faint">300 dernières actions</span>
        </div>
        <div className="table-wrap" style={{ maxHeight: 480, overflow: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Praticien</th>
                <th>Action</th>
                <th>Détail</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a, i) => (
                <tr key={i}>
                  <td className="small muted" style={{ whiteSpace: "nowrap" }}>
                    {fmtDate(a.at)}
                  </td>
                  <td className="small">{a.user_name}</td>
                  <td className="small strong">{ACTIONS[a.action] ?? a.action}</td>
                  <td className="tiny faint">
                    {a.consultation_id ? `${a.consultation_id} · ` : ""}
                    {a.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {link && (
        <Modal
          title="Lien de réinitialisation"
          onClose={() => setLink(null)}
          footer={
            <button
              className="btn btn-primary"
              onClick={() => {
                navigator.clipboard.writeText(link.url).then(() => toast("Lien copié"));
              }}
            >
              <Copy size={15} />
              Copier le lien
            </button>
          }
        >
          <p className="muted small" style={{ marginBottom: 10 }}>
            Transmettez ce lien à {link.email} par un canal sûr. Il est valable une heure et ne sert qu&apos;une fois.
          </p>
          <div className="doc" style={{ wordBreak: "break-all" }}>
            {link.url}
          </div>
        </Modal>
      )}
    </>
  );
}
