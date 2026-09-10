# Dette technique — Krosmarge

État à la fusion de `feat/krosmarge-v1` dans `main` (33 commits, 132 tests),
**revu le 2026-09-10** à la fusion de `feat/registre-negoce` (273 tests).

Chaque point ci-dessous a été identifié par une revue, jugé non bloquant, et consciemment reporté. Aucun n'est une surprise.

## Réglé par le registre de négoce (2026-09-10)

- **Le profit réalisé ignorait la taxe perdue des retours.** Le modèle traite
  désormais chaque mise en vente comme une taxe datée et perdue, où qu'elle
  aboutisse. Un retrait n'efface plus rien.
- **La taxe était à 2 %.** Le jeu est à 3 %. Le taux est maintenant un entier en
  pour mille, arrondi une seule fois sur le lot entier, et le libellé de
  l'interface dérive de la constante.
- **147 ingrédients orphelins.** L'ajout de `pet.json` et `mount.json` les fait
  tomber à **10**, et rend calculables environ 150 recettes qui ne l'étaient pas.
- **La sémantique des ventes déjà enregistrées.** La question ne se pose plus :
  la migration Dexie v2 convertit les lots en unités, et le registre ne raisonne
  qu'en unités.
- **Aucun test d'écran, sauf `PricesScreen`.** `TradesScreen` en a un désormais,
  qui a immédiatement attrapé trois défauts d'assertion. Reste dû pour
  `CraftsScreen`, `CraftDetailScreen`, `SettingsScreen`, `TradeForm` et
  `LedgerScreen`.
- **Le libellé de quantité comprimait les noms d'objets.** L'écran a été
  réécrit ; `.sales__history-qty` n'existe plus sous cette forme.

---

## À traiter en priorité

### Cinq écrans sur sept n'ont aucun test

`CraftsScreen`, `CraftDetailScreen`, `SettingsScreen`, `TradeForm` et
`LedgerScreen` ne sont couverts par aucun test. `PricesScreen` et
`TradesScreen` en ont un.

Ce n'est pas une lacune théorique : la revue finale de la v1 a trouvé quatre défauts de câblage, **tous** situés entre un domaine correct et un stockage correct, et **aucun** n'aurait survécu à un test d'écran. Le relecteur l'a formulé ainsi : un seul fichier de test sur `PricesScreen` aurait attrapé quatre des dix défauts. Le test de `TradesScreen`, écrit le 2026-09-10, a confirmé la leçon en attrapant trois défauts dès sa première exécution.

Le harnais est écrit et réutilisable : `vi.mock('../AppState')` dans `src/ui/screens/PricesScreen.test.tsx` ou `TradesScreen.test.tsx` — ce dernier fournit en plus un normaliseur pour l'espace fine insécable des montants.

Cas les plus urgents : l'indice de confiance sur la marge du détail de craft, verrouillé par une seule vérification navigateur ; et `TradeForm`, où se décide le coût de revient de chaque opération.

---

## Confort et robustesse

### La fraîcheur ne vieillit pas à l'écran

`CraftsScreen`, `CraftDetailScreen` et `TradesScreen` appellent `Date.now()` au rendu sans minuteur. Tant qu'un écran reste ouvert, les pastilles de fraîcheur ne changent pas et l'ancienneté du stock affichée sur les cartes de négoce ne s'incrémente pas.

### « Nouvelle session » resert les mêmes objets

La file de relevé est volontairement figée à l'ouverture, pour ne pas se réordonner sous le pouce du joueur. Mais `onRestart` ne réinitialise que le curseur : la file mémoïsée ne dépend pas du carnet de prix, donc une seconde session propose les douze objets qu'on vient de tarifer. Un compteur de session dans les dépendances du `useMemo` suffirait.

`profitableAtStart` n'est pas rephotographié non plus, donc le récapitulatif de la seconde session compare à la ligne de base de la première.

### Une marge nulle s'affiche en vert

`KamasAmount` donne `data-tone="positive"` à une valeur d'exactement `0`. Un craft à l'équilibre se lit comme un gain.

### Un métier remis à zéro laisse une pastille morte

Régler un métier à 60 puis le remettre à 0 laisse `{ tailleur: 0 }` dans `jobLevels`. La pastille de filtre correspondante reste affichée en tête de l'écran Crafts sans jamais rien contenir, et le message « déclare tes niveaux de métier » cesse d'apparaître.

### Aucun rappel de sauvegarde

L'export JSON existe, mais rien ne pousse à le faire. Le registre de négoce
accumule des mois de saisie que ni IndexedDB ni le navigateur ne garantissent :
une purge de données de site effacerait tout. Un bandeau discret au-delà de N
jours sans export était prévu au cahier des charges et n'a pas été implémenté.

### Le formulaire n'avertit pas des incohérences de dates

Rien n'empêche de saisir une vente antérieure à l'achat, ou une quantité vendue
supérieure à la quantité acquise. Le moteur y résiste — la quantité restante est
bornée à zéro, les agrégats restent exacts — mais l'utilisateur n'est pas
prévenu qu'il vient de saisir quelque chose d'impossible.

### Pas d'annulation après suppression

Supprimer une opération demande confirmation, mais est définitif. Le modèle
étant immuable, une pile en mémoire des vingt derniers états coûterait une
dizaine de lignes et supprimerait une classe entière de perte de données.

