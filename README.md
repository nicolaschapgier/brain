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

## Navigation

- **Glisser** : tourner autour du cerveau · **Molette** : avancer / reculer vers le curseur · **Clic droit** : se déplacer
- **ZQSD / WASD ou flèches** : voler · **Espace / Maj** : monter / descendre
- **Dans le cerveau**, la vue passe en première personne : glisser fait pivoter la caméra sur place, la molette avance / recule dans la direction du regard, et la rotation automatique se coupe. En ressortant, on retrouve la rotation autour du cerveau.
- **Clic sur un neurone** : la caméra vole jusqu'à lui et la carte s'ouvre (flèches pour passer au souvenir suivant)
- Barre en haut à droite : liste des souvenirs, entrer dans le cerveau, vue d'ensemble, rotation automatique

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
  ui/memory-card/  carte du souvenir (Angular Material)
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
