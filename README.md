# Brain

Application de souvenirs entre amis : on se déplace dans un cerveau 3D flottant dans l'espace, et chaque neurone lumineux ouvre une carte (image, titre, description).

Angular 22 · THREE.JS · Angular Material (thème sombre violet/cyan).

## Lancer

```bash
npm install
npm start          # http://localhost:4200
npm test           # tests unitaires (Vitest)
npm run build      # build de production dans dist/brain
```

## Ajouter des souvenirs

Tout est dans [`public/data/memories.json`](public/data/memories.json), un tableau d'objets. Le rechargement de la page suffit.

```json
{
  "id": "ski-2023",
  "title": "Week-end au ski",
  "description": "Trois jours à la montagne…",
  "image": "memories/ski.svg",
  "date": "2023-02-11",
  "position": [0.7, 0.3, 0.5]
}
```

| Champ         | Obligatoire | Rôle |
| ------------- | ----------- | ---- |
| `title`       | oui         | Titre de la carte. Une entrée sans titre est ignorée (warning en console). |
| `description` | non         | Texte de la carte. |
| `image`       | non         | Chemin relatif à `public/` (ex. `memories/ski.jpg`) ou URL complète. |
| `date`        | non         | Texte libre affiché sous le titre (`2023-02-11`, `Été 2022`…). |
| `id`          | non         | Identifiant unique. Généré (`memory-N`) s'il manque ou est en double. |
| `position`    | non         | `[x, y, z]` entre -1 et 1 : x gauche(-)/droite(+), y bas(-)/haut(+), z arrière(-)/avant(+). Sans ce champ, le neurone est placé automatiquement. |

Dépose tes photos dans `public/memories/`.

Le placement automatique est déterministe (un souvenir garde sa place d'un chargement à l'autre) et espace les neurones. Ajouter un souvenir **à la fin** de la liste ne déplace pas les précédents.

## Souvenirs découverts

Un souvenir est **inconnu** tant que tu n'as pas gratté sa carte. En cliquant sur son neurone, la carte s'ouvre recouverte d'une pellicule argentée aux fleurs de lys, façon jeu à gratter : gratte-la à la souris ou au doigt. Passé la moitié, le reste disparaît tout seul et le souvenir se dévoile. Il n'existe volontairement aucun moyen de tout révéler d'un clic, et la pellicule ne se gratte qu'à la souris ou au doigt. Fermer la carte sans avoir gratté laisse le souvenir inconnu.

Tant qu'il est inconnu :

- il n'apparaît pas dans l'album, où sa place reste un emplacement vide (le compteur, par exemple « 3 / 8 souvenirs collés », se lit en haut de l'album) ;
- son titre reste secret : au survol de son neurone, l'infobulle indique « Souvenir à découvrir ».

Une fois gratté, un souvenir est **connu pour toujours** : il est retenu dans le `localStorage` du navigateur (clé `brain.discovered`, liste des identifiants). La progression est donc propre à chaque navigateur, et se perd si on vide les données du site. Pour la remettre à zéro, dans la console du navigateur : `localStorage.removeItem('brain.discovered')`.

> Donne un `id` explicite à chaque souvenir dans `memories.json` : sans `id`, il est généré à partir de la position dans la liste (`memory-3`…), et déplacer un souvenir ferait perdre sa progression.

Réglages de la pellicule (`src/app/ui/scratch-cover/scratch-cover.ts`) : `REVEAL_THRESHOLD` (part à gratter, 0.5 par défaut) et `BRUSH_RADIUS` (taille du grattage).

## L'album

Le bouton en forme de livre (barre en haut à droite) ouvre l'**album des souvenirs**, un album d'autocollants à feuilleter : couverture, page d'accueil avec la jauge de collection, puis les souvenirs par quatre (2 × 2), dans l'ordre du JSON, avec le même numéro que sur leur carte.

- **Souvenir découvert** : son autocollant est collé sur la page (photo, titre, date). Un clic dessus l'affiche en grand dans une **modale**, par-dessus la page de l'album (image entière, titre, date et description) ; elle se ferme avec la croix, un clic à côté ou Échap, et l'album reste ouvert derrière.
- **Souvenir inconnu** : un emplacement vide pointillé, avec son seul numéro et « À découvrir ». Rien n'est révélé (ni titre, ni image) avant le grattage.
- **Tourner les pages** : boutons en bas, flèches ← → du clavier ; Échap ou la croix pour fermer. Sur grand écran le livre s'ouvre en double page (la couverture et le dos se centrent quand il est fermé) ; sur téléphone, une page à la fois. Avec « réduire les animations » activé dans le système, les pages changent sans s'animer.
- **Couvertures rétro années 2000** : bandes du maillot avec reflet vitré, arcs blancs et trame de points, titre « ALBUM » chromé, pastille « gel » rouge, badge étoilé pour le compteur, étincelles qui scintillent et bandeau holographique « Édition Club des Cerveaux ». Les textes sont dans `album-page.html`, le style dans `album-cover.scss`.
- **Thème** : le bleu et le rouge de la Berrichonne (rayures verticales du maillot) sur du papier blanc, avec des foils argentés, et les logos des annonceurs au pied des pages, en clin d'œil aux panneaux publicitaires de la pelouse du stade Gaston-Petit.
- Le livre s'agrandit tout seul : il y a autant de pages que nécessaire (4 souvenirs par page), et une page « À suivre… » comble le dernier verso si besoin.

Les annonceurs sont dans [`src/app/album/album-sponsors.ts`](src/app/album/album-sponsors.ts) : Pitch, Fenioux, Le Seyec, La Halle aux vêtements, RTL et le Conseil général de l'Indre. Pitch et Fenioux viennent de tes souvenirs ; les autres sont cités dans la section « Sponsors et équipementiers » de la page Wikipédia de la Berrichonne. Chacun s'affiche par son **logo, posé directement sur la page, sans cadre** (les fonds blancs des images se fondent dans le papier). Les logos sont dans `public/sponsors/` ; ceux de Fenioux, de La Halle et du Seyec sont des SVG refaits à la main (version simplifiée, en polices standard). Pour ajouter un annonceur, ajoute une ligne à la liste : avec `logo: 'sponsors/mon-logo.png'` il s'affiche par son logo, sans logo (ou si l'image ne se charge pas) par son nom en lettres. Sur la quatrième de couverture, les logos sont posés sur un bandeau blanc pleine largeur, pour rester lisibles sur les rayures. Chaque page en montre trois, en tournant dans la liste. Les couleurs viennent de `berry-theme.scss`, la mise en page des pages de `album-page.scss` (couvertures dans `album-cover.scss`) ; le nombre de souvenirs par page est `SLOTS_PER_PAGE` dans `album-book.ts`.

