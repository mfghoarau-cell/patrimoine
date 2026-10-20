# Patrimoine

Application de budget personnel pour téléphone. Tu fixes deux cibles chaque mois, un budget loisirs et un montant à investir, et l'application t'aide à les tenir :

- les revenus, charges fixes et l'épargne de sécurité sont déclarés une seule fois et s'inscrivent seuls chaque mois ;
- au quotidien, tu ne saisis que tes dépenses de loisirs (ou une dépense exceptionnelle) ;
- l'accueil compare le rythme de tes loisirs aux jours restants et te prévient si ta cible d'investissement est menacée, avec le montant disponible par jour pour la tenir ;
- une fois par mois, le **point du mois** confirme les opérations automatiques, rattrape les oublis grâce au CSV exporté depuis ta banque, fait le bilan des deux cibles et répartit le reste entre tes objectifs et ton PEA.

Tes données restent sur ton téléphone (stockage du navigateur). Aucun identifiant bancaire n'est demandé.

## Lancer l'application sur ton ordinateur

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run dev
```

Puis ouvre l'adresse affichée (http://localhost:5173). Autres commandes : `npm test` lance les tests des calculs, `npm run build` prépare la version en ligne dans `dist`.

## Mettre l'application en ligne (GitHub Pages)

Une seule fois :

1. Sur github.com, crée un dépôt nommé `patrimoine`. Le dépôt doit être **public** pour que GitHub Pages soit gratuit : seul le code est visible, jamais tes données, qui restent sur ton téléphone.
2. Envoie le contenu de ce dossier dans le dépôt. Le plus simple est GitHub Desktop : *File > Add local repository*, choisis ce dossier, accepte de créer le dépôt, puis *Publish repository* en décochant *Keep this code private*. En ligne de commande :
   ```bash
   git init
   git add .
   git commit -m "Patrimoine 1.0"
   git branch -M main
   git remote add origin https://github.com/<ton-compte>/patrimoine.git
   git push -u origin main
   ```
3. Dans le dépôt sur github.com : *Settings > Pages > Build and deployment > Source* : choisis **GitHub Actions**.
4. Va dans l'onglet *Actions* : le déploiement « Mise en ligne » se lance (environ 1 minute). L'application est ensuite disponible à l'adresse `https://<ton-compte>.github.io/patrimoine/`.

Ensuite, chaque modification envoyée sur la branche `main` est remise en ligne automatiquement, après le passage des tests.

## L'installer sur ton téléphone

- **iPhone** : ouvre l'adresse dans Safari, touche le bouton Partager, puis *Sur l'écran d'accueil*.
- **Android** : ouvre l'adresse dans Chrome, puis menu *⋮ > Installer l'application*.

Une fois installée, l'application s'ouvre en plein écran et fonctionne sans connexion. Utilise toujours l'icône installée : c'est elle qui garde tes données (Safari et l'application installée ont chacun leur propre stockage sur iPhone).

## Démonstration avec des données d'exemple

Sur l'écran d'accueil de l'application, « Découvrir avec des données d'exemple » crée quatre mois fictifs calés sur la date du jour (code d'accès : 1234) :

- trois mois déjà bouclés, dont un où la cible d'investissement a été manquée ;
- le mois précédent à boucler en direct : dans le point du mois, « Utiliser le relevé d'exemple » importe un export bancaire fictif (opérations récurrentes reconnues, un doublon écarté, deux opérations rangées par les règles, trois à ranger) ;
- le mois en cours avec un rythme de loisirs qui déclenche l'alerte ;
- trois objectifs, un PEA et une simulation immobilière.

Pour repartir de zéro : *Réglages > Quitter la démo*.

## Écrans pour Figma

Chaque écran s'ouvre directement, avec les données d'exemple et sans rien enregistrer, en ajoutant son nom à l'adresse de l'application : `#ecran-bienvenue`, `#ecran-code`, `#ecran-accueil`, `#ecran-saisie`, `#ecran-mouvements`, `#ecran-point-1` à `#ecran-point-4`, `#ecran-point-fin`, `#ecran-objectifs`, `#ecran-objectif`, `#ecran-patrimoine`, `#ecran-reglages`.

Pour les importer en calques modifiables dans Figma : plugin html.to.design, onglet URL, colle par exemple `https://mfghoarau-cell.github.io/patrimoine/#ecran-accueil`, choisis une largeur de 390 px, puis importe.

## Sauvegarde

Les données ne vivent que sur le téléphone. Dans *Réglages > Sauvegarde*, exporte une sauvegarde chaque mois, par exemple juste après le point du mois, et range-la dans ton cloud (iCloud Drive, Google Drive). Le même écran permet de la restaurer sur un nouveau téléphone.

Le bouton de restauration accepte aussi l'export JSON de l'ancienne version (Cap Patrimoine) : il reprend tes opérations récurrentes, tes objectifs, ton PEA et ta simulation immobilière.

## Export CSV de la banque

L'import reconnaît les exports bancaires courants : séparateur `;`, `,` ou tabulation, lignes d'informations du compte avant le tableau, et soit une colonne « Montant » signée, soit deux colonnes « Débit » et « Crédit ». Les opérations récurrentes déjà prévues, les dépenses déjà saisies et les doublons d'un import précédent sont écartés automatiquement. Les opérations rangées une fois peuvent l'être automatiquement les fois suivantes (*Réglages > Règles de rangement*).

## Organisation du code

- `src/lib/budget.ts` : calculs (projection du mois, alerte, bilan, objectifs), testés dans `budget.test.ts`
- `src/lib/csv.ts` : lecture des exports bancaires et rapprochement
- `src/lib/storage.ts` : enregistrement local, sauvegarde et import de l'ancienne version
- `src/screens/` : les écrans (accueil, saisie, mouvements, point du mois, objectifs, patrimoine, réglages, configuration)
- `src/styles.css` : fondations visuelles (couleurs, typographie, espacements) et composants
