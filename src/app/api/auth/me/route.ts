import { toPublic } from "@/lib/auth";
import { json, requireUser } from "@/lib/api";

export async function GET() {
  const u = await requireUser();
  if (!u.ok) return u.response;
  return json({ user: toPublic(u.value) });
}