## Navigation

- **Glisser** : tourner autour du cerveau · **Molette** : avancer / reculer vers le curseur · **Clic droit** : se déplacer
- **ZQSD / WASD ou flèches** : voler · **Espace / Maj** : monter / descendre
- **Dans le cerveau**, la vue passe en première personne : glisser fait pivoter la caméra sur place, la molette avance / recule dans la direction du regard, à la même vitesse dans les deux sens, et la rotation automatique se coupe. En ressortant, on retrouve la rotation autour du cerveau.
- **Clic sur un neurone** : la caméra vole jusqu'à lui et la carte s'ouvre. Elle se ferme avec la croix en haut à droite ou la touche Échap
- Barre en haut à droite : album, vue d'ensemble, rotation automatique. On entre dans le cerveau en avançant à la molette ou au clavier

## Structure

```
src/app/
  core/            modèle Memory, parsing du JSON, store (signals) + chargement HTTP
  brain/
    brain-geometry.ts   cerveau procédural (cortex, cervelet, tronc) — bon point de départ pour apprendre THREE.JS
    brain-model.ts      matériaux, transparence, éclairage intérieur
    neuron-field.ts     neurones, dendrites, synapses animées, étincelles, picking
    neuron-placement.ts placement automatique des neurones
    space-backdrop.ts   nébuleuse et étoiles (shaders GLSL)
    brain-scene.ts      renderer, caméra, contrôles, vol vers un neurone, post-traitement (bloom)
    brain-viewer/       composant Angular qui héberge le canvas
  album/           album d'autocollants : pagination pure (album-book), pages, livre et annonceurs
  ui/memory-card/  carte du souvenir (Angular Material)
  ui/scratch-cover/ pellicule à gratter des cartes inconnues
```

`brain-scene.ts` et ses voisins sont du TypeScript pur, sans Angular : le composant `BrainViewer` crée la scène, lui passe les souvenirs et relaie la sélection au store.

## À savoir

- **Le cerveau est une interprétation.** Il est généré en code à partir de l'image de référence (rose, contours sombres dans les sillons), pas copié dessus. Pour un rendu plus réaliste, il faudrait un modèle 3D téléchargé (voir les pistes plus bas).
- **Poids de l'application.** three.js pèse environ 700 Ko à lui seul (environ 225 Ko une fois compressé). Les budgets de taille de `angular.json` ont été relevés (avertissement à 1,2 Mo, erreur à 1,6 Mo), sinon le build de production échoue avec les valeurs par défaut d'Angular.
- **Pour apprendre THREE.JS ici**, lire dans cet ordre : `brain-geometry.ts` (comment on sculpte le cerveau), puis `brain-scene.ts` (caméra, contrôles, interactions).

## Réglages rapides

| Ce que tu veux changer | Où |
| --- | --- |
| Taille du cerveau (donc la place à l'intérieur) | `BRAIN_SCALE` dans `brain-geometry.ts` |
| Taille des neurones, de leur halo et de leurs dendrites | `CORE_RADIUS`, `HALO_SIZE`, `DENDRITE_SIZE` dans `neuron-field.ts` |
| Nombre de particules blanches dans le cerveau | `DUST_COUNT` dans `neuron-field.ts` |
| Éclat des neurones (même luminosité pour toutes les couleurs) et leur palette | `NEURON_LUMINANCE` et `PALETTE` dans `neuron-field.ts` |
| Vitesse de déplacement au clavier / à la molette | `MOVE_SPEED`, `WHEEL_STEP` dans `brain-scene.ts` |

## Thème Berry et cartes « autocollant »

Les cartes de souvenir reprennent les couleurs du blason du Berry (azur, or, rouge) avec un style d'autocollant de football des années 2000 : cadre blanc, coins coupés dorés, bandeau de nom incliné, numérotation `N° 3/8`, médaillon à fleur de lys et reflet holographique qui suit la souris.

- Les couleurs sont dans [`src/app/ui/berry-theme.scss`](src/app/ui/berry-theme.scss) (une seule palette à modifier).
- Le style de la carte est dans `src/app/ui/memory-card/`.
- La date est mise en forme automatiquement si elle est au format `2023-02-11` ; tout autre texte est affiché tel quel.
- Le pied de carte (« Édition Berry · Châteauroux ») est dans `memory-card.html`.

## Pistes pour la suite

- Formulaire d'ajout de souvenir (écrire dans le store, puis un backend ou le `localStorage`)
- Regrouper les neurones par catégorie / région du cerveau
- Remplacer le cerveau procédural par un modèle glTF (`GLTFLoader`) si tu veux plus de réalisme
