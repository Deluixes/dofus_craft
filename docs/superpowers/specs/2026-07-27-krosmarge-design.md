# Krosmarge — Application de rentabilité Dofus Touch

**Date :** 2026-07-27
**Statut :** Design validé, prêt pour planification
**Version :** v1

---

## 1. Objectif

Une application mobile (PWA) qui répond à une question, tous les soirs, en moins de dix secondes :
**« qu'est-ce que je crafte ce soir pour gagner le plus de kamas ? »**

Elle s'appuie sur un catalogue d'objets et de recettes Dofus Touch pré-chargé, et sur des prix d'hôtel des ventes saisis à la main par le joueur — puisque aucune API publique n'expose les prix HDV de Touch.

### Principe directeur : l'app ne ment jamais

Un classement par marge alimenté par des prix périmés affichera « +18 % » avec aplomb et fera crafter à perte. C'est le mode d'échec principal de ce type d'outil, et il est pire que l'absence d'outil.

Conséquences structurantes, valables dans tout le reste du document :

- toute marge affichée porte un **indice de confiance** dérivé de la fraîcheur des prix qui l'ont produite ;
- un craft dont il manque un prix n'est **jamais** classé avec une valeur estimée : il est isolé dans une liste « à compléter », actionnable ;
- toute valeur issue d'un modèle approximatif (brisage) est présentée explicitement comme une estimation.

---

## 2. Contexte du domaine

### Mécaniques HDV Dofus Touch

| Règle | Valeur | Impact sur le design |
|---|---|---|
| Taxe de vente | **2 %, prélevée à la mise en vente** | Entre dans le calcul de marge ; une vente non conclue coûte quand même la taxe |
| Tailles de lot | **1 / 10 / 100** | Modélisé à la saisie des prix (voir §5.2) |
| Durée d'une vente | **2 semaines** puis retour en banque | Alerte d'expiration dans le suivi des ventes |
| Emplacements de vente | = niveau du personnage | Hors périmètre v1 |

Repère communautaire : une marge nette supérieure à 10 % rend un craft intéressant.

### Métiers

- **Récolte** : Paysan, Bûcheron, Mineur, Alchimiste, Pêcheur, Chasseur
- **Craft** : Bijoutier, Cordonnier, Tailleur, Forgeron, Sculpteur, Façonneur, Bricoleur
- **Forgemagie** : Forgemage, Sculptemage, Cordomage, Joaillomage, Costumage, Façomage, Parchomage — hors périmètre v1

---

## 3. Sources de données — état vérifié

Vérifications effectuées le 2026-07-27, données téléchargées et analysées, pas seulement consultées.

| Source | État | Décision |
|---|---|---|
| `api.dofusdb.fr` | Vivante, 4 858 recettes, gratuite, sans clé | **Utilisée uniquement pour dériver la table type → métier** (§3.2). Ses recettes sont du Dofus 3 et ne doivent pas alimenter le catalogue. |
| `dofapi.fr` (API live) | DNS mort (NXDOMAIN) | Écartée |
| `dofapi/crawlit-dofus-encyclopedia-parser`, dossier `data/dofus-touch/` | Disponible sur GitHub | **Source du catalogue** |
| Encyclopédie `dofus-touch.com` | En ligne, 403 sur requête simple | Source de vérité pour vérification manuelle ponctuelle |

### 3.1 Couverture mesurée du dataset Touch

| Fichier | Objets | Avec recette | Couverture |
|---|---|---|---|
| `allequipments.json` | 2 235 | 916 | 41 % |
| `allweapons.json` | 962 | 588 | 61 % |
| `resource.json` | 1 968 | 354 | 18 % |
| `consumable.json` | 1 154 | 361 | 31 % |
| **Total** | **6 319** | **2 219** | **35 %** |

La répartition par type confirme qu'il s'agit du reflet du jeu et non d'un scrape incomplet : Dofus 0 %, Boucliers 12 %, Trophées 83 %, Dagues 78 %, Marteaux 77 %. Les objets sans recette sont majoritairement du butin de donjon, non craftables par construction.

Schéma d'un objet :

