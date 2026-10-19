import { randomUUID } from "node:crypto";
import { error, json, requireUser } from "@/lib/api";
import { db } from "@/lib/store";
import { susScore } from "@/lib/survey";

/** Résultats du questionnaire d'usage (tous les praticiens). */
export async function GET() {
  const u = await requireUser();
  if (!u.ok) return u.response;
  const surveys = await db.listSurveys();
  const n = surveys.length;
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  return json({
    n,
    sus_moyen: avg(surveys.map((s) => s.score)),
    temps_gagne_moyen: avg(surveys.map((s) => s.time_saved_minutes).filter((x): x is number => x !== null)),
    surveys,
  });
}

/** Réponse au questionnaire SUS (10 affirmations notées de 1 à 5). */
export async function POST(req: Request) {
  const u = await requireUser();
  if (!u.ok) return u.response;
  const body = (await req.json().catch(() => ({}))) as { answers?: unknown; time_saved_minutes?: unknown; comment?: unknown };
  const answers = Array.isArray(body.answers) ? body.answers.map(Number) : [];
  if (answers.length !== 10 || answers.some((a) => !Number.isInteger(a) || a < 1 || a > 5)) {
    return error(400, "Répondez aux 10 affirmations (de 1 à 5).");
  }
  const t = body.time_saved_minutes === null || body.time_saved_minutes === "" ? null : Number(body.time_saved_minutes);
  const survey = await db.insertSurvey({
    id: randomUUID(),
    user_id: u.value.id,
    user_name: u.value.full_name,
    answers,
    score: susScore(answers),
    time_saved_minutes: t !== null && Number.isFinite(t) && t >= 0 && t <= 120 ? t : null,
    comment: typeof body.comment === "string" ? body.comment.slice(0, 2000) : "",
    created_at: new Date().toISOString(),
  });
  await db.audit({ user_id: u.value.id, action: "questionnaire_envoye", consultation_id: null, detail: `SUS ${survey.score}` });
  return json(survey, 201);
}
