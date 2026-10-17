import { json, requireUser } from "@/lib/api";
import { providersInfo } from "@/lib/agent";

export async function GET() {
  const u = await requireUser();
  if (!u.ok) return u.response;
  return json(providersInfo());
}