```json
{
  "_id": 15757,
  "name": "Le Dorado",
  "type": "Chapeau",
  "lvl": "200",
  "imgUrl": "https://s.ankama.com/.../170726.png",
  "url": "https://www.dofus-touch.com/fr/mmorpg/encyclopedie/equipements/15757-dorado",
  "stats": [ { "Vitalité": { "from": "351", "to": "400" } } ],
  "recipe": [ { "Tourmaline": { "id": "15259", "type": "Pierre précieuse",
                                "lvl": "10", "quantity": "12" } } ],
  "setId": 0
}
```

Les jets `from` / `to` de chaque statistique sont présents. Ils ne servent pas en v1 en dehors du brisage, mais ils constituent la matière première du module de forgemagie prévu en v2.

### 3.2 Table type → métier

Le dataset Touch **ne porte pas le métier**. Il est dérivé du champ `type` via une table de correspondance, elle-même obtenue empiriquement en agrégeant les 4 858 recettes de `api.dofusdb.fr` (qui expose `resultTypeId` et `jobId`) — et non de mémoire. La colonne « pureté » indique le pourcentage de recettes du type attribuées au métier majoritaire.

| Type | Métier | Pureté |
|---|---|---|
| Chapeau, Cape | Tailleur | 100 % |
| Anneau, Amulette | Bijoutier | 100 % |
| Bottes, Ceinture | Cordonnier | 100 % |
| **Trophée, Bouclier** | **Façonneur** | 100 % / 99 % |
| Dague, Marteau, Hache, Pelle, Faux | Forgeron | 100 % |
| Épée | Forgeron | 94 % |
| Arc, Baguette | Sculpteur | 100 % |
| Bâton | Sculpteur | 99 % |
| Pierre d'âme | Mineur | 100 % |
| Potion, Boisson, Teinture, Préparation | Alchimiste | 100 % |
| Pain, Friandise, Huile | Paysan | 100 % |
| Poisson comestible | Pêcheur | 100 % |
| Viande comestible | Chasseur | 100 % |
| Planche, Substrat | Bûcheron | 100 % |
| Alliage | Mineur | 100 % |
| Clef, Prisme | Bricoleur | 99 % / 100 % |

Deux types présents dans le dataset Touch n'apparaissent pas dans les recettes Dofus 3 : **Sac à dos** (11 recettes Touch) et **Pioche** (1 recette Touch). Ils sont marqués `métier: inconnu`, restent visibles dans l'application avec un badge explicite, et sont corrigeables depuis les réglages. Le type `Outil` est ambigu (pureté 50 %) et reçoit le même traitement.

---

## 4. Périmètre

### Dans la v1

1. **Classement de rentabilité des crafts** — la boucle cœur
2. **Saisie des prix** — mode guidé priorisé, plus recherche libre
3. **Suivi des ventes HDV** — avec alerte d'expiration à 14 jours
4. **Brisage** — comparaison « vendre ou briser »

### Hors v1, explicitement

| Exclusion | Raison |
|---|---|
| Forgemagie | Module à part entière ; reporté en v2, données déjà présentes |
| Marge par pod | Le dataset ne contient pas le poids en pods. Ne pas afficher plutôt qu'inventer. |
| Prix d'achat distinct du prix de vente | Un seul prix de marché par objet. Simplification assumée. |
| Montée de métier chiffrée | Nécessite les tables d'XP par recette, absentes du dataset |
| Partage de prix entre joueurs | Nécessite un backend ; casse la promesse hors-ligne |
| OCR du HDV | Fragile (police, résolution, lots) et suppose de jouer sur le même appareil |
| Multi-serveur, multi-personnage | Un seul carnet de prix |

---

## 5. Modèle de données

### 5.1 Catalogue — généré au build, lecture seule

```ts
type Job =
  | 'tailleur' | 'bijoutier' | 'cordonnier' | 'forgeron' | 'sculpteur'
  | 'faconneur' | 'bricoleur' | 'alchimiste' | 'paysan' | 'mineur'
  | 'bucheron' | 'pecheur' | 'chasseur' | 'inconnu'

interface Item {
  id: number
  name: string
  type: string
  level: number
  job: Job | null          // null si l'objet n'est pas craftable
  imgUrl: string
  stats: StatRange[]       // { name, min, max } — utilisé par le brisage
}

interface Recipe {
  resultItemId: number
  job: Job
  ingredients: { itemId: number; quantity: number }[]
}
```

