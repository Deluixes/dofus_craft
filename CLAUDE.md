# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Krosmarge — PWA hors-ligne de rentabilité **Dofus Touch** : classement des
crafts par marge nette et registre des achats/reventes à l'hôtel des ventes.
React 19 + TypeScript, Vite, Dexie (IndexedDB), Vitest.

**Le `README.md` est la référence de fond** : le « principe directeur »
(l'application ne ment jamais), le rôle de chaque couche, le format des données
de jeu et le piège du sous-chemin GitHub Pages y sont expliqués en détail. Le
lire avant de toucher au calcul de marge, au registre, ou au déploiement. Ce
fichier-ci ne retient que ce qui se casse en silence.

## Commandes

| Besoin | Commande |
| --- | --- |
| Développement | `npm run dev` (suppose le catalogue déjà généré) |
| Suite complète | `npm test` — 25 fichiers, 273 tests, ~15 s |
| Un seul fichier | `npm test -- src/domain/ledger.test.ts` |
| Un seul cas | `npm test -- -t "portefeuille"` |
| Vérification de types seule | `npx tsc -b` |
| Lint | `npm run lint` |
| Catalogue | `npm run build:catalog` → `public/catalog.v1.json` (gitignoré) |
| Build complet | `npm run build` = catalogue + `tsc -b` + Vite |

Clone frais : `npm ci && npm run build`. `npm run dev` seul échoue si le
catalogue n'a jamais été généré.

## Les invariants qui se cassent en silence

### La règle de dépendance : `catalog/` → `domain/` → `store/` → `ui/`

Chaque couche ne connaît que celles qui la précèdent. Une seule violation suffit
à rendre le domaine intestable.

- **`src/domain/` est fait de fonctions pures.** Il n'importe ni React, ni
  Dexie, ni aucune API navigateur, et **n'appelle jamais `Date.now()` ni
  `crypto.randomUUID()`** : l'instant courant et les identifiants sont toujours
  des paramètres. Ajouter un appel à l'horloge dans `domain/` compile, passe le
  lint, et oblige tous les tests suivants à geler le temps.
- **`src/ui/AppState.tsx` est le seul endroit** où l'horloge est lue et où les
  identifiants de mouvement sont engendrés. Les écrans passent l'instant en
  paramètre aux fonctions du domaine.
- **`src/store/` ne contient aucune règle métier**, seulement des repositories
  et des migrations.
- `scripts/build-catalog.ts` est hors des quatre couches : Node, au build.

### Aucune couleur en dur hors de `src/ui/theme.css`

Tout passe par les tokens `--k-*`. La séparation des huit couleurs sémantiques
est verrouillée par `tests/palette.test.ts`, qui relit `theme.css` comme du
texte et recalcule la matrice des 28 paires : **40° de teinte OU 40 points de
saturation**. Retuner un token sans relire l'en-tête de `theme.css` (qui motive
chaque valeur, notamment le magenta de `--k-expired`) fait échouer le test.

Corollaire du guide UX : une information n'est jamais portée par la seule
couleur — toujours doublée d'une icône ou d'un texte.

### Le style est du CSS BEM, pas des utilitaires Tailwind

Tailwind est présent (`@import "tailwindcss"` dans `src/index.css`) mais **aucun
JSX n'utilise ses classes utilitaires**. Les ~2 400 lignes de `src/ui/theme.css`
définissent des classes BEM par écran (`.crafts__banner`, `.detail__line`…), et
chaque écran style ses propres classes. Suivre cette convention plutôt que
d'introduire `flex gap-2 p-4` dans un composant.

### Une migration Dexie demande deux versions

Dexie applique le schéma **avant** d'exécuter `upgrade`. Supprimer une table dans
la même version que la migration qui la lit efface les données avant de pouvoir
les convertir. D'où le motif de `src/store/db.ts` : la v2 crée `trades` et
convertit `sales`, la v3 seulement supprime `sales`. Reproduire ce découpage
pour toute future migration.

### Le catalogue est un artefact, jamais une source

`public/catalog.v1.json` est gitignoré et régénéré par le build. Les sources
sont `data/dofus-touch/*.json`, committées volontairement (la source amont
communautaire peut disparaître). `build-catalog.ts` échoue sous 6 000 objets ou
1 500 recettes, pour qu'un fichier tronqué ne livre jamais un catalogue amputé.

### `BASE` dans `vite.config.ts`

Le site est servi sous `/dofus_craft/`, pas à la racine. La constante `BASE`
alimente `base`, le manifeste (`id`/`start_url`/`scope`) et
`workbox.navigateFallback` ; toute URL construite à la main doit passer par
`import.meta.env.BASE_URL`. Les `src` d'icônes du manifeste restent **relatifs**.
Détail des conséquences dans le README.

## Tests

- Tests co-localisés `*.test.ts(x)` dans `src/`, sous `tsconfig.app.json`.
- `tests/` est réservé aux tests qui **auditent un fichier source comme du
  texte** via `node:fs` : ils vivent sous `tsconfig.node.json`, seul projet à
  exposer les types Node. C'est ce cloisonnement qui empêche une couche métier
  d'importer un module Node par inadvertance — ne pas ajouter `"types": ["node"]`
  à `tsconfig.app.json` pour dépanner un test.
- `src/domain/scenario.test.ts` est le test d'intégration du registre : une
  opération complète dont **tous les montants ont été calculés à la main** avant
  d'être écrits. Toucher au modèle de négoce impose de le relire, pas seulement
  de le faire passer.
- Tests d'écran : harnais `vi.mock('../AppState')`, voir
  `PricesScreen.test.tsx` et `TradesScreen.test.tsx` (ce dernier fournit en plus
  un normaliseur pour l'espace fine insécable des montants). Cinq écrans sur
  sept n'ont encore aucun test — c'est la première dette du projet, et la revue
  a montré que les défauts s'y logent.
- IndexedDB en test : `fake-indexeddb`. Environnement `jsdom`, `globals: true`.

## Conventions

- **Interface, code, commentaires et documentation en français.** Les
  commentaires expliquent *pourquoi*, souvent longuement, et citent le constat
  qui a motivé la décision. Garder ce registre.
- **Messages de commit** : `type: sujet en français, sans accent dans le titre`
  (`feat:`, `fix:`, `test:`, `docs:`, `merge:`). Exemple récent :
  `fix: taxe HDV a 3 pourcent, en pour mille entiers`.
- `docs/dette-technique.md` recense les compromis assumés, datés et motivés.
  Le tenir à jour fait partie du travail : une lacune connue s'écrit, elle ne se
  tait pas.
- `.superpowers/` est un espace de travail non versionné ;
  `docs/superpowers/` contient les specs et plans, eux versionnés.

## Déploiement

Push sur `main` → `.github/workflows/deploiement.yml` : tests, build, GitHub
Pages. Un échec de type bloque le déploiement (le build enchaîne `tsc -b`).
Le site met jusqu'à dix minutes à refléter un push (`max-age=600` de Pages) —
ce n'est pas une panne.
