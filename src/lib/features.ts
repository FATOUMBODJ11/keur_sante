/**
 * Interrupteurs de fonctionnalités.
 *
 * Le wolof est en pause : l'application fonctionne en français seul tant que
 * KS_WOLOF n'est pas mis à « on ». Tout le code wolof (Kiriku-Wolof-ASR,
 * traduction, cas en wolof) reste en place pour la reprise.
 */
export const wolofEnabled = (): boolean => process.env.KS_WOLOF === "on";