### 5.2 Prix — saisis par l'utilisateur

```ts
interface PriceEntry {
  id?: number
  itemId: number
  kamas: number            // le montant lu à l'écran, tel quel
  lotSize: 1 | 10 | 100    // le lot auquel ce montant correspond
  observedAt: number       // epoch ms
}
```

**Pourquoi `lotSize` est un champ de premier plan.** Au HDV, l'affichage est « lot de 100 : 45 000 k ». Demander au joueur de diviser de tête, c'est de la friction à chaque saisie et des fautes de frappe à trois zéros sur un écran de téléphone. Le joueur saisit ce qu'il lit ; l'application calcule `prixUnitaire = kamas / lotSize`.

La table est **append-only**. On conserve l'historique — son coût de stockage est négligeable et il alimentera les tendances en v2 — mais la v1 n'affiche que l'entrée la plus récente par objet, et sa fraîcheur.

### 5.3 Ventes

```ts
interface Sale {
  id?: number
  itemId: number
  quantity: number
  lotSize: 1 | 10 | 100
  unitPrice: number
  listedAt: number
  expiresAt: number              // listedAt + 14 jours
  status: 'listed' | 'sold' | 'returned'
  closedAt?: number
  frozenCraftCost: number        // coût unitaire de production figé à la mise en vente
}
```

**Pourquoi `frozenCraftCost`.** Sans ce champ, si le prix des ingrédients bouge pendant qu'un objet est en vente, l'application recalculerait un profit passé avec les prix d'aujourd'hui et raconterait une histoire fausse sur ce qui a réellement été gagné. Le coût est figé au moment de l'engagement.

### 5.4 Réglages

```ts
interface Settings {
  jobLevels: Partial<Record<Job, number>>
  freshness: { freshHours: number; staleHours: number }   // défaut 24 / 72
  catalogVersion: string
}
```

---

## 6. Règles de calcul

Toutes ces fonctions vivent dans `domain/`, sont **pures**, et sont couvertes par des tests unitaires.

### 6.1 Coût et marge

```
prixUnitaire(objet)  = dernierPrix.kamas / dernierPrix.lotSize
coûtCraft(recette)   = Σ ( prixUnitaire(ingrédient) × quantité )
taxe(prixVente)      = prixVente × 0.02
margeNette           = prixVente − taxe(prixVente) − coûtCraft
margePct             = margeNette / coûtCraft
```

`prixVente` désigne **le prix de marché relevé pour l'objet résultat**, exactement au même titre que le prix d'un ingrédient — il est saisi et vieillit comme les autres, et il compte dans la confiance du craft. L'écran de détail (§7.2) permet de le remplacer ponctuellement par une valeur de simulation ; cette substitution est locale à l'écran, n'est jamais enregistrée comme un relevé, et le classement de l'accueil utilise toujours le prix relevé.

Si **un seul** prix est absent — ingrédient ou objet résultat — `margeNette` est indéfinie. La recette n'est pas classée ; elle rejoint la liste « à compléter » avec le décompte des prix manquants.

### 6.2 Fraîcheur

```
âge = maintenant − observedAt

âge < freshHours   → frais       (vert)
âge < staleHours   → acceptable  (ambre)
sinon              → périmé      (rouge)
prix absent        → manquant    (gris)
```

La **confiance d'un craft** est le pire niveau de fraîcheur parmi ses ingrédients et son prix de vente. Un craft n'est pas plus fiable que sa donnée la plus faible.

### 6.3 Priorité du relevé guidé

C'est le calcul qui fait la valeur ergonomique de l'application : décider quel prix mérite d'être relevé en premier.

```
impact(objet)    = Σ sur les recettes CRAFTABLES PAR LE JOUEUR contenant l'objet
                     ( part de l'objet dans le coût total de la recette )
obsolescence(o)  = âge(o) / staleHours        (prix absent → valeur plancher élevée)
priorité(objet)  = impact(objet) × obsolescence(objet)
```

L'ensemble de référence est **l'ensemble des recettes que les niveaux de métier du joueur autorisent**, et non l'ensemble des recettes actuellement rentables. La distinction est essentielle : au premier lancement aucun prix n'est connu, donc aucune recette n'est calculable comme rentable. Fonder l'impact sur la rentabilité rendrait la file de relevé vide au moment précis où elle est la plus nécessaire.

