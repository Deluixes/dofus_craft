# Registre de négoce — conception

**Date** : 2026-09-10
**Branche** : `feat/registre-negoce`

## Le besoin

Noter chaque opération de commerce Dofus Touch : l'objet, son prix d'achat ou
son coût de craft, son prix de revente. Cocher quand c'est vendu. Voir
automatiquement les kamas investis, les kamas récupérés et le bénéfice, taxe
d'hôtel des ventes de 3 % comprise — y compris quand un objet est remis en vente
sans avoir été vendu, cas où la taxe est perdue. Plus un suivi de l'évolution
dans le temps, et la possibilité de supprimer une ligne saisie par erreur.

## Pourquoi dans Krosmarge, et pourquoi dans l'onglet Ventes

L'onglet Ventes faisait déjà, pour les objets craftés, l'essentiel de ce qui est
demandé : capital « Engagé en HDV », « Profit réalisé », boutons *Vendu* /
*Retourné*, coût figé à la mise en vente, taxe perdue sur les retours.

Un onglet séparé aurait produit **deux écrans concurrents** pour noter une mise
en HDV, deux totaux de profit qui ne s'additionnent pas, et deux tables à
sauvegarder. L'onglet existant est donc élargi ; son identifiant reste `sales`
et seul son libellé devient « Négoce ».

Ce qui lui manquait, et qui a défini le travail : l'origine *achat*, les remises
en vente successives, les ventes partielles, les vues temporelles, la
suppression d'une ligne, le type de l'objet, et le bon taux de taxe.

## Les décisions, et ce qui les a tranchées

### Historique des mises en vente, pas un compteur

Une ligne porte `listings: Movement[]`, une entrée par passage en HDV.

L'argument décisif n'est pas la fidélité mais **les vues demandées** : le bilan
par période et la courbe cumulée doivent savoir *dans quelle semaine* chaque taxe
a été payée. Un compteur n'a pas de dates, et l'imputer à la date d'achat ou de
vente serait faux dans les deux cas. Argument secondaire : on baisse en général
le prix à chaque relance, donc compteur × prix courant réécrirait l'histoire.

L'interface reste à un bouton, pré-rempli au dernier prix et à la quantité
restante — même nombre de gestes, une ligne datée au lieu d'un entier.

### Ventes sous forme d'historique aussi

`sales: Movement[]`, du même type que les mises en vente. Le coût en complexité
est nul et le gain décisif : en HDV les lots partent par 1 / 10 / 100, donc
« 60 le 8, 20 le 12 » est le cas normal, souvent à deux prix différents. Un
champ `quantiteVendue` unique ne pourrait ni le dater ni le valoriser.

`quantiteVendue` est **dérivée**, jamais stockée.

### Un seul état persisté

`withdrawnAt` est le seul champ d'état, parce qu'il ne se déduit d'aucun autre.
Les cinq statuts se calculent par ordre de priorité strict : vendu → retiré →
partiellement vendu → en vente → en stock. Une mise en vente postérieure au
retrait le périme d'elle-même, il n'y a donc jamais de retrait à annuler.

**Retiré n'est pas vendu** : un objet en banque immobilise toujours ses kamas.
Le capital immobilisé inclut les lignes retirées ; l'écran les garde sous
« En stock » et non dans l'historique.

### Les taxes sont une charge de période

Deux options existaient : imputer la taxe à la date de son paiement, ou la
répartir au prorata des unités vendues.

**Charge de période**, pour trois raisons. La taxe est irrécouvrable dès son
paiement, sans contrepartie d'actif — la capitaliser gonflerait la valeur du
stock avec de l'argent perdu. Le prorata ferait dépendre le bilan d'une semaine
passée de ventes futures, donc changerait rétroactivement des chiffres déjà
consultés. Et c'est la seule option qui rende les agrégats **additifs** :
`Σ bilans par période = bilan global`.

Conséquence assumée, affichée dans l'application : une ligne remise en vente
plusieurs fois et pas encore vendue montre un bénéfice réalisé négatif. C'est
exact.

### Le coût du stock invendu n'est pas une perte

`costOfSold` porte sur la quantité **vendue**, pas sur la quantité acquise.
Acheter cent unités et en vendre dix ne fait pas apparaître quatre-vingt-dix
unités de perte : le coût des quatre-vingt-dix restantes est du **capital
immobilisé**, valorisé au coût et jamais au prix espéré.

Identité de contrôle, vérifiée sur deux cents portefeuilles générés :

```
beneficeRealise − capitalImmobilise ≡ recupere − investi − taxes
```

Si elle casse, un coût est compté deux fois ou oublié.

### Le chiffre de tête est le bénéfice réalisé

Pas la trésorerie nette, pourtant plus juste comptablement : elle plonge
mécaniquement dès qu'on réapprovisionne, donc elle mesure où l'on en est dans
son cycle d'achat, pas sa performance. Un joueur qui vient d'investir cinq
millions dans du stock rentable verrait −5 M en gros caractères. Elle a sa place
sur l'écran Bilan, en courbe de trésorerie.

