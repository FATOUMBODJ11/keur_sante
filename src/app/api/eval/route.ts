import { fromError, json, requireUser } from "@/lib/api";
import { runEvaluation } from "@/lib/eval";
import { db } from "@/lib/store";

// 60 s : limite du plan gratuit de Vercel.
export const maxDuration = 60;

export async function GET() {
  const u = await requireUser();
  if (!u.ok) return u.response;
  return json(await db.listEvalRuns());
}

/** Lance l'agent sur tous les cas annotés et enregistre les métriques. */
export async function POST() {
  const u = await requireUser();
  if (!u.ok) return u.response;
  try {
    const run = await runEvaluation(u.value.id);
    await db.audit({ user_id: u.value.id, action: "evaluation_lancee", consultation_id: null, detail: `${run.summary.n_cas} cas` });
    return json(run);
  } catch (err) {
    return fromError(err);
  }
}