Tant que la part du coût d'un ingrédient est inconnue (prix absent), elle est estimée à parts égales entre les ingrédients de la recette, puis affinée dès que les prix arrivent.

La file d'attente est triée par priorité décroissante, puis **groupée par HDV du jeu** (Ressources / Équipements) afin que le joueur ne fasse qu'un aller-retour en jeu.

Le résultat visé est un message du type : *« relève ces 12 prix, ça réactualise 40 crafts »*.

### 6.4 Brisage

```
valeurBrisage(objet) = Σ sur les stats ( poidsStat × jet × prixUnitaire(rune) )
```

Trois entrées, de natures différentes, à ne pas confondre :

| Entrée | Nature | Provenance |
|---|---|---|
| Jets de l'objet | Donnée de l'objet | Moyenne de `stats[].min` / `stats[].max` du catalogue par défaut ; le joueur peut saisir les jets réels du sien |
| Poids des statistiques | **Constante de jeu** | Table de référence versionnée dans `catalog/`, pas une saisie utilisateur |
| Prix des runes | Donnée de marché | Saisie normale, les runes étant des objets du catalogue au même titre que les autres |

**La table de poids est le maillon faible du module.** Elle n'est présente dans aucune des sources de données identifiées et sera construite à partir des tables publiées par la communauté, puis vérifiée par recoupement sur une poignée d'objets connus. Elle est livrée comme fichier de référence versionné et **corrigeable depuis les réglages**, afin qu'une valeur erronée ne condamne pas la fonctionnalité.

Le résultat est **affiché comme une estimation**, avec la mention que le taux réel dépend de la puissance de brisage et du focus du joueur — paramètres non modélisés en v1.

---

## 7. Écrans

Navigation par barre d'onglets basse, quatre entrées : **Crafts · Prix · Ventes · Réglages**. Le détail d'un objet s'ouvre en surcouche.

### 7.1 Crafts — accueil

Liste triée par marge nette. Chaque ligne : icône, nom, badge de niveau, **marge en kamas en corps large**, pourcentage en dessous, pastille de fraîcheur.

En-tête collant : filtres en pastilles (métier, niveau maximum borné par les niveaux de métier déclarés), et sélecteur de tri (marge nette / marge % / confiance).

Bandeau en tête de liste : *« 12 crafts non classés, il manque des prix → Relever »*, qui pousse directement vers la file de relevé filtrée sur ces manques.

### 7.2 Détail d'un craft

Décomposition ingrédient par ingrédient : icône, `quantité × prix unitaire = sous-total`, pastille de fraîcheur, et **correction du prix par tap sur la ligne, sans quitter l'écran**.

Pied de page : coût de craft, taxe 2 %, prix de vente éditable pour simuler, marge nette.

Actions :
- **« J'ai crafté et mis en vente »** — crée une `Sale` avec `frozenCraftCost`
- **carte brisage** — « Vendre 45 000 k · Briser ≈ 61 000 k », mention estimation

### 7.3 Prix

Le parcours principal est le **mode guidé**, plein écran, un objet à la fois :

- l'objet en grand, avec son prix actuel en grisé et son âge (*« 45 000 k · il y a 6 j »*), pour voir immédiatement si la valeur a bougé ;
- sélecteur de lot **1 / 10 / 100** en contrôle segmenté, qui **mémorise le dernier lot utilisé pour cet objet** ;
- **pavé numérique propre à l'application**, pas le clavier système : touches larges, séparateurs de milliers insérés en direct, aucune autocorrection ;
- validation → **passage automatique au suivant**, avec progression *« 7 / 12 »* ;
- bouton « passer » toujours accessible.

Écran de fin de session : *« 12 prix relevés · 40 crafts réactualisés · 3 crafts sont devenus rentables »*, avec la liste de ces trois-là — le lien explicite entre l'effort de saisie et le gain.

La **recherche libre** est accessible en permanence depuis le même onglet, pour le prix ponctuel.

### 7.4 Ventes

Ventes en cours avec **compte à rebours d'expiration** sur 14 jours, en alerte sous 48 h — un objet qui repart en banque, c'est 2 % de taxe payés pour rien. Actions « vendu » / « retourné ».

