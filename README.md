# Krosmarge

Rentabilité **Dofus Touch** : classement des crafts par marge nette réelle, et
registre des achats/reventes à l'hôtel des ventes. Hors-ligne d'abord.

## À qui ça sert

À un joueur artisan ou marchand qui veut savoir deux choses.

**Avant de lancer un craft**, ce qu'il rapportera vraiment : coût des
ingrédients aux prix qu'il a lui-même relevés, taxe de 3 % de l'hôtel des ventes
déduite, et comparaison avec la valeur de brisage.

**Après coup**, si son commerce gagne de l'argent. Chaque objet acheté ou crafté
est noté avec son coût, ses passages en HDV et ses ventes ; l'application en
tire les kamas investis, les kamas récupérés, les taxes payées, le bénéfice
réalisé, et l'évolution de tout cela dans le temps.

Dofus Touch n'expose aucune API de prix. Les prix sont donc **saisis à la
main**, à l'hôtel des ventes, souvent d'une seule main et le soir. Toute
l'application est construite autour de ce geste : le catalogue des 6 519 objets
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

Le registre de négoce ajoute deux règles de la même famille :

- le coût des unités **encore en stock** n'est jamais compté en perte. Acheter
  cent unités et en vendre dix ne fait pas apparaître quatre-vingt-dix unités de
  perte : c'est du capital immobilisé, et il s'affiche comme tel ;
- la taxe est une **charge de la période où elle a été payée**, jamais
  capitalisée dans le stock. C'est pourquoi un objet remis en vente sans être
  vendu affiche un bénéfice négatif — c'est exact, ces kamas sont partis.

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

`data/dofus-touch/*.json` (≈ 6,9 Mo, six fichiers) contient le dump brut des
objets Dofus Touch : équipements, armes, ressources, consommables, familiers et
montures.

Les familiers et les montures ont été ajoutés au registre de négoce — les
dragodindes se commercent beaucoup. Effet de bord notable : ils étaient
référencés comme ingrédients par des recettes sans figurer au catalogue, si bien
que leur ajout a fait tomber les ingrédients orphelins de 147 à 10, et rendu
calculables environ 150 recettes qui ne l'étaient pas.

Ces fichiers sont **committés volontairement**. Ils proviennent de
[`dofapi/crawlit-dofus-encyclopedia-parser`](https://github.com/dofapi/crawlit-dofus-encyclopedia-parser)
(branche `master`, répertoire `data/dofus-touch`), une source communautaire qui
peut disparaître ou changer de forme sans préavis. Les versionner est le seul
moyen de garantir qu'un build reste reproductible dans un an.

`public/catalog.v1.json` (≈ 2,2 Mo) est en revanche un **artefact régénéré**, et
il est gitignoré : c'est la sortie de `npm run build:catalog`, pas une source.
Le script s'arrête en erreur si le catalogue produit descend sous 6 000 objets
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
| `src/domain/` | Tout le calcul : coût de craft, marge nette, taxe HDV, fraîcheur, classement, valeur de brisage, priorité de relevé, registre de négoce et ses vues temporelles. | **Fonctions pures.** N'importe ni React, ni Dexie, ni aucune API navigateur, et **n'appelle jamais `Date.now()` ni `crypto.randomUUID()`** — l'instant courant et les identifiants sont toujours des paramètres, ce qui rend chaque règle testable sans geler le temps. |
| `src/store/` | Persistance IndexedDB (Dexie) derrière des repositories, migrations de schéma, plus l'export/import de sauvegarde. | Ne contient aucune règle métier. |
| `src/ui/` | Sept écrans React : Crafts, Détail d'un craft, Prix, Négoce, Détail d'une opération, Bilan, Réglages. | C'est **ici et nulle part ailleurs** que l'horloge est lue et que les identifiants sont engendrés. Aucune couleur codée en dur : tout passe par les tokens de `src/ui/theme.css`. Interface en français. |

`scripts/build-catalog.ts` est hors de ces quatre couches : il tourne sous Node
au moment du build et ne fait qu'appeler `src/catalog/normalize.ts`.

## Hors-ligne

L'application est une PWA (`vite-plugin-pwa`, `registerType: 'autoUpdate'`). Le
catalogue et le bundle sont précachés ; les icônes d'objets du CDN Ankama sont
mises en cache à la consultation. Aucune police distante, aucun appel réseau au
runtime en dehors de ces deux-là — elle doit fonctionner en avion.

## Déploiement

Un push sur `main` déclenche `.github/workflows/deploiement.yml` : tests, build,
publication sur GitHub Pages. Le site est servi sous
**<https://deluixes.github.io/dofus_craft/>**.

À faire **une seule fois**, dans l'interface GitHub :
**Settings → Pages → Build and deployment → Source : « GitHub Actions »**
(et non « Deploy from a branch »). Sans ce réglage, le job de publication échoue
avec une erreur d'environnement peu parlante.

Puis, sur le téléphone : ouvrir l'URL dans Chrome, menu → « Installer
l'application ». Vérifier ensuite en **mode avion** que l'application démarre et
que le catalogue répond.

### Le sous-chemin, source d'erreur numéro un

Le site n'est pas servi à la racine du domaine mais sous `/dofus_craft/`. Quatre
endroits doivent le savoir, et `vite.config.ts` les dérive tous de la constante
`BASE` :

- `base` de Vite, barre au début **et** à la fin ;
- `id`, `start_url` et `scope` du manifeste — sans eux, l'application installée
  ouvrirait la racine du domaine, c'est-à-dire la page 404 de GitHub ;
- `workbox.navigateFallback` ;
- toute URL construite à la main dans le code, d'où
  `` CATALOG_URL = `${import.meta.env.BASE_URL}catalog.v1.json` `` — un chemin
  absolu écrit en dur marcherait en développement et donnerait un 404 en
  production.

Les `src` d'icônes du manifeste sont au contraire **relatifs** : ils sont
résolus contre l'URL du manifeste. Un « / » initial les rendrait introuvables et
Android refuserait l'installation **en silence**.

Le nom du dépôt est donc devenu une constante d'infrastructure : le renommer
changerait le `scope`, et le téléphone verrait une autre application.

⚠️ GitHub Pages sert ses fichiers avec `Cache-Control: max-age=600`. Une mise à
jour peut donc mettre jusqu'à dix minutes à être vue après un push. Ce n'est pas
une panne, et il n'y a pas moyen de raccourcir ce délai sans en-têtes
personnalisés, impossibles sur Pages.
