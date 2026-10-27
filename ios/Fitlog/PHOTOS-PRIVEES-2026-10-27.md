# Photos privées — préparation du 27 octobre 2026

## État

Travail isolé sur `codex/private-photos`. Aucun déploiement du web ou des règles
de stockage, aucune création de bucket, aucun transfert de photo personnelle,
aucune suppression Cloudinary et aucune modification des droits IAM réels.
La version en ligne issue de la fusion nº 2 reste utilisée.

La session Firebase CLI propriétaire a expiré. La tentative d'inventaire des
buckets a échoué avant toute lecture de leur contenu. Une reconnexion a été
ouverte ; Google demande à Manon une confirmation par clé d'accès. Ce blocage
concerne l'administration, pas les connexions des élèves.

## Parcours préparé

- Après activation explicite, les nouveaux envois passent par le SDK Firebase
  Storage vers un bucket photo dédié ; aucun repli vers Cloudinary si cet envoi
  échoue. L'ancienne valeur photo est conservée en cas d'échec.
- Réencodage JPEG, côté navigateur : dimension maximale 1600 pixels, taille
  maximale 2 Mio, fond blanc pour les transparences, nom original non transmis,
  métadonnées du fichier source non recopiées. Entrées JPEG/PNG/WebP limitées à
  20 Mio. Les règles vérifient taille et MIME déclaré ; elles n'analysent pas
  elles-mêmes les octets JPEG ou les métadonnées EXIF.
- Références Firestore : `{kind:'fitlog-private-photo',version:1,bucket,path}`,
  chemin `progress/{uid}/{initial|weekly}/{UUID}.jpg`. Pas d'URL de téléchargement
  persistée. Le composant obtient les octets authentifiés avec `getBlob`, puis
  crée une URL `blob:` locale, libérée au changement de compte ou au démontage.
- Les requêtes de lecture sont autorisées à l'élève concerné et à une coach
  ayant le rôle exact `coach` ET présente dans `coachIds`. Aucun listing,
  remplacement de fichier, changement de métadonnées ni suppression client.
  Le retrait d'un rattachement est contrôlé lors de la lecture suivante.
- Connexion nécessaire pour le nouvel envoi. À l'inscription, les photos restent
  facultatives et sont proposées depuis le profil après création du compte.
- Intégration profil élève, bilan hebdomadaire, fiche coach et visionneuse. Les
  anciennes URL Cloudinary restent lisibles pendant la transition. Le mode
  privé est inactif en production tant que son flag et son bucket ne sont pas
  configurés. Les fichiers natifs SwiftUI ne sont pas encore raccordés aux photos
  distantes par cette étape.
- Les photos de profil sans mensuration sont désormais affichées. Les sélecteurs
  photo sont utilisables au clavier et possèdent un intitulé accessible.

## Contrôles effectués

- 44 tests web réussis, 11 suites : références autorisées, refus des destinations
  arbitraires, limite de taille, préparation de l'image, absence du nom de fichier
  dans la requête, lecture authentifiée, réponse tardive d'un ancien compte,
  libération des URL blob et maintien de la lecture des anciennes photos.
- 4 tests de règles Storage réussis, avec de multiples assertions : propriétaire,
  coach rattachée, refus anonyme/autre élève/autre coach/faux rôle, révocation du
  rattachement, taille/type/chemin/métadonnées, refus du listing/remplacement/
  changement de jeton/suppression. Émulateurs seulement, projet
  `demo-fitlog-security`. Configuration `firebase.photos.local.json`.
- Build avec le mode privé activé et un bucket fictif : réussi.
- Essai SDK réel sur émulateurs : envoi d'une JPEG synthétique, lecture avec les
  droits élève, puis enregistrement de sa référence dans sa seule fiche fictive.
  Rechargement du navigateur : image affichée, URL locale blob, 800 × 1200 pixels.
  Capture `/private/tmp/fitlog-photo-privee-locale.jpg` (image synthétique).
- La sélection du fichier par l'extension Chrome n'a pas abouti : l'extension
  demande l'accès aux URL de fichiers. Le fichier de test a donc été ajouté via
  le SDK local, et non par le sélecteur web. Le parcours complet depuis ce
  sélecteur reste à vérifier ; ne pas le présenter comme testé de bout en bout.
