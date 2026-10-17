import type { NextRequest } from "next/server";
import { fromError, json, requireConsultation } from "@/lib/api";
import { validate } from "@/lib/consultations";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/consultations/[id]/validate">) {
  const { id } = await ctx.params;
  const g = await requireConsultation(id);
  if (!g.ok) return g.response;
  try {
    return json(await validate(g.value.c, g.value.user));
  } catch (err) {
    return fromError(err);
  }
}
