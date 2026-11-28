# BeniGo

Application de revente d'objets d'occasion entre particuliers au Benin.
La commande reserve l'article et fixe le point de remise ; le paiement se fait
**a la remise**, en especes ou par mobile money, directement au vendeur ou au
livreur. BeniGo ne detient jamais l'argent des achats.

Pages en HTML/CSS/JS separes, sans framework ni build. Le backend partage est
**Firebase** : Firebase Authentication pour les comptes, Cloud Firestore pour
les annonces, commentaires et commandes, Cloud Storage pour les photos. Aucune
fonction serveur n'est necessaire : le site est entierement statique.

## Pourquoi pas de paiement en ligne

Encaisser l'argent d'un acheteur pour le reverser ensuite a un vendeur, c'est
detenir des fonds pour le compte de tiers. Cette activite est reservee aux
etablissements agrees par la BCEAO (monnaie electronique et services de
paiement). Un sequestre maison, ou pire un portefeuille rechargeable, expose a
une mise en demeure, a la fermeture du compte marchand par le prestataire, et
au penal en cas de non-reversement (abus de confiance). Le paiement a la remise
supprime le probleme a la racine : l'argent ne transite jamais par la
plateforme.

Pour aller plus loin plus tard, la seule voie propre est de deleguer
l'encaissement a un prestataire agree (comptes marketplace avec sous-comptes,
apres immatriculation RCCM + IFU), ou d'ouvrir un compte sequestre bancaire ou
notarial. Aucune de ces deux options ne demande de detenir les fonds soi-meme.

## Configuration Firebase (une seule fois)

1. Sur https://console.firebase.google.com, creez un projet, puis ajoutez une
   application Web. Copiez l'objet de configuration affiche dans
   [js/firebase-config.js](js/firebase-config.js).
2. **Authentication** > Sign-in method : activez **Email/Password**.
3. **Firestore Database** : creez la base, puis collez le contenu de
   [firestore.rules](firestore.rules) dans l'onglet **Regles** et publiez.
4. **Storage** : creez le bucket, puis collez [storage.rules](storage.rules)
   dans l'onglet **Regles** et publiez.

Tant que `js/firebase-config.js` n'est pas rempli, un bandeau rouge s'affiche en
haut des pages et les actions sont refusees avec un message explicite.

## Verifier la configuration

Une seule commande, sans rien installer, controle la configuration, la
connexion a Firestore, au Storage et l'etat des fournisseurs :

```
node test/verifier-firebase.mjs
```

Le script lit `js/firebase-config.js`, telecharge les modules du SDK, verifie la
cle API, lit la collection `listings` (lecture publique) et interroge le bucket
Storage. Pour controler aussi les regles Firestore et un vrai envoi d'image,
ajoutez un compte de test :

```
BENIGO_EMAIL=vous@exemple.bj BENIGO_PASSWORD=votre-mot-de-passe node test/verifier-firebase.mjs
```

Avec ce compte, le script lit `users/{uid}`, depose une petite image sous
`listings/{uid}/`, la relit puis la supprime. Chaque ligne s'affiche `ok`,
`note`, `saute` ou `ECHEC` avec la correction a faire, et la commande renvoie le
code de sortie 1 des qu'une verification echoue.

## Lancer en local

Un simple serveur statique suffit (les modules JavaScript ne fonctionnent pas
en `file://`) :

```
python3 -m http.server 3000
```

Puis ouvrez `http://localhost:3000`.

## Deploiement sur Vercel

Importez le depot, framework « Other », aucune commande de build, dossier de
sortie vide : le contenu est publie tel quel. Aucune variable d'environnement
n'est necessaire. Ajoutez votre domaine dans **Authentication > Settings >
Authorized domains** pour que la connexion fonctionne sur l'adresse de
production.

## Pages

| Page | Role |
| --- | --- |
| `index.html` | Presentation de l'application (onboarding) |
| `inscription.html` | Creation de compte |
| `connexion.html` | Connexion email et mot de passe |
| `annonces.html` | Fil des annonces, recherche et categories |
| `annonce.html?id=...` | Detail d'un article, galerie, commentaires, commande |
| `publier.html` | Depot d'une annonce avec photos |
| `commander.html?id=...` | Commande et choix du mode de remise, sans paiement |
| `commande.html?ref=...` | Suivi de commande, code de remise et code QR |
| `profil.html` | Compte, theme, annonces, achats et ventes |

`js/store.js` est la couche de donnees (seul fichier qui parle a Firebase),
`js/firebase.js` regroupe les imports du SDK, `js/theme.js` gere les palettes.

## Donnees

