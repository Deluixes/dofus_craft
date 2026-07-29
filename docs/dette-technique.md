# Dette technique — Krosmarge v1

État à la fusion de `feat/krosmarge-v1` dans `main` (33 commits, 132 tests).

Chaque point ci-dessous a été identifié par une revue, jugé non bloquant, et consciemment reporté. Aucun n'est une surprise.

---

## À traiter en priorité

### Quatre écrans sur cinq n'ont aucun test

`CraftDetailScreen`, `CraftsScreen`, `SalesScreen` et `SettingsScreen` ne sont couverts par aucun test. Seul `PricesScreen` en a un, écrit pendant la vague de correction finale.

Ce n'est pas une lacune théorique : la revue finale a trouvé quatre défauts de câblage, **tous** situés entre un domaine correct et un stockage correct, et **aucun** n'aurait survécu à un test d'écran. Le relecteur l'a formulé ainsi : un seul fichier de test sur `PricesScreen` aurait attrapé quatre des dix défauts.

Le harnais est déjà écrit et réutilisable : `vi.mock('../AppState')` dans `src/ui/screens/PricesScreen.test.tsx`.

Cas le plus urgent : l'indice de confiance sur la marge du détail de craft n'est verrouillé que par une vérification navigateur, non reproductible automatiquement.

### Les ventes déjà enregistrées ont changé de sémantique

La correction du calcul des lots a redéfini `Sale.quantity` : c'est désormais un **nombre de lots**, et le total d'unités vaut `quantity × lotSize`.

Une vente déjà présente en base sous la forme `{ quantity: 5, lotSize: 100 }` valait 5 unités avant, et en vaut 500 après — sans migration. Si des ventes de test avec un lot différent de 1 existent, leurs chiffres sont faux et la table doit être vidée depuis les Réglages.

C'est la seule réécriture de chiffres d'argent déjà affichés de tout le projet, et elle mérite une décision explicite plutôt qu'un oubli.

---

## Confort et robustesse

### Le libellé de quantité comprime les noms d'objets

`.sales__history-qty` est en `flex: none` et son contenu est passé de `×5` à `5 lots de 100 · 500 unités` — 26 caractères. À 360 px de large, il n'y a pas de débordement, mais le nom de l'objet est fortement tronqué. Le pire cas, la ligne « retourné », n'a pas été mesuré.

### La fraîcheur ne vieillit pas à l'écran

`CraftsScreen`, `CraftDetailScreen` et `SalesScreen` appellent `Date.now()` au rendu sans minuteur. Tant qu'un écran reste ouvert, les pastilles de fraîcheur ne changent pas et le compte à rebours d'expiration des ventes ne s'égrène pas.

### « Nouvelle session » resert les mêmes objets

La file de relevé est volontairement figée à l'ouverture, pour ne pas se réordonner sous le pouce du joueur. Mais `onRestart` ne réinitialise que le curseur : la file mémoïsée ne dépend pas du carnet de prix, donc une seconde session propose les douze objets qu'on vient de tarifer. Un compteur de session dans les dépendances du `useMemo` suffirait.

`profitableAtStart` n'est pas rephotographié non plus, donc le récapitulatif de la seconde session compare à la ligne de base de la première.

### Une marge nulle s'affiche en vert

`KamasAmount` donne `data-tone="positive"` à une valeur d'exactement `0`. Un craft à l'équilibre se lit comme un gain.

### Un métier remis à zéro laisse une pastille morte

Régler un métier à 60 puis le remettre à 0 laisse `{ tailleur: 0 }` dans `jobLevels`. La pastille de filtre correspondante reste affichée en tête de l'écran Crafts sans jamais rien contenir, et le message « déclare tes niveaux de métier » cesse d'apparaître.

### Le profit réalisé ignore la taxe perdue des retours

`SalesScreen` ne totalise que les ventes conclues. La taxe payée sur une vente retournée est affichée ligne par ligne mais jamais sommée, donc le chiffre de tête surestime le profit réel de quiconque a des retours.

---

## Limites assumées des données

### 60 recettes sans métier identifié, invisibles

Ni `api.dofusdb.fr` (contenu absent de Dofus 3) ni l'encyclopédie Touch (403 Cloudflare) ne permettent de les résoudre. Elles concernent Pierre magique (33), Sac à dos (11), Fée d'artifice (6), Metaria (4), Graine (3), Ressources diverses (2) et Légume (1).

Comme `inconnu` n'est pas dans `CRAFT_JOBS`, ces recettes n'apparaissent **sous aucun filtre**, pas même « Tous ». La spec §3.2 promettait qu'elles resteraient visibles avec un badge explicite et corrigeables depuis les Réglages : ni le badge ni l'interface de correction n'existent.

### 147 ingrédients orphelins, 156 recettes incalculables

Ces ingrédients sont référencés par des recettes mais absents du dataset. Les 156 recettes concernées ne pourront jamais être calculées, et gonflent le bandeau « N crafts non classés » d'un nombre qui ne peut pas atteindre zéro, sans explication.

Une ligne dans les Réglages — « 60 recettes sans métier identifié, 156 recettes incalculables faute d'ingrédients absents du dataset » — suffirait à honnorer le principe directeur, qui interdit de taire une lacune connue.

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
