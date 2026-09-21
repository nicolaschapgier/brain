# Plan de formation : partager des photos avec Supabase

## Objectif

À la fin de ce plan, Le Club des Cerveaux permet à une dizaine d'amis, chacun avec son identifiant et son mot de passe, d'envoyer des photos que les autres retrouvent ensuite dans l'album. Tu auras tout construit toi-même, et tu sauras expliquer pourquoi c'est sécurisé.

Durée estimée : 10 à 14 heures au total, à répartir en une étape par soirée. Ce sont des ordres de grandeur, pas une promesse.

## Comment suivre ce plan

Fais les étapes dans l'ordre. Chacune suit le même déroulé : **Comprendre** (les notions à connaître), **Lire** (les pages de documentation), **Faire** (ce qu'il y a à construire dans le projet) et **Vérifier** (comment savoir que ça marche). Ne passe pas à l'étape suivante tant que la vérification n'est pas bonne : chaque étape s'appuie sur la précédente.

Tu connais Angular, donc l'essentiel de l'effort porte sur trois choses nouvelles : l'authentification, les règles d'accès (RLS) et le stockage de fichiers.

## Étape 0 — Se repérer (environ 30 minutes)

**Comprendre.** Supabase est un service qui te donne quatre choses avec un seul projet : une base de données Postgres, un système de connexion (Auth), un espace de stockage de fichiers (Storage), et un tableau de bord pour tout gérer. Ton appli Angular leur parle directement, sans serveur à écrire.

**Lire.** La page d'accueil de la documentation et la page Storage, pour voir les notions de « bucket » (un dossier racine de fichiers) et de « politique » (une règle d'accès).

**Faire.**
- Créer un compte et un projet gratuit sur supabase.com.
- Noter l'adresse du projet et la clé publique (Project Settings, section API). Ces deux valeurs peuvent aller dans le code de l'appli. La clé « service_role » ou « secret », elle, ne doit jamais y aller.
- Explorer le tableau de bord : Table Editor, Authentication, Storage, SQL Editor.

**Vérifier.** Tu sais dire à quoi sert chacun des quatre écrans.

## Étape 1 — Le tutoriel officiel, dans un projet à part (2 à 3 heures)

**Comprendre.** Avant de toucher au Cerveau, il faut voir une appli Supabase complète tourner. Le tutoriel officiel Angular construit une appli de gestion d'utilisateurs avec connexion, profil et photo de profil : c'est le même trio (Auth, base, Storage) que pour toi.

**Lire et faire.** Suis le tutoriel en entier dans un projet Angular jetable, pas dans `brain`. Deux différences à noter en le suivant : il connecte par lien magique envoyé par e-mail (tu utiliseras un mot de passe), et il n'utilise pas les composants standalone (ton projet, oui). Adapte au fur et à mesure et garde le projet jetable comme aide-mémoire.

**Vérifier.** Tu as envoyé une photo depuis l'appli du tutoriel et tu l'as vue apparaître dans Storage, dans le tableau de bord.

## Étape 2 — Une connexion réservée à tes amis (1 à 2 heures)

**Comprendre.** Supabase identifie un compte par une adresse e-mail (ou un téléphone), pas par un nom d'utilisateur. Deux façons de faire : de vraies adresses e-mail, ou des adresses fictives du type `prenom@ton-domaine`, avec l'appli qui complète le prénom saisi. Choisis avant de coder (voir « Décisions à prendre »).

**Lire.** La documentation sur la connexion par mot de passe, puis celle sur la désactivation des inscriptions publiques (liens en fin de document).

**Faire.**
- Dans les réglages d'Authentication, désactiver « Allow new users to sign up ».
- Créer un compte par ami depuis l'écran Users du tableau de bord (vérifie sur place comment ajouter un utilisateur avec un mot de passe déjà confirmé).
- Installer `@supabase/supabase-js` dans `brain`.
- Écrire un service Angular qui crée le client Supabase et expose la session dans un signal : `signInWithPassword`, `getSession`, `onAuthStateChange`, `signOut`. Le store `MemoryStore` du projet te donne le style attendu (signaux, `providedIn: 'root'`).
- Un formulaire de connexion dans une fenêtre Material, chargée à la demande comme le fait `openMemoryForm()` dans `app.ts`.

