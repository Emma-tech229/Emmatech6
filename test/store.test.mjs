/* Tests de la couche de donnees de BeniGo (js/store.js).
   La doublure test/mock-firebase.js remplace le SDK Firebase et le reseau est
   simule pour l envoi des photos ; les regles Firestore ne sont pas evaluees
   ici, seules les operations et les controles faits par le client le sont.

   Lancement : node test/store.test.mjs */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const build = path.join(here, '.build');

fs.rmSync(build, { recursive: true, force: true });
fs.cpSync(path.join(root, 'js'), build, { recursive: true });
fs.copyFileSync(path.join(here, 'mock-firebase.js'), path.join(build, 'firebase.js'));
fs.writeFileSync(path.join(build, 'firebase-config.js'), [
  'export const firebaseConfig = {',
  "  apiKey: 'demo',",
  "  authDomain: 'demo.firebaseapp.com',",
  "  projectId: 'demo-benigo',",
  "  storageBucket: 'demo.firebasestorage.app',",
  "  messagingSenderId: '1',",
  "  appId: '1:1:web:1'",
  '};',
  'export function isConfigured() { return true; }'
].join('\n'));
fs.writeFileSync(path.join(build, 'images-config.js'), [
  'export const imageHost = {',
  "  cloudName: 'demo-cloud',",
  "  uploadPreset: 'benigo_test'",
  '};',
  'export function imageHostConfigured() { return true; }'
].join('\n'));

const module = await import(pathToFileURL(path.join(build, 'store.js')).href);
const BeniGo = module.default;

let failures = 0;
function ok(label, condition, detail) {
  if (!condition) failures += 1;
  console.log((condition ? 'ok   ' : 'FAIL ') + label + (condition || !detail ? '' : ' -> ' + detail));
}

async function rejects(label, action, expected) {
  try {
    await action();
    ok(label, false, 'aucune erreur levee');
  } catch (error) {
    ok(label, error.message.includes(expected), error.message);
  }
}

const seller = await BeniGo.signup({ name: 'Awa Dossou', email: 'awa@benigo.bj', phone: '97000001', password: 'secret1' });
ok('inscription vendeur', seller.id && seller.name === 'Awa Dossou');

const buyer = await BeniGo.signup({ name: 'Koffi Jean', email: 'koffi@benigo.bj', phone: '97000002', password: 'secret2' });
ok('inscription acheteur', buyer.email === 'koffi@benigo.bj');

/* Abonnement vendeur : essai gratuit reglable, puis publication bloquee.
   La duree se regle dans js/store.js ; le test verifie seulement qu elle
   reste sous le plafond que les regles Firestore autorisent. */
const jour = 24 * 60 * 60 * 1000;
const duree = BeniGo.SUBSCRIPTION_FREE_DAYS;
ok('duree d essai positive', Number.isInteger(duree) && duree > 0, String(duree));
ok(
  'duree sous le plafond des regles Firestore',
  duree <= BeniGo.SUBSCRIPTION_MAX_DAYS,
  duree + ' jours pour un plafond de ' + BeniGo.SUBSCRIPTION_MAX_DAYS +
    ' : augmentez plafondEssaiMs() dans firestore.rules et SUBSCRIPTION_MAX_DAYS dans js/store.js'
);
const essai = BeniGo.subscriptionStatus(seller);
ok('essai offert a l inscription', essai.active && essai.endAt > Date.now() + (duree - 2) * jour && essai.endAt <= Date.now() + (duree + 1) * jour, String(essai.endAt));
ok('abonnement actif garde la publication', essai.daysLeft >= duree - 2 && essai.daysLeft <= duree + 1, String(essai.daysLeft));
const expire = BeniGo.subscriptionStatus({ createdAt: Date.now() - 200 * jour, abonnementJusquA: Date.now() - jour });
ok('abonnement expire detecte', !expire.active && expire.daysLeft === 0);
ok('date d expiration conservee', expire.endAt > 0);
const ancien = BeniGo.subscriptionStatus({ createdAt: Date.now() - Math.floor(duree / 2) * jour });
ok('profil sans date retombe sur l inscription', ancien.active && ancien.daysLeft <= Math.ceil(duree / 2) + 1, String(ancien.daysLeft));
ok('profil absent sans abonnement', !BeniGo.subscriptionStatus(null).active);

