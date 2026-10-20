/**
 * Mode vitrine : une adresse du type #ecran-accueil ouvre directement un écran avec les données d'exemple,
 * sans rien lire ni enregistrer sur l'appareil. Sert à importer les écrans dans Figma (html.to.design)
 * et à les montrer en entretien.
 */
export const VITRINE_SCREENS = [
  'bienvenue',
  'code',
  'accueil',
  'saisie',
  'mouvements',
  'point-1',
  'point-2',
  'point-3',
  'point-4',
  'point-fin',
  'objectifs',
  'objectif',
  'patrimoine',
  'reglages',
] as const;

export type VitrineScreen = (typeof VITRINE_SCREENS)[number];

export const vitrineFromHash = (hash: string): VitrineScreen | null => {
  const name = hash.replace(/^#/, '');
  if (!name.startsWith('ecran-')) return null;
  const screen = name.slice('ecran-'.length);
  return (VITRINE_SCREENS as readonly string[]).includes(screen) ? (screen as VitrineScreen) : null;
};