Deux indicateurs en tête : kamas engagés en HDV, profit réellement réalisé (calculé sur `frozenCraftCost`).

### 7.5 Réglages

Niveaux de métiers, seuils de fraîcheur, **export / import JSON**, version du catalogue et mise à jour, correction du métier des types ambigus (§3.2).

L'export n'est pas un confort : les relevés de prix représentent l'investissement du joueur dans l'outil et doivent être récupérables.

---

## 8. Architecture

```
src/
  catalog/    données du jeu, générées au build, lecture seule
  domain/     calculs purs, zéro I/O, testés en TDD
  store/      Dexie / IndexedDB, derrière des interfaces Repository
  ui/         écrans React
scripts/
  build-catalog.ts   normalise les JSON dofapi en catalogue compact
```

**La règle qui tient l'ensemble : `domain/` ne connaît ni React ni Dexie.** `profitability(recipe, priceBook) → CraftMargin` est une fonction pure. C'est ce qui la rend testable sans navigateur, et ce qui permettra de brancher un backend de partage de prix en ne touchant qu'à `store/`.

### Stack

Vite, React, TypeScript, Tailwind, Dexie pour IndexedDB, `vite-plugin-pwa` pour le service worker et l'installation sur l'écran d'accueil. Hébergement statique. Aucun backend, aucun compte.

### Génération du catalogue

`scripts/build-catalog.ts` s'exécute au build et produit un catalogue compact :

1. lecture des quatre JSON `data/dofus-touch/`
2. aplatissement des structures `stats` et `recipe` (tableaux d'objets à clé unique → tableaux typés)
3. résolution du métier via la table type → métier
4. suppression des champs inutiles à l'exécution (descriptions, URLs d'encyclopédie)
5. émission d'un asset versionné, chargé une fois puis conservé en IndexedDB

Le catalogue est versionné ; un changement de version déclenche un rechargement **sans toucher aux prix ni aux ventes de l'utilisateur**.

### Images

Les 6 319 icônes sont hébergées sur le CDN Ankama. Les embarquer alourdirait fortement le bundle. Le service worker les met en cache **à la consultation** : les objets habituels deviennent disponibles hors-ligne après un premier passage, un objet jamais ouvert affiche un placeholder si le réseau est absent.

Le texte et l'intégralité des calculs fonctionnent hors-ligne sans condition.

---

## 9. Tests

TDD sur `domain/` avec Vitest :

- prix unitaire à partir de lots mixtes (1, 10, 100)
- coût de craft, y compris ingrédients à prix manquant
- taxe à 2 %
- marge nette et pourcentage
- niveaux de fraîcheur et propagation de la confiance au craft
- scoring de priorité du relevé guidé
- expiration d'une vente à 14 jours
- estimation de brisage

L'interface est vérifiée manuellement sur appareil mobile réel.

---

## 10. Risques

| Risque | Portée | Traitement |
|---|---|---|
| Le dataset Touch est figé à une date inconnue et peut être en retard sur le jeu | Recettes légèrement obsolètes | Mode de correction manuelle des recettes ; l'encyclopédie officielle reste la source de vérité |
| Couverture des recettes à 35 % | Certains crafts absents | Cohérent avec le jeu (butin de donjon) ; ajout manuel possible |
| `Sac à dos`, `Pioche`, `Outil` sans métier fiable | 3 types, faible volume | Badge « métier inconnu », correction depuis les réglages |
| Table de poids des statistiques absente de toutes les sources identifiées | Module brisage uniquement | Construite à partir des tables communautaires, vérifiée par recoupement, corrigeable depuis les réglages. Le reste de l'application n'en dépend pas. |
| La saisie manuelle des prix est abandonnée par lassitude | Le produit devient inutile | C'est le pari central du design : le mode guidé priorisé et l'écran de récap existent pour rendre l'effort visiblement rentable |

---

## 11. Suites envisagées

- **v2 — Forgemagie** : poids de runes, puits invisible, coût estimé d'un jet cible. Les jets min/max sont déjà dans le catalogue.
- **v2 — Tendances de prix** : l'historique est déjà stocké, il ne reste qu'à l'afficher.
- **v3 — Partage de prix entre joueurs d'un même serveur** : la couche `store/` est isolée pour permettre cette greffe sans réécriture.
