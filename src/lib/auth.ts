import "server-only";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/store";
import type { PublicUser, User } from "@/lib/types";

export const SESSION_COOKIE = "ks_session";
const MAX_AGE = 60 * 60 * 12; // 12 h : une journée de consultation

/** Problème de configuration du secret de session, ou null si tout va bien. */
export function sessionSecretProblem(): string | null {
  const s = process.env.KS_SESSION_SECRET;
  if (process.env.NODE_ENV !== "production") return null;
  if (!s) return "La variable KS_SESSION_SECRET n'est pas définie sur le serveur (Vercel → Settings → Environment Variables), puis redéployez.";
  if (s.length < 32) return "KS_SESSION_SECRET est trop court : 32 caractères au moins.";
  return null;
}

function secret(): string {
  const problem = sessionSecretProblem();
  if (problem) throw Object.assign(new Error(problem), { status: 503 });
  return process.env.KS_SESSION_SECRET || "keur-sante-dev-secret-ne-pas-utiliser-en-production";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid: string; exp: number };
    return exp > Date.now() ? uid : null;
  } catch {
    return null;
  }
}

export function verifyPassword(user: User, password: string): boolean {
  const [salt, hash] = user.passwordHash.split(":");
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

export function toPublic(user: User): PublicUser {
  const { passwordHash: _omit, ...rest } = user;
  void _omit;
  return rest;
}

export async function setSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  if (sessionSecretProblem()) return null;
  const uid = readToken((await cookies()).get(SESSION_COOKIE)?.value);
  return uid ? ((await db.findUser(uid)) ?? null) : null;
}
