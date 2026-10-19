/** Score SUS : items impairs (positifs) = réponse − 1 ; items pairs (négatifs) = 5 − réponse ; somme × 2,5. */
export function susScore(answers: number[]): number {
  const total = answers.reduce((acc, a, i) => acc + (i % 2 === 0 ? a - 1 : 5 - a), 0);
  return Math.round(total * 2.5 * 10) / 10;
}

/** Les 10 affirmations du questionnaire SUS (traduction française usuelle). */
export const SUS_ITEMS = [
  "Je pense que j'aimerais utiliser Keur Santé fréquemment.",
  "J'ai trouvé Keur Santé inutilement complexe.",
  "J'ai trouvé Keur Santé facile à utiliser.",
  "Je pense que j'aurais besoin de l'aide d'un technicien pour pouvoir utiliser Keur Santé.",
  "J'ai trouvé que les différentes fonctions de Keur Santé étaient bien intégrées.",
  "J'ai trouvé qu'il y avait trop d'incohérences dans Keur Santé.",
  "J'imagine que la plupart des praticiens apprendraient à utiliser Keur Santé très rapidement.",
  "J'ai trouvé Keur Santé très contraignant à utiliser.",
  "Je me suis senti(e) très en confiance en utilisant Keur Santé.",
  "J'ai dû apprendre beaucoup de choses avant de pouvoir utiliser Keur Santé.",
];

/** Lecture habituelle du score SUS (échelle de Bangor). */
export function susGrade(score: number | null): string {
  if (score === null) return "—";
  if (score >= 85) return "Excellent";
  if (score >= 72) return "Bon";
  if (score >= 52) return "Correct";
  if (score >= 38) return "Médiocre";
  return "Insuffisant";
}
