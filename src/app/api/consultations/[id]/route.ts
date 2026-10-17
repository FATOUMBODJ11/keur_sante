import type { NextRequest } from "next/server";
import { json, requireConsultation } from "@/lib/api";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/consultations/[id]">) {
  const { id } = await ctx.params;
  const g = await requireConsultation(id);
  if (!g.ok) return g.response;
  return json(g.value.c);
}