- `users/{uid}` : nom, email, telephone, date d'inscription et date de fin
  d'abonnement (`abonnementJusquA`).
- `listings/{id}` : vendeur, titre, description, prix, categorie, etat, lieu,
  photos (URLs Storage, au moins une et quatre au maximum : une annonce sans
  photo est refusee par le client et par les regles), statut (`active`,
  `reservee`, `retiree`).
- `listings/{id}/comments/{id}` : auteur, texte, date.
- `orders/{ref}` : acheteur, vendeur, prix, mode de remise, code de remise,
  statut, historique. Aucune donnee de paiement n'est stockee : la plateforme
  n'encaisse rien. La reference `BG-XXXXXX` sert d'identifiant de document.

La commande est creee par l'acheteur dans une transaction : elle verifie que
l'annonce est encore `active`, ecrit la commande avec le statut `commande` puis
passe l'annonce a `reservee`. Les regles Firestore limitent la suite du
parcours : seul le vendeur passe la commande a `expediee` (colis remis a la
livraison), seul l'acheteur la passe a `terminee` (article recu et paiement
regle), et seuls l'acheteur et le vendeur peuvent lire la commande.

## Abonnement vendeur

Chaque compte recoit une **periode d'essai gratuite** a l'inscription :
`signup()` ecrit `abonnementJusquA` (date de fin en millisecondes) dans
`users/{uid}`, calculee a partir de `SUBSCRIPTION_FREE_DAYS`. La date apparait
dans `profil.html`.

La duree se regle a un seul endroit : `SUBSCRIPTION_FREE_DAYS` dans
`js/store.js` (60 jours par defaut). Les regles Firestore ne fixent qu'un
plafond de securite, `plafondEssaiMs()` (366 jours) : toute duree inferieure ne
demande donc aucune modification des regles. Le test local echoue si
`SUBSCRIPTION_FREE_DAYS` depasse `SUBSCRIPTION_MAX_DAYS`, qui doit valoir la
meme valeur que `plafondEssaiMs()`.

Publier une annonce demande un abonnement actif :

- cote client, `addListing()` et `publier.html` refusent la publication et
  affichent la date d'expiration ;
- cote base, la regle `listings.create` exige `abonnementActif(uid)` ; un membre
  ne peut pas modifier sa propre date d'abonnement, seul le proprietaire du
  projet la prolonge depuis la console Firebase.

Apres expiration, les annonces deja en ligne, les commandes et les achats
restent utilisables ; seules les nouvelles publications sont bloquees. Un
profil cree avant cette fonction retombe sur l'essai a compter de sa date
d'inscription. Les pages ne citent pas de duree en clair : elles parlent d'une
periode d'essai gratuite, pour rester justes si la duree change.

## Tests

```
node test/store.test.mjs
```

Les tests executent `js/store.js` contre une doublure en memoire du SDK Firebase
([test/mock-firebase.js](test/mock-firebase.js)) : comptes, annonces,
commentaires, images, commande, reservation, parcours de remise et droits
d'acces. Les regles Firestore et Storage ne sont pas evaluees par ces tests :
c'est le role de `test/verifier-firebase.mjs`, qui interroge le vrai projet une
fois configure.

## Limites connues

- **Connexion par telephone non disponible** : Firebase Authentication gere
  l'email et le mot de passe. La connexion par SMS demande l'offre payante
  Firebase Phone Auth. Le numero reste un champ de contact du profil.
- **Pas de protection financiere** : BeniGo ne garantit pas le paiement, il
  organise la rencontre et trace la remise. Un acheteur qui paie sans verifier
  l'article n'a aucun recours financier aupres de la plateforme ; un vendeur
  qui remet sans encaisser non plus. C'est le prix de l'absence de detention de
  fonds.
- **Reservation sans engagement** : une annonce passee a `reservee` reste
  bloquee tant que le vendeur ne la repasse pas a `active`. Il n'existe pas
  encore de delai automatique d'expiration.
- **Renouvellement manuel de l'abonnement** : il n'y a pas encore de paiement
  en ligne. La prolongation se fait dans la console Firebase en changeant
  `abonnementJusquA` (millisecondes) dans `users/{uid}`.
- L'unicite du numero de telephone est verifiee cote client avant l'inscription,
  sans index unique cote base : deux inscriptions simultanees avec le meme
  numero restent possibles.
- Les fichiers de regles sont fournis pour etre colles dans la console ;
  ils peuvent aussi etre deplies avec `firebase deploy --only firestore:rules,storage`.

`js/qrcode.min.js` est QRCode.js (MIT, davidshimjs), utilise pour le code de
remise.