### L'édition d'une ligne existante est impossible

On peut ajouter et supprimer des mouvements, retirer, supprimer la ligne — mais
pas corriger le prix d'achat, la quantité acquise ou la date d'acquisition d'une
opération déjà enregistrée. Il faut la supprimer et la ressaisir.

---

## Limites assumées des données

### 60 recettes sans métier identifié, invisibles

Ni `api.dofusdb.fr` (contenu absent de Dofus 3) ni l'encyclopédie Touch (403 Cloudflare) ne permettent de les résoudre. Elles concernent Pierre magique (33), Sac à dos (11), Fée d'artifice (6), Metaria (4), Graine (3), Ressources diverses (2) et Légume (1).

Comme `inconnu` n'est pas dans `CRAFT_JOBS`, ces recettes n'apparaissent **sous aucun filtre**, pas même « Tous ». La spec §3.2 promettait qu'elles resteraient visibles avec un badge explicite et corrigeables depuis les Réglages : ni le badge ni l'interface de correction n'existent.

### 10 ingrédients orphelins

Ces ingrédients sont référencés par des recettes mais absents du dataset. Les recettes concernées ne pourront jamais être calculées, et gonflent le bandeau « N crafts non classés » d'un nombre qui ne peut pas atteindre zéro, sans explication.

**Nettement réduit le 2026-09-10** : ils étaient 147, pour 156 recettes incalculables. L'ajout des familiers et des montures au catalogue en a résolu 137 — ces objets étaient référencés comme ingrédients sans figurer au catalogue. Il en reste 10, dont les identifiants sont affichés par `npm run build:catalog`.

Une ligne dans les Réglages — « 60 recettes sans métier identifié, N recettes incalculables faute d'ingrédients absents du dataset » — suffirait à honorer le principe directeur, qui interdit de taire une lacune connue.

### La table de poids des statistiques n'est pas vérifiée

Elle provient de tables publiées par la communauté et n'a pu être recoupée avec aucune source de données. C'est le maillon faible de l'estimation de brisage. L'interface annonce bien une estimation et nomme les paramètres non modélisés, mais ne dit pas que les poids eux-mêmes sont incertains.

### Le module de brisage est inerte à l'installation

Les dix runes portent `runeItemId: 0`, donc chaque détail de craft affiche « Runes non associées ». Pour l'activer, le joueur doit saisir dix identifiants numériques bruts dans les Réglages, sans sélecteur ni recherche — rien ne lui permet de découvrir que la Rune Vi porte l'identifiant 1554.

Le catalogue contient pourtant **118 objets de type « Rune de forgemagie »**, aux noms explicites. Les résoudre par nom dans `scripts/build-catalog.ts` transformerait une fonctionnalité présente sur le papier en fonctionnalité réellement utilisable.

---

## Comportements spécifiés et absents

| Spec | Attendu | État |
|---|---|---|
| §7.1 | Tri par confiance | Seuls marge nette et % |
| §7.1 | Filtre de niveau maximum | Absent |
| §7.1 | Le bandeau pousse vers le relevé **filtré** sur les manques | Pousse vers l'onglet, sans filtre |
| §1, §7.1 | Les crafts incomplets isolés dans une **liste actionnable** | Un compteur seulement ; la liste n'est jamais affichée |
| §6.3 | File **groupée par HDV** (Ressources / Équipements) pour un seul aller-retour en jeu | Tri par priorité à plat |
| §6.4, §7.5 | Poids des statistiques **corrigeables** depuis les Réglages | Seuls les identifiants de runes le sont |

Le groupement par HDV est le plus conséquent : c'est l'argument ergonomique du mode guidé, et son absence fait faire des allers-retours entre deux hôtels de vente.

---

## Cosmétique

- `public/favicon.svg` est resté le logo Vite alors que l'application installée porte le monogramme Krosmarge. `public/icons.svg` est un reliquat du gabarit qui part quand même dans `dist/`.
- Pas de `<link rel="apple-touch-icon">` : iOS Safari s'en sert pour « Ajouter à l'écran d'accueil » plutôt que du manifeste, et peut retomber sur une capture d'écran.
- Apostrophes élidées dans les descriptions de tests (« nest », « dun », « lidentifiant »), héritées du plan qui utilisait des chaînes en quotes simples.
- `AppState` reconstruit son objet de contexte à chaque rendu, sans `useMemo`.
- `STAT_WEIGHTS` et `RUNES[].runeWeight` portent la même valeur pour les dix statistiques mappées : deux sources pour une seule vérité, dont la divergence changerait silencieusement toutes les estimations.
- L'import de sauvegarde affiche « Recharge la page » au lieu de rafraîchir l'état en mémoire.

---

## Note sur la palette

Un test de non-régression (`tests/palette.test.ts`) verrouille désormais la séparation des couleurs sémantiques, après deux quasi-collisions passées à travers les relectures.

La règle appliquée est **40° de teinte OU 40 points de saturation**, et non un seuil de teinte seul : `--k-fresh` et `--k-missing` ne sont séparés que de 16,6° de teinte mais de 73 points de saturation — un bleu vif contre un gris. Un seuil de teinte strict aurait échoué sur trois paires légitimes.

La faille théorique de cette règle disjonctive — une teinte quasi identique sauvée par un large écart de saturation — est fermée par une seconde assertion qui fige la composition de l'ensemble des couleurs saturées.
