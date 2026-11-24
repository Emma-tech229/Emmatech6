# BeniGo

Application de revente d'objets d'occasion entre particuliers au Benin.
Paiement sequestre (l'argent n'est reverse au vendeur qu'apres confirmation de
reception) et livraison maitrisee par la plateforme.

Pages en HTML/CSS/JS separes, sans framework ni build. Le backend partage est
**Firebase** : Firebase Authentication pour les comptes, Cloud Firestore pour
les annonces, commentaires et commandes, Cloud Storage pour les photos. Le site
est donc entierement statique et se deploie tel quel sur Vercel.

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
sortie vide : le contenu est publie tel quel. Ajoutez votre domaine dans
**Authentication > Settings > Authorized domains** pour que la connexion
fonctionne sur l'adresse de production.

## Pages

| Page | Role |
| --- | --- |
| `index.html` | Presentation de l'application (onboarding) |
| `inscription.html` | Creation de compte |
| `connexion.html` | Connexion email et mot de passe |
| `annonces.html` | Fil des annonces, recherche et categories |
| `annonce.html?id=...` | Detail d'un article, galerie, commentaires, achat |
| `publier.html` | Depot d'une annonce avec photos |
| `paiement.html?id=...` | Paiement sequestre et choix de livraison |
| `commande.html?ref=...` | Suivi de commande, code de remise et code QR |
| `profil.html` | Compte, theme, annonces, achats et ventes |

`js/store.js` est la couche de donnees (seul fichier qui parle a Firebase),
`js/firebase.js` regroupe les imports du SDK, `js/theme.js` gere les palettes.

## Donnees

- `users/{uid}` : nom, email, telephone, date d'inscription.
- `listings/{id}` : vendeur, titre, description, prix, categorie, etat, lieu,
  photos (URLs Storage), statut (`active`, `reservee`, `retiree`).
- `listings/{id}/comments/{id}` : auteur, texte, date.
- `orders/{ref}` : acheteur, vendeur, prix, livraison, code de remise, statut,
  historique. La reference `BG-XXXXXX` sert d'identifiant de document.

Le sequestre est porte par les regles Firestore : seul le vendeur peut passer
une commande de `sequestre` a `expediee`, seul l'acheteur peut la passer a
`terminee`, et seuls l'acheteur et le vendeur peuvent lire la commande. Un
acheteur ne peut que reserver une annonce encore `active`, sans rien modifier
d'autre.

## Tests

```
node test/store.test.mjs
```

Les tests executent `js/store.js` contre une doublure en memoire du SDK Firebase
([test/mock-firebase.js](test/mock-firebase.js)) : comptes, annonces,
commentaires, images, commande, sequestre complet et droits d'acces. Les regles
Firestore et Storage ne sont pas evaluees par ces tests : c'est le role de
`test/verifier-firebase.mjs`, qui interroge le vrai projet une fois configure.

## Limites connues

- **Connexion par telephone non disponible** : Firebase Authentication gere
  l'email et le mot de passe. La connexion par SMS demande l'offre payante
  Firebase Phone Auth. Le numero reste un champ de contact du profil.
- **Paiement mobile money non branche** : la commande et le sequestre sont
  enregistres, mais aucun debit reel n'a lieu. Un compte marchand agree
  (Kkiapay, FedaPay, EFT) reste necessaire.
- L'unicite du numero de telephone est verifiee cote client avant l'inscription,
  sans index unique cote base : deux inscriptions simultanees avec le meme
  numero restent possibles.
- Les fichiers de regles sont fournis pour etre colles dans la console ;
  ils peuvent aussi etre deplies avec `firebase deploy --only firestore:rules,storage`.

`js/qrcode.min.js` est QRCode.js (MIT, davidshimjs), utilise pour le code de
remise.