**Vérifier.** Un bon mot de passe te connecte, un mauvais affiche une erreur claire, et il est impossible de créer un compte depuis l'appli. Recharger la page te garde connecté.

## Étape 3 — Base de données et règles d'accès (1 à 2 heures)

**Comprendre.** Ton appli tourne dans le navigateur de tout le monde, donc n'importe qui peut lire son code et appeler Supabase à la main. La protection ne peut pas être dans l'appli : elle est dans la base, sous forme de règles appelées RLS (Row Level Security). Notions à maîtriser : `auth.uid()` (l'identité de la personne connectée), `to authenticated` (réservé aux connectés), `using` (qui peut voir ou toucher une ligne existante) et `with check` (ce qu'on a le droit d'écrire).

**Lire.** La page sur Row Level Security, puis celle sur le contrôle d'accès de Storage, qui contient des exemples de règles.

**Faire.** Dans le SQL Editor, écrire (et garder dans un fichier `supabase/setup.sql` versionné dans le projet) :
- une table `profiles` avec un rôle (`friend` ou `admin`) ;
- une table `photos` : auteur, chemin du fichier, légende facultative, date de prise de vue, dimensions ;
- l'activation de RLS sur ces tables, puis des règles : les connectés lisent, on n'ajoute une ligne qu'à son nom, seuls l'auteur et l'admin suppriment.

**Vérifier.** Depuis l'appli, une requête sans être connecté renvoie une liste vide ou une erreur, jamais des données.

## Étape 4 — Stockage privé et envoi de photos (2 à 3 heures)

**Comprendre.** Un bucket privé ne sert ses fichiers qu'aux personnes autorisées. Les règles se posent sur la table `storage.objects`. Une bonne habitude : ranger chaque photo dans un dossier au nom de son auteur (`<id de la personne>/<photo>.jpg`), pour que la règle soit simple : « tu n'écris que dans ton dossier ».

**Lire.** Les pages « Standard Uploads » (la méthode d'envoi convient aux fichiers de moins de 6 Mo) et « Storage Access Control ».

**Faire.**
- Créer le bucket `photos`, privé, avec une taille maximale et des types de fichiers autorisés (JPEG).
- Poser les règles Storage : envoi dans son dossier, lecture par les connectés, suppression par l'auteur ou l'admin.
- Réutiliser ce qui existe déjà dans le projet : `preparePhoto` et `photoDateOf` de `core/photo-import.ts` réduisent la photo à 1600 px, gèrent le HEIC de l'iPhone, redressent l'image et retirent la position GPS. Il suffit de transformer leur résultat en fichier et de l'envoyer avec `supabase.storage.from('photos').upload(...)`.
- Une fenêtre « Envoyer des photos » : choix de plusieurs photos, légende, progression, erreurs lisibles.
- Après l'envoi du fichier, ajouter la ligne correspondante dans la table `photos`. Si cette étape échoue, supprimer le fichier pour ne pas laisser d'orphelin.

**Vérifier.** La photo apparaît dans Storage et dans la table, rangée dans le dossier de son auteur.

## Étape 5 — Afficher les photos partagées (environ 2 heures)

**Comprendre.** Un fichier privé n'a pas d'adresse publique. Une balise `<img>` ne peut pas envoyer de mot de passe, donc on demande à Supabase un lien temporaire signé pour chaque photo (`createSignedUrls`), valable un court moment.

**Lire.** La page « Serving assets from Storage » et, en approfondissement, l'article sur les buckets, les liens signés et les règles.

**Faire.**
- Lire la liste des photos dans la table `photos`, puis demander les liens signés.
- Les afficher dans l'album ou sur la carte d'un souvenir (à toi de choisir où, voir « Décisions à prendre »).
- Renouveler les liens quand ils expirent.

**Vérifier.** L'ami 2 voit la photo envoyée par l'ami 1, et personne ne la voit sans être connecté.

## Étape 6 — Sécurité et essais à deux comptes (environ 1 heure)

**Faire.** Une liste de contrôle à cocher, avec deux comptes :
- [ ] Un visiteur sans compte n'obtient ni la liste des photos, ni un fichier.
- [ ] L'ami 1 ne peut pas supprimer la photo de l'ami 2 (ni la ligne, ni le fichier).
- [ ] Un ami ne peut pas écrire dans le dossier d'un autre.
- [ ] Un fichier qui n'est pas un JPEG, ou trop gros, est refusé.
- [ ] Aucune clé secrète n'est dans le code ni dans l'historique Git.
- [ ] L'admin (toi) peut tout supprimer.

**Vérifier.** Chaque case est cochée après un vrai essai, pas seulement après avoir relu les règles.

## Étape 7 (facultative) — Mise en ligne

Décider où héberger le site pour tes amis (un hébergeur de sites statiques, puisque Angular produit des fichiers statiques). Une fois le site en ligne, vérifier que la connexion et l'envoi marchent depuis un téléphone. Vérifie aussi les limites du plan gratuit de Supabase (1 Go de stockage) au vu du nombre de photos prévues.

## Décisions à prendre avant l'étape 3

1. **Qui voit quelles photos ?** Tous les connectés voient toutes les photos, ou chacun ne voit que les siennes (et toi, admin, tout). Cela change les règles des étapes 3 et 4.
2. **Identifiant ou e-mail ?** Des prénoms complétés par un faux domaine sont pratiques pour tes amis, mais il n'y a alors pas de réinitialisation de mot de passe par e-mail : c'est toi qui le changes dans le tableau de bord.
3. **Les photos partagées remplacent-elles les souvenirs en dur ?** Aujourd'hui les souvenirs viennent de `public/data/memories.json`, public. Les photos partagées, elles, seront réservées aux comptes. Décide si elles restent séparées ou si les souvenirs passent eux aussi en base.

## Ressources

- [Build a User Management App with Angular](https://supabase.com/docs/guides/getting-started/tutorials/with-angular) : le tutoriel de référence (Auth, base, Storage).
- [Password-based authentication](https://supabase.com/docs/guides/auth/passwords) : connexion par e-mail et mot de passe.
- [General configuration](https://supabase.com/docs/guides/auth/general-configuration) et [Désactiver les inscriptions](https://www.kulik.io/2024/08/29/how-to-disable-new-user-sign-ups-in-your-supabase-project/) : réserver l'appli à tes comptes.
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) : les règles d'accès de la base.
- [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) : les règles d'accès du stockage, avec exemples.
- [Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads) : envoyer un fichier.
- [Serving assets from Storage](https://supabase.com/docs/guides/storage/serving/downloads) : afficher un fichier privé.
- [Supabase Storage Deep Dive](https://dev.to/kanta13jp1/supabase-storage-deep-dive-bucket-design-signed-urls-image-transforms-and-rls-3b9k) : buckets, liens signés et règles, pour approfondir.
- [Dépôt d'exemple Angular](https://github.com/angular-sanctuary/supabase-angular-user-management) : un projet fini à comparer avec le tien (non testé).

## Lexique

- **Bucket** : un espace de stockage de fichiers, public ou privé.
- **RLS (Row Level Security)** : des règles dans la base qui décident, ligne par ligne, qui a le droit de lire, ajouter ou supprimer.
- **Clé publique (anon / publishable)** : la clé qu'on met dans l'appli. Elle n'ouvre rien toute seule : ce sont les règles qui protègent.
- **Clé service_role / secret** : la clé qui contourne toutes les règles. Jamais dans l'appli.
- **Lien signé** : une adresse temporaire qui donne accès à un fichier privé pendant un court moment.