Le trio *réalisé (en gros) / immobilisé / latent* raconte l'histoire complète, et
se relie à la trésorerie par l'identité ci-dessus.

Le ROI se rapporte au capital **consommé** par les opérations closes, non aux
kamas investis : ces derniers incluent le stock détenu, donc réapprovisionner
ferait chuter le ROI sans qu'aucune opération ait mal tourné.

### Taxe : trente pour mille entiers, arrondie à la feuille

Le taux est un entier en pour mille (`30`) et non `0.03`, qui n'est pas
représentable exactement en binaire : `0.03 × 333 333` vaut `9999.999999999998`,
et un plancher renverrait 9999 au lieu de 10 000.

L'arrondi est appliqué **une fois, sur le montant total du lot**. L'arrondir par
unité puis multiplier amplifierait l'erreur par la quantité — jusqu'à un kama
par unité, à chaque mise en vente. Devise : **arrondir à la feuille, sommer des
entiers**.

Le plancher plutôt que l'arrondi au plus proche : un plancher ne peut jamais
inventer une charge qui n'a pas été payée. Le choix est centralisé dans
`listingTax`, donc révisable en une ligne.

### Dates : jour civil local

Les instants restent des `number` (epoch ms), par cohérence avec `listedAt` et
`observedAt` existants. Mais toute date métier est enregistrée à **minuit local
du jour saisi** (`ui/clock.ts`), et `ledger.dayKey` relit ce même jour local :
l'aller-retour saisie → regroupement est stable par construction.

Un stockage en UTC ferait basculer une vente du dimanche soir au lundi selon le
fuseau, et un bilan hebdomadaire qui change quand on voyage est un bug qu'on ne
comprend jamais. Le calcul de semaine ISO est ré-ancré à midi UTC pour résister
aux journées de 23 ou 25 heures des changements d'heure.

Aucun cumul n'est persisté : tout est recalculé à l'affichage, sinon une
correction rétroactive laisserait des totaux périmés.

### Coût de craft : saisi, jamais imposé

Le champ « coût de revient » est toujours modifiable à la main. Quand l'objet a
une recette, ses ingrédients sont affichés avec leur prix unitaire relevé, et
leur somme peut être reportée d'un bouton — mais un prix manquant n'empêche
jamais d'enregistrer une opération. Les prix ne sont pas connaissables par
l'application, seulement par le joueur.

Saisir un prix d'ingrédient ici l'écrit aussi dans le carnet de prix, donc
bénéficie au classement des crafts.

### Deux versions Dexie pour une migration

`version(2)` ajoute `trades` et convertit les anciennes ventes ; `version(3)`
supprime `sales`. Deux versions et non une, parce que **Dexie applique le schéma
avant d'exécuter `upgrade`** : déclarer `sales: null` dans la même version
effacerait les données avant qu'on puisse les lire.

La règle de conversion est unique, partagée par la migration et par l'import
d'une sauvegarde v1 : deux implémentations divergeraient, et l'écart ne se
verrait que sur des chiffres d'argent.

### Graphiques en SVG écrit à la main

Recharts pèse une centaine de kilo-octets compressés — plus lourd que React
lui-même — pour deux graphiques, et il faudrait de toute façon le réaccorder au
thème sombre. La seule partie non triviale, les échelles et les graduations
rondes, fait quarante lignes et est testée ; le rendu se vérifie à l'œil.

Le signe du bénéfice est porté par la **position** autour de la ligne de zéro
autant que par la teinte, si bien que les barres restent lisibles sans percevoir
les couleurs. Les deux teintes sont celles du thème, verrouillées par
`tests/palette.test.ts`.

## Hors périmètre, explicitement

- Décomposition automatique d'une recette sans prix saisis : impossible, les
  prix ne sont pas connaissables par l'application.
- Synchronisation cloud, compte utilisateur : usage solo.
- Fusion de sauvegardes : remplacement avec confirmation. Les identifiants
  laissent la porte ouverte si le besoin apparaît.
- FIFO, coût moyen pondéré, gestion de stock globale par objet : chaque achat
  est sa propre ligne, avec son propre coût.
- Multi-personnage, multi-serveur.

## Déviations par rapport au plan initial

Deux, toutes deux assumées.

Le plan prévoyait un test « mêmes bilans sous `TZ=UTC` et sous
`TZ=Pacific/Kiritimati` ». Il était **incohérent** avec un regroupement par jour
local, qui est le comportement voulu. Remplacé par les invariants qui comptent
réellement : stabilité de l'aller-retour saisie/regroupement, et passage à
l'heure d'été.

Le plan annonçait environ 6 554 objets au catalogue. Le chiffre réel est
**6 519** : la déduplication se fait sur l'identifiant, plus stricte que sur le
couple nom + type.
