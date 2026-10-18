import "server-only";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db, describeDbError } from "@/lib/store";
import type { Consultation, User } from "@/lib/types";

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Convertit une exception métier (avec `status`) en réponse JSON. */
export function fromError(err: unknown) {
  const status = typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : 500;
  const hasStatus = typeof (err as { status?: unknown })?.status === "number";
  // Erreurs techniques (base…) : message lisible, sans jamais exposer la chaîne de connexion.
  const message = hasStatus && err instanceof Error ? err.message : describeDbError(err);
  if (status >= 500) console.error(err);
  return error(status, message);
}

type Guarded<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

export async function requireUser(): Promise<Guarded<User>> {
  const user = await currentUser();
  if (!user) return { ok: false, response: error(401, "Session expirée. Reconnectez-vous.") };
  return { ok: true, value: user };
}

/** Consultation appartenant au médecin connecté. */
export async function requireConsultation(id: string): Promise<Guarded<{ user: User; c: Consultation }>> {
  const u = await requireUser();
  if (!u.ok) return u;
  const c = await db.getConsultation(id);
  if (!c || c.doctor_id !== u.value.id) return { ok: false, response: error(404, "Consultation introuvable") };
  return { ok: true, value: { user: u.value, c } };
}