await rejects('doublon email refuse', () => BeniGo.signup({ name: 'Autre', email: 'awa@benigo.bj', phone: '97000009', password: 'secret1' }), 'existe deja');
await rejects('telephone trop court refuse', () => BeniGo.signup({ name: 'Autre', email: 'x@benigo.bj', phone: '12', password: 'secret1' }), 'telephone');
await rejects('mot de passe court refuse', () => BeniGo.signup({ name: 'Autre', email: 'y@benigo.bj', phone: '97000008', password: '123' }), 'mot de passe');

ok('profil courant', (await BeniGo.me()).email === 'koffi@benigo.bj');
ok('telephone conserve', (await BeniGo.me()).phone === '97000002');

await rejects(
  'telephone deja utilise refuse',
  () => BeniGo.signup({ name: 'Autre', email: 'z@benigo.bj', phone: '97000002', password: 'secret1' }),
  'numero de telephone'
);
ok('inscription refusee laisse deconnecte', (await BeniGo.me()) === null);

await BeniGo.logout();
ok('deconnexion', (await BeniGo.me()) === null);
await rejects('mot de passe incorrect refuse', () => BeniGo.login('awa@benigo.bj', 'nope'), 'incorrect');
const logged = await BeniGo.login('awa@benigo.bj', 'secret1');
ok('connexion email', logged.email === 'awa@benigo.bj');

await rejects('titre trop court refuse', () => BeniGo.addListing({ title: 'ab', price: 5000 }), 'titre');
await rejects('prix trop bas refuse', () => BeniGo.addListing({ title: 'Objet valable', price: 10 }), 'prix');
await rejects(
  'publication sans photo refusee',
  () => BeniGo.addListing({ title: 'Objet valable', price: 5000, images: [] }),
  'photo'
);

const listing = await BeniGo.addListing({
  title: 'Samsung A24 128 Go',
  price: 45000,
  category: 'Telephones',
  condition: 'Bon etat',
  place: 'Akpakpa, Cotonou',
  description: 'Vendu avec chargeur',
  images: ['https://storage.test/listings/a/1.jpg']
});
ok('publication annonce', listing.id && listing.sellerName === 'Awa Dossou');

const feed = await BeniGo.listings({ q: 'samsung' });
ok('annonce visible dans le fil', feed.length === 1 && feed[0].price === 45000);
ok('filtre par categorie', (await BeniGo.listings({ category: 'Maison' })).length === 0);
ok('recherche sans resultat', (await BeniGo.listings({ q: 'velo' })).length === 0);
ok('detail annonce', (await BeniGo.listing(listing.id)).title === 'Samsung A24 128 Go');

/* Images : la couche cliente envoie le binaire au service d hebergement
   (Cloudinary, preset non signe) et recupere une URL publique. Le reseau est
   simule : aucun envoi reel n a lieu pendant les tests. */
const vraiFetch = globalThis.fetch;
let envoi = null;
globalThis.fetch = async (url, options) => {
  envoi = { url: String(url), body: options && options.body };
  return {
    ok: true,
    status: 200,
    json: async () => ({ secure_url: 'https://res.cloudinary.test/benigo/photo.jpg' })
  };
};

const url = await BeniGo.uploadImage(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
ok('upload image', url === 'https://res.cloudinary.test/benigo/photo.jpg', url);
ok(
  'envoi vers le service configure',
  envoi.url === 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
  envoi.url
);
ok('preset d envoi transmis', envoi.body.get('upload_preset') === 'benigo_test');
ok('fichier joint a l envoi', envoi.body.get('file') instanceof Blob);

/* Un refus du service doit remonter une erreur claire, sans bloquer la page. */
globalThis.fetch = async () => ({
  ok: false,
  status: 400,
  json: async () => ({ error: { message: 'Upload preset must be whitelisted' } })
});
await rejects(
  'refus du service signale',
  () => BeniGo.uploadImage(new Blob([new Uint8Array([1])], { type: 'image/jpeg' })),
  'verifiez le cloudName'
);

/* Une coupure reseau doit aussi remonter une erreur, puis l envoi repart. */
globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
await rejects(
  'reseau coupe signale',
  () => BeniGo.uploadImage(new Blob([new Uint8Array([1])], { type: 'image/jpeg' })),
  'reseau'
);
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ secure_url: 'https://res.cloudinary.test/benigo/reprise.jpg' })
});
const reprise = await BeniGo.uploadImage(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }));
ok('envoi retabli apres la panne', reprise === 'https://res.cloudinary.test/benigo/reprise.jpg', reprise);
globalThis.fetch = vraiFetch;

