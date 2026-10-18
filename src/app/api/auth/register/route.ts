import { error, json } from "@/lib/api";
import { sessionSecretProblem, setSession, toPublic } from "@/lib/auth";
import { db, describeDbError } from "@/lib/store";

/** Création d'un compte praticien. Chaque praticien ne voit que ses propres consultations. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    full_name?: string;
    facility?: string;
    email?: string;
    password?: string;
  };
  const full_name = body.full_name?.trim() ?? "";
  const facility = body.facility?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (full_name.length < 3 || full_name.length > 120) return error(400, "Indiquez votre nom (3 caractères au moins).");
  if (facility.length < 2 || facility.length > 160) return error(400, "Indiquez votre structure de santé.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error(400, "Adresse e-mail invalide.");
  if (password.length < 8) return error(400, "Le mot de passe doit contenir au moins 8 caractères.");

  // Vérifié avant de créer le compte : sinon le compte existerait sans session ouverte.
  const secretProblem = sessionSecretProblem();
  if (secretProblem) return error(503, `Configuration du serveur incomplète : ${secretProblem}`);

  try {
    if (await db.findUserByEmail(email)) return error(409, "Un compte existe déjà avec cette adresse e-mail.");
    const user = await db.createUser({ full_name, facility, email, password });
    await setSession(user.id);
    await db.audit({ user_id: user.id, action: "compte_cree", consultation_id: null, detail: "" });
    return json({ user: toPublic(user) }, 201);
  } catch (err) {
    console.error(err);
    return error(503, describeDbError(err));
  }
}