- `git diff --check` et vérification de syntaxe du script administratif : réussis.

## Points à connaître avant activation

Le téléchargement authentifié direct par SDK est documenté par Firebase :
https://firebase.google.com/docs/storage/web/download-files.
Le navigateur demande une configuration CORS. Le fichier `photos-cors.json`
prévoit seulement l'origine de production ; ajouter l'origine exacte de test
avant la vérification distante, sans joker général.

Les règles Storage peuvent lire au plus deux documents Firestore par évaluation.
Elles consultent ici le rôle coach et le profil concerné. Leur première activation
demande de connecter les deux services : rôle technique
`roles/firebaserules.firestoreServiceAgent` (permission `datastore.entities.get`)
pour l'agent de règles Firebase, à confirmer après inventaire IAM. Le compte
`fitlog-audit-runtime` conserve son périmètre actuel et n'a pas besoin d'accès aux
photos. Sources :
https://firebase.google.com/docs/storage/security/rules-conditions et
https://docs.cloud.google.com/iam/docs/roles-permissions/firebaserules.

Le SDK Firebase peut créer des jetons internes de téléchargement sur les objets.
L'application n'appelle pas `getDownloadURL`, ne les expose pas dans Firestore et
ne les utilise pas pour les images. Ce mécanisme ne doit pas être décrit comme
une interdiction absolue de tout accès par jeton. Les jetons et anciens liens
devront faire partie de la vérification de confidentialité et de la migration.
Une photo déjà téléchargée ou copiée par une personne autorisée ne peut pas être
rappelée par la révocation de son compte.

Le cache `private, max-age=0, no-store` est demandé par le client. `cacheControl`
n'est pas disponible comme propriété de `request.resource` dans les règles
Storage testées ; ce n'est donc pas une contrainte démontrée par les règles.

Les anciens objets inutilisés sont conservés pour l'instant. Une procédure
serveur de retrait/suppression et de nettoyage des envois non rattachés est à
prévoir dans le chantier des droits RGPD, avec règles de conservation explicites.

## Activation envisagée, à confirmer après reconnexion

1. Inventorier les buckets et leur région sans lire leurs fichiers. Vérifier les
   droits techniques existants et le bucket disponible. Script en lecture seule :
   `node backend/scripts/production.cjs photos-storage-plan`.
2. Compter les références initiales et hebdomadaires sans afficher les URL ou les
   noms ni télécharger les photos :
   `node backend/scripts/production.cjs photos-metadata-report`.
3. Faire approuver le périmètre concret avant création/activation : bucket photo
   privé proposé `fitlog-photos-manon-castello-68195`, région `europe-west1`, accès
   public IAM interdit, accès uniforme. Garder le bucket de sauvegardes séparé.
   Le stockage et les lectures restent facturés à l'usage ; l'alerte de budget
   existante n'est pas un plafond de dépense.
4. Enregistrer ce seul bucket auprès de Firebase, activer les permissions de
   liaison Rules/Firestore nécessaires, publier seulement ses règles Storage.
   `firebase-private-photos.json` contient une liste avec son bucket explicite ;
   ne jamais appliquer ces règles au bucket de sauvegardes.
5. Configurer les deux variables `REACT_APP_PRIVATE_PHOTOS=true` et
   `REACT_APP_PRIVATE_PHOTO_BUCKET=<bucket validé>` sur une prévisualisation,
   tester ajout/lecture/échec/changement de compte, puis publier le web.
6. Préparer une migration distincte des anciennes photos : manifeste privé,
   conservation des UID et périodes, rapprochement des doublons, contrôle des
   tailles/empreintes et échantillon visuel. Obtenir l'autorisation de transfert
   des photos réelles vers le bucket validé. Ne réécrire les liens qu'après
   vérification et avec préconditions de version. Aucun effacement automatique
   des originaux ou invalidation de liens Cloudinary avant accord distinct.

Cette étape technique ne remplace pas les consentements et documents juridiques,
la qualification de l'hébergement et la procédure complète d'exercice des droits.
