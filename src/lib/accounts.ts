import "server-only";
import { newResetToken } from "@/lib/auth";
import { db } from "@/lib/store";
import type { StructureType, User } from "@/lib/types";

export const STRUCTURE_TYPES: StructureType[] = ["hopital", "centre_sante", "clinique", "cabinet", "poste_sante", "autre"];

export const PASSWORD_MIN = 8;

/** Champs de profil modifiables par le praticien. */
export function parseProfile(body: Record<string, unknown>): { error: string } | Partial<User> {
  const out: Partial<User> = {};
  if (body.full_name !== undefined) {
    const v = String(body.full_name).trim();
    if (v.length < 3 || v.length > 120) return { error: "Indiquez votre nom (3 caractères au moins)." };
    out.full_name = v;
  }
  if (body.facility !== undefined) {
    const v = String(body.facility).trim();
    if (v.length < 2 || v.length > 160) return { error: "Indiquez votre structure de santé." };
    out.facility = v;
  }
  if (body.structure_type !== undefined) {
    const v = String(body.structure_type) as StructureType;
    if (!STRUCTURE_TYPES.includes(v)) return { error: "Type de structure inconnu." };
    out.structure_type = v;
  }
  if (body.specialty !== undefined) out.specialty = String(body.specialty).trim().slice(0, 80) || undefined;
  return out;
}

/** Crée un lien de réinitialisation du mot de passe (valable 1 h). */
export async function createResetLink(user: User, origin: string): Promise<string> {
  const { token, token_hash, expires_at } = newResetToken();
  await db.putReset({ token_hash, user_id: user.id, expires_at, used: false });
  return `${origin}/reinitialiser?token=${token}`;
}

/** Envoie le lien par e-mail via Resend si RESEND_API_KEY est défini ; sinon renvoie false. */
export async function sendResetEmail(user: User, link: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.KS_MAIL_FROM || "Keur Santé <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: "Keur Santé — réinitialisation de votre mot de passe",
      html: `<p>Bonjour ${user.full_name},</p>
<p>Pour choisir un nouveau mot de passe, cliquez sur le lien ci-dessous (valable une heure) :</p>
<p><a href="${link}">${link}</a></p>
<p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
    }),
  });
  if (!res.ok) console.error("Envoi de l'e-mail impossible", res.status, await res.text().catch(() => ""));
  return res.ok;
}