/* Commentaires */
await BeniGo.addComment(listing.id, 'Toujours disponible ?');
await BeniGo.addComment(listing.id, 'Le chargeur est fourni ?');
const comments = await BeniGo.comments(listing.id);
ok('commentaires lus dans l ordre', comments.length === 2 && comments[0].text === 'Toujours disponible ?');
await rejects('commentaire trop court refuse', () => BeniGo.addComment(listing.id, 'a'), 'court');

/* Commande : l acheteur reserve l annonce, le paiement se fait a la remise.
   Aucun fonds ne transite par la plateforme : la commande ne porte donc
   aucune donnee de paiement. */
const sellerId = (await BeniGo.me()).id;
await rejects(
  'commande de sa propre annonce refusee',
  () => BeniGo.createOrder({ listingId: listing.id, delivery: 'relais', relay: 'Point relais Akpakpa' }),
  'propre annonce'
);

const acheteur = await BeniGo.login('koffi@benigo.bj', 'secret2');
const order = await BeniGo.createOrder({
  listingId: listing.id,
  delivery: 'relais',
  relay: 'Point relais Akpakpa'
});
ok('commande enregistree', order.ref.startsWith('BG-') && order.status === 'commande');
ok('membres de la commande', order.members.length === 2 && order.members[0] === acheteur.id);
ok('code de remise a 6 chiffres', /^\d{6}$/.test(order.code));
ok('aucune donnee de paiement', order.payment === undefined && order.status !== 'sequestre');
ok('annonce reservee', (await BeniGo.listing(listing.id)).status === 'reservee');
await rejects(
  'annonce deja reservee refusee',
  () => BeniGo.createOrder({ listingId: listing.id, delivery: 'relais', relay: 'Point relais Akpakpa' }),
  'deja reserve'
);
await rejects('acheteur ne peut pas marquer la remise', () => BeniGo.shipOrder(order.ref), 'vendeur');

const buyerOrders = await BeniGo.orders();
ok('achat visible cote acheteur', buyerOrders.length === 1 && buyerOrders[0].buyerName === 'Koffi Jean');

await BeniGo.login('awa@benigo.bj', 'secret1');
const sellerOrders = await BeniGo.orders();
ok('vente visible cote vendeur', sellerOrders.length === 1 && sellerOrders[0].sellerName === 'Awa Dossou');
await rejects('vendeur ne peut pas confirmer', () => BeniGo.confirmReception(order.ref), 'acheteur');
const shipped = await BeniGo.shipOrder(order.ref);
ok('vendeur declare la remise', shipped.status === 'expediee');
await rejects('remise deux fois refusee', () => BeniGo.shipOrder(order.ref), 'plus etre expediee');

await BeniGo.login('koffi@benigo.bj', 'secret2');
const done = await BeniGo.confirmReception(order.ref);
ok('acheteur confirme la remise', done.status === 'terminee');
ok('historique de la commande', done.history.length === 3, JSON.stringify(done.history));
await rejects('double confirmation refusee', () => BeniGo.confirmReception(order.ref), 'deja confirmee');

/* Un tiers ne doit pas acceder a la commande. */
await BeniGo.logout();
await BeniGo.signup({ name: 'Intrus Test', email: 'intrus@benigo.bj', phone: '97000003', password: 'secret3' });
await rejects('commande fermee aux tiers', () => BeniGo.order(order.ref), 'ne vous concerne pas');
ok('liste des commandes du tiers vide', (await BeniGo.orders()).length === 0);

/* Retrait d annonce */
await BeniGo.login('koffi@benigo.bj', 'secret2');
await rejects('retrait interdit a l acheteur', () => BeniGo.removeListing(listing.id), 'appartient');
await BeniGo.login('awa@benigo.bj', 'secret1');
await BeniGo.removeListing(listing.id);
ok('annonce retiree du fil', (await BeniGo.listings()).length === 0);
ok('annonce retiree inaccessible', (await BeniGo.listing(listing.id)) === null);
ok('mes annonces masquent les annonces retirees', (await BeniGo.myListings()).length === 0);

/* Presentation */
ok('montant formate', BeniGo.money(45000) === '45 000 FCFA');
ok('date formatee', /\d{2}/.test(BeniGo.dateLabel(Date.now())));
ok('echappement html', BeniGo.escapeHtml('<b>"x"</b>') === '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');

fs.rmSync(build, { recursive: true, force: true });

console.log(failures ? failures + ' test(s) en echec' : 'tous les tests passent');
process.exit(failures ? 1 : 0);
