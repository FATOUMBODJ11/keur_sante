import { connection } from "next/server";
import { json } from "@/lib/api";
import { sessionSecretProblem } from "@/lib/auth";
import { checkDatabase } from "@/lib/store";

/**
 * Diagnostic de la configuration (public, sans aucun secret) :
 * ouvrez /api/health sur le site déployé pour savoir ce qui manque.
 */
export async function GET() {
  await connection();
  const secretProblem = sessionSecretProblem();
  const database = await checkDatabase();
  const ok = !secretProblem && database.ok;
  return json(
    {
      ok,
      session_secret: secretProblem ? { ok: false, message: secretProblem } : { ok: true, message: "Défini." },
      database,
    },
    ok ? 200 : 503,
  );
}
