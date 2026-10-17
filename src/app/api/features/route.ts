import { connection } from "next/server";
import { json } from "@/lib/api";
import { wolofEnabled } from "@/lib/features";

/** Interrupteurs publics (lus par la page d'accueil, avant connexion). */
export async function GET() {
  // Lu à chaque requête : changer KS_WOLOF ne demande pas de reconstruire l'application.
  await connection();
  return json({ wolof_enabled: wolofEnabled() });
}
