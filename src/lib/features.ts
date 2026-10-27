/**
 * Interrupteurs de fonctionnalités.
 *
 * Le wolof est activé dès que la reconnaissance vocale ElevenLabs Scribe est
 * configurée (ELEVENLABS_API_KEY), ou explicitement par KS_WOLOF=on.
 * KS_WOLOF=off le remet en pause (application en français seul).
 */
export const scribeEnabled = (): boolean => !!process.env.ELEVENLABS_API_KEY;

export const wolofEnabled = (): boolean => {
  const flag = process.env.KS_WOLOF;
  if (flag === "off") return false;
  return flag === "on" || scribeEnabled();
};

/**
 * Le français passe aussi par Scribe quand il est configuré (l'audio ne transite
 * plus par la dictée du navigateur, et les voix sont séparées).
 * KS_ASR_FR=browser garde la dictée du navigateur pour le français.
 */
export const scribeForFrench = (): boolean => scribeEnabled() && process.env.KS_ASR_FR !== "browser";
