# Krosmarge

Classement des crafts **Dofus Touch** par marge nette réelle, hors-ligne d'abord.

## À qui ça sert

À un joueur artisan qui veut savoir, avant de lancer un craft, ce qu'il lui
rapportera vraiment — coût des ingrédients aux prix qu'il a lui-même relevés,
taxe de 2 % de l'hôtel des ventes déduite, et comparaison avec la valeur de
brisage.

Dofus Touch n'expose aucune API de prix. Les prix sont donc **saisis à la
main**, à l'hôtel des ventes, souvent d'une seule main et le soir. Toute
l'application est construite autour de ce geste : le catalogue des 6 319 objets
et 2 219 recettes est pré-chargé une fois pour toutes, si bien qu'il ne reste
jamais que des prix à taper.

### Le principe directeur : l'application ne ment jamais

Une marge calculée sur un prix manquant ou périmé afficherait « +18 % » avec
aplomb et ferait crafter à perte. D'où trois règles qui traversent tout le code :

- un prix manquant ne vaut jamais zéro ni une estimation — le craft sort du
  classement et part dans « il manque des prix » ;
- tout chiffre affiché porte un **indice de fraîcheur** (frais, acceptable,
  périmé, manquant), et un craft n'est jamais plus fiable que sa donnée la plus
  faible ;
- un profit réalisé se calcule sur le coût **figé à la mise en vente**, jamais
  sur les prix du jour.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement Vite. Suppose que le catalogue a déjà été généré. |
| `npm run build:catalog` | Régénère `public/catalog.v1.json` depuis `data/dofus-touch/`. |
| `npm run build` | Catalogue, puis vérification de types, puis build de production. |
| `npm run preview` | Sert le `dist/` produit par `npm run build`. |
| `npm test` | Suite Vitest complète. |
| `npm run lint` | Oxlint. |

Sur un clone frais : `npm ci && npm run build`. Le catalogue est régénéré par le
build lui-même — il n'y a pas d'étape manuelle préalable.

## Données du jeu

`data/dofus-touch/*.json` (≈ 6,5 Mo, quatre fichiers) contient le dump brut des
objets Dofus Touch : équipements, armes, ressources et consommables.

Ces fichiers sont **committés volontairement**. Ils proviennent de
[`dofapi/crawlit-dofus-encyclopedia-parser`](https://github.com/dofapi/crawlit-dofus-encyclopedia-parser)
(branche `master`, répertoire `data/dofus-touch`), une source communautaire qui
peut disparaître ou changer de forme sans préavis. Les versionner est le seul
moyen de garantir qu'un build reste reproductible dans un an.

`public/catalog.v1.json` (≈ 2,2 Mo) est en revanche un **artefact régénéré**, et
il est gitignoré : c'est la sortie de `npm run build:catalog`, pas une source.
Le script s'arrête en erreur si le catalogue produit descend sous 5 000 objets
ou 1 500 recettes, pour qu'un fichier source tronqué ne livre jamais un
catalogue amputé en silence.

## Architecture

Quatre couches, avec une **règle de dépendance stricte** : chacune ne connaît
que celles qui la précèdent, jamais l'inverse.

```
catalog/  →  domain/  →  store/  →  ui/
```

| Couche | Rôle | Contraintes |
| --- | --- | --- |
| `src/catalog/` | Données de jeu figées au build : types, normalisation des structures brutes, index runtime (`itemsById`, `recipeByResultId`, `recipesByIngredientId`). | Aucune dépendance applicative. |
| `src/domain/` | Tout le calcul : coût de craft, marge nette, taxe HDV, fraîcheur, classement, valeur de brisage, priorité de relevé, cycle de vie des ventes. | **Fonctions pures.** N'importe ni React, ni Dexie, ni aucune API navigateur, et **n'appelle jamais `Date.now()`** — l'instant courant est toujours un paramètre, ce qui rend chaque règle testable sans geler le temps. |
| `src/store/` | Persistance IndexedDB (Dexie) derrière des repositories, plus l'export/import de sauvegarde. | Ne contient aucune règle métier. |
| `src/ui/` | Cinq écrans React : Crafts, Détail d'un craft, Prix, Ventes, Réglages. | C'est **ici et nulle part ailleurs** que l'horloge est lue. Aucune couleur codée en dur : tout passe par les tokens de `src/ui/theme.css`. Interface en français. |

`scripts/build-catalog.ts` est hors de ces quatre couches : il tourne sous Node
au moment du build et ne fait qu'appeler `src/catalog/normalize.ts`.

## Hors-ligne

L'application est une PWA (`vite-plugin-pwa`, `registerType: 'autoUpdate'`). Le
catalogue et le bundle sont précachés ; les icônes d'objets du CDN Ankama sont
mises en cache à la consultation. Aucune police distante, aucun appel réseau au
runtime en dehors de ces deux-là — elle doit fonctionner en avion.
