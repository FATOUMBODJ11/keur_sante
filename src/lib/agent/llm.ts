import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/**
 * Accès au LLM (Claude). Activé dès que ANTHROPIC_API_KEY est défini
 * (ou KS_LLM_PROVIDER=claude) ; KS_LLM_PROVIDER=rules force le moteur de règles.
 * Sans clé, le prototype fonctionne entièrement hors-ligne avec les règles.
 * Attention : la transcription (pseudonymisée) est alors envoyée à l'API.
 */
export const LLM_MODEL = process.env.KS_LLM_MODEL || "claude-opus-5-5";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORT = (process.env.KS_LLM_EFFORT as Effort) || "medium";

export function llmEnabled(): boolean {
  const provider = process.env.KS_LLM_PROVIDER;
  if (provider === "rules") return false;
  return provider === "claude" || !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

/** Appel unique à sortie structurée, validée par un schéma Zod. */
export async function structuredCall<T extends z.ZodType>(
  schema: T,
  system: string,
  user: string,
): Promise<z.infer<T>> {
  const res = await getClient().messages.parse({
    model: LLM_MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(schema), effort: EFFORT },
  });
  if (res.stop_reason === "refusal") throw new Error("Le modèle a décliné la requête");
  if (res.stop_reason === "max_tokens") throw new Error("Réponse du modèle tronquée");
  if (!res.parsed_output) throw new Error("Réponse du modèle non conforme au schéma");
  return res.parsed_output as z.infer<T>;
}

export function llmErrorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "clé API invalide ou absente";
  if (err instanceof Anthropic.RateLimitError) return "limite de débit atteinte";
  if (err instanceof Anthropic.APIConnectionError) return "API injoignable";
  if (err instanceof Anthropic.APIError) return `erreur API ${err.status ?? ""}`.trim();
  return err instanceof Error ? err.message : String(err);
}
