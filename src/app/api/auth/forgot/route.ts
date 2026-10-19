import { createResetLink, sendResetEmail } from "@/lib/accounts";
import { error, json } from "@/lib/api";
import { db, describeDbError } from "@/lib/store";

/**
 * Demande de réinitialisation. La réponse est la même que le compte existe ou non,
 * pour ne pas révéler quelles adresses sont inscrites.
 */
export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error(400, "Adresse e-mail invalide.");
  const mailEnabled = !!process.env.RESEND_API_KEY;
  try {
    const user = await db.findUserByEmail(email);
    if (user && mailEnabled) {
      const link = await createResetLink(user, new URL(req.url).origin);
      await sendResetEmail(user, link);
      await db.audit({ user_id: user.id, action: "reinitialisation_demandee", consultation_id: null, detail: "e-mail" });
    }
    return json({
      mail: mailEnabled,
      message: mailEnabled
        ? "Si un compte existe avec cette adresse, un e-mail contenant un lien de réinitialisation vient d'être envoyé (valable une heure)."
        : "L'envoi d'e-mails n'est pas encore configuré : demandez un lien de réinitialisation à l'administrateur de la plateforme.",
    });
  } catch (err) {
    console.error(err);
    return error(503, describeDbError(err));
  }
}
