/* BeniGo - acces aux donnees partagees via Firebase.
   - Firebase Auth : comptes email/mot de passe
   - Cloud Firestore : annonces, commentaires, commandes
   - Cloud Storage : photos des annonces
   Le navigateur ne garde que la session Firebase de l'appareil. */

import {
  initializeApp,
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  deleteUser,
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  runTransaction,
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from './firebase.js';
import { firebaseConfig, isConfigured } from './firebase-config.js';

export const RELAYS = [
  { id: 'r1', name: 'Point relais Akpakpa', detail: 'Akpakpa, Cotonou' },
  { id: 'r2', name: 'Point relais Dantokpa', detail: 'Dantokpa, Cotonou' },
  { id: 'r3', name: 'Point relais Calavi', detail: 'Godomey, Abomey-Calavi' },
  { id: 'r4', name: 'Point relais Porto-Novo', detail: 'Centre, Porto-Novo' }
];

export const STATUS_LABELS = {
  commande: 'Commande enregistree, paiement a la remise',
  expediee: 'Article remis a la livraison',
  terminee: 'Article recu, paiement regle'
};

const CONFIG_ERROR = 'Firebase n est pas configure : renseignez js/firebase-config.js avec les cles de votre projet.';

export function money(value) {
  const n = Math.round(Number(value) || 0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
}

export function dateLabel(value) {
  try {
    const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return '';
  }
}

export function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '').replace(/^229/, '');
}

function authErrorMessage(error) {
  const code = error && error.code;
  if (code === 'auth/email-already-in-use') return 'Un compte existe deja avec cet email.';
  if (code === 'auth/invalid-email') return 'Adresse email invalide.';
  if (code === 'auth/weak-password') return 'Le mot de passe doit faire au moins 6 caracteres.';
  if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
    return 'Email ou mot de passe incorrect.';
  }
  if (code === 'auth/wrong-password') return 'Mot de passe incorrect.';
  if (code === 'auth/too-many-requests') return 'Trop de tentatives. Reessayez dans quelques minutes.';
  if (code === 'auth/network-request-failed') return 'Reseau indisponible. Verifiez votre connexion.';
  if (code === 'permission-denied' || code === 'storage/unauthorized') {
    return 'Action refusee par les regles de securite Firebase.';
  }
  return (error && error.message) || 'Erreur inattendue.';
}

function sortByDate(items, field, direction) {
  return items.sort((a, b) => {
    const first = a[field] || 0;
    const second = b[field] || 0;
    return direction === 'asc' ? first - second : second - first;
  });
}

/* --- initialisation --- */

let app = null;
let auth = null;
let db = null;
let storage = null;
let authUser = null;
let profile = null;
const authReady = new Promise((resolve) => {
  if (!isConfigured()) {
    resolve(null);
    return;
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  onAuthStateChanged(auth, (user) => {
    authUser = user;
    if (user && profile && profile.id !== user.uid) profile = null;
    resolve(user);
  });
});

function assertConfigured() {
  if (!isConfigured() || !db) throw new Error(CONFIG_ERROR);
}

function listingFromDoc(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    title: data.title,
    description: data.description || '',
    price: data.price,
    category: data.category || 'Autres',
    condition: data.condition || 'Bon etat',
    place: data.place || '',
    images: data.images || [],
    status: data.status || 'active',
    createdAt: data.createdAt || 0,
    sellerId: data.sellerId,
    sellerName: data.sellerName || 'Vendeur'
  };
}

function orderFromDoc(snapshot) {
  const data = snapshot.data();
  return {
    ref: snapshot.id,
    listingId: data.listingId,
    listingTitle: data.listingTitle,
    listingImage: data.listingImage || '',
    buyerId: data.buyerId,
    buyerName: data.buyerName || 'Acheteur',
    sellerId: data.sellerId,
    sellerName: data.sellerName || 'Vendeur',
    price: data.price,
    delivery: data.delivery,
    relay: data.relay || '',
    address: data.address || '',
    phone: data.phone || '',
    code: data.code,
    status: data.status,
    history: data.history || [],
    createdAt: data.createdAt || 0,
    updatedAt: data.updatedAt || 0
  };
}

async function loadProfile(user) {
  if (!user) return null;
  if (profile && profile.id === user.uid) return profile;
  const snapshot = await getDoc(doc(db, 'users', user.uid));
  if (!snapshot.exists()) {
    profile = {
      id: user.uid,
      name: (user.displayName || user.email || 'Membre').split('@')[0],
      email: user.email || '',
      phone: '',
      createdAt: 0
    };
    return profile;
  }
  const data = snapshot.data();
  profile = {
    id: user.uid,
    name: data.name || user.displayName || 'Membre',
    email: data.email || user.email || '',
    phone: data.phone || '',
    createdAt: data.createdAt || 0
  };
  return profile;
}

/* --- comptes --- */

export async function signup(data) {
  assertConfigured();
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const phone = normalizePhone(data.phone);
  const password = String(data.password || '');

  if (name.length < 2) throw new Error('Le nom est obligatoire.');
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) throw new Error('Adresse email invalide.');
  if (phone.length < 8) throw new Error('Numero de telephone invalide (8 chiffres).');
  if (password.length < 6) throw new Error('Le mot de passe doit faire au moins 6 caracteres.');

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    throw new Error(authErrorMessage(error));
  }

  const user = credential.user;

  /* Les regles Firestore n ouvrent la lecture de users qu aux membres connectes :
     le controle du numero de telephone se fait donc juste apres la creation du
     compte. Si le numero est deja pris, le compte tout juste cree est supprime
     pour ne pas laisser un doublon ni une session ouverte. */
  let phoneTaken = false;
  try {
    const taken = await getDocs(query(collection(db, 'users'), where('phone', '==', phone)));
    phoneTaken = !taken.empty;
  } catch (error) {
    phoneTaken = false;
  }

  if (phoneTaken) {
    await deleteUser(user).catch(function () {});
    authUser = null;
    profile = null;
    throw new Error('Un compte existe deja avec ce numero de telephone.');
  }
  const record = {
    name: name,
    email: email,
    phone: phone,
    createdAt: Date.now()
  };
  try {
    await updateProfile(user, { displayName: name });
    await setDoc(doc(db, 'users', user.uid), record);
  } catch (error) {
    throw new Error(authErrorMessage(error));
  }

  authUser = user;
  profile = { id: user.uid, ...record };
  return profile;
}

export async function login(email, password) {
  assertConfigured();
  try {
    const credential = await signInWithEmailAndPassword(auth, String(email || '').trim(), String(password || ''));
    authUser = credential.user;
    profile = null;
    return await loadProfile(credential.user);
  } catch (error) {
    throw new Error(authErrorMessage(error));
  }
}

export async function logout() {
  if (!auth) return;
  await signOut(auth);
  authUser = null;
  profile = null;
}

export async function me() {
  assertConfigured();
  await authReady;
  if (!authUser) return null;
  return loadProfile(authUser);
}

export async function requireUser(redirect) {
  const user = await me().catch(() => null);
  if (!user) {
    window.location.replace(redirect || 'connexion.html');
    return null;
  }
  return user;
}

export function currentUser() {
  return profile;
}

/* --- annonces --- */

export async function listings(filters) {
  assertConfigured();
  const snapshot = await getDocs(query(collection(db, 'listings'), where('status', '==', 'active')));
  let items = snapshot.docs.map(listingFromDoc);
  const q = String((filters && filters.q) || '').trim().toLowerCase();
  const category = filters && filters.category;
  if (category && category !== 'Tout') items = items.filter((item) => item.category === category);
  if (q) {
    items = items.filter((item) =>
      (item.title + ' ' + item.description + ' ' + item.category).toLowerCase().includes(q));
  }
  return sortByDate(items, 'createdAt', 'desc');
}

export async function listing(id) {
  assertConfigured();
  const snapshot = await getDoc(doc(db, 'listings', id));
  if (!snapshot.exists()) return null;
  const item = listingFromDoc(snapshot);
  if (item.status === 'retiree') return null;
  return item;
}

export async function myListings() {
  assertConfigured();
  const user = await me();
  if (!user) return [];
  const snapshot = await getDocs(query(collection(db, 'listings'), where('sellerId', '==', user.id)));
  const items = snapshot.docs.map(listingFromDoc).filter((item) => item.status !== 'retiree');
  return sortByDate(items, 'createdAt', 'desc');
}

export async function addListing(data) {
  assertConfigured();
  const user = await me();
  if (!user) throw new Error('Connectez-vous pour publier.');

  const title = String(data.title || '').trim();
  const price = Math.round(Number(data.price));
  if (title.length < 4) throw new Error('Le titre doit contenir au moins 4 caracteres.');
  if (!Number.isFinite(price) || price < 100) throw new Error('Indiquez un prix valable (minimum 100 FCFA).');

  const record = {
    sellerId: user.id,
    sellerName: user.name,
    title: title,
    description: String(data.description || '').trim(),
    price: price,
    category: data.category || 'Autres',
    condition: data.condition || 'Bon etat',
    place: String(data.place || '').trim(),
    images: (data.images || []).slice(0, 4),
    status: 'active',
    createdAt: Date.now()
  };
  const created = await addDoc(collection(db, 'listings'), record);
  return { id: created.id, ...record };
}

export async function removeListing(id) {
  assertConfigured();
  const user = await me();
  if (!user) throw new Error('Connectez-vous.');
  const snapshot = await getDoc(doc(db, 'listings', id));
  if (!snapshot.exists()) throw new Error('Annonce introuvable.');
  if (snapshot.data().sellerId !== user.id) throw new Error('Cette annonce ne vous appartient pas.');
  await updateDoc(doc(db, 'listings', id), { status: 'retiree' });
}

export async function uploadImage(blob) {
  assertConfigured();
  const user = await me();
  if (!user) throw new Error('Connectez-vous pour envoyer une photo.');
  const name = 'listings/' + user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
  const target = ref(storage, name);
  await uploadBytes(target, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(target);
}

/* --- commentaires --- */

export async function comments(listingId) {
  assertConfigured();
  const snapshot = await getDocs(collection(db, 'listings', listingId, 'comments'));
  const items = snapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      name: data.name || 'Membre',
      text: data.text || '',
      createdAt: data.createdAt || 0
    };
  });
  return sortByDate(items, 'createdAt', 'asc');
}

export async function addComment(listingId, text) {
  assertConfigured();
  const user = await me();
  if (!user) throw new Error('Connectez-vous pour commenter.');
  const body = String(text || '').trim();
  if (body.length < 2) throw new Error('Votre commentaire est trop court.');
  const record = {
    userId: user.id,
    name: user.name,
    text: body,
    createdAt: Date.now()
  };
  const created = await addDoc(collection(db, 'listings', listingId, 'comments'), record);
  return { id: created.id, ...record };
}

/* --- commandes ---
   BeniGo ne detient jamais l argent des achats : la commande reserve l annonce
   et fixe le mode de remise, puis le paiement se fait en especes ou par mobile
   money au moment de la remise, directement au vendeur ou au livreur. */

function orderRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = '';
  for (let i = 0; i < 6; i += 1) ref += alphabet[Math.floor(Math.random() * alphabet.length)];
  return 'BG-' + ref;
}

function handoffCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += String(Math.floor(Math.random() * 10));
  return code;
}

/* Cree la commande et reserve l annonce dans une seule transaction. */
export async function createOrder(data) {
  assertConfigured();
  const user = await me();
  if (!user) throw new Error('Connectez-vous pour commander.');

  const listingId = String((data && data.listingId) || '');
  const delivery = data && data.delivery === 'livreur' ? 'livreur' : 'relais';
  const relay = delivery === 'relais' ? String((data && data.relay) || '') : '';
  const address = delivery === 'livreur' ? String((data && data.address) || '').trim() : '';
  const phone = String((data && data.phone) || user.phone || '');

  const target = doc(db, 'listings', listingId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(target);
    if (!snapshot.exists()) throw new Error('Annonce introuvable.');
    const item = listingFromDoc(snapshot);
    if (item.sellerId === user.id) throw new Error('Vous ne pouvez pas commander votre propre annonce.');
    if (item.status !== 'active') throw new Error('Cet article est deja reserve par un autre acheteur.');
    if (delivery === 'livreur' && address.length < 6) throw new Error('Indiquez une adresse de livraison.');

    const now = Date.now();
    const ref = orderRef();
    const record = {
      listingId: item.id,
      listingTitle: item.title,
      listingImage: (item.images && item.images[0]) || '',
      buyerId: user.id,
      buyerName: user.name,
      sellerId: item.sellerId,
      sellerName: item.sellerName,
      price: item.price,
      delivery: delivery,
      relay: relay,
      address: address,
      phone: phone,
      code: handoffCode(),
      status: 'commande',
      members: [user.id, item.sellerId],
      history: [{ status: 'commande', at: now }],
      createdAt: now,
      updatedAt: now
    };
    transaction.set(doc(db, 'orders', ref), record);
    transaction.update(target, { status: 'reservee' });
    return { ref: ref, ...record };
  });
}

export async function order(ref) {
  assertConfigured();
  const user = await me();
  if (!user) throw new Error('Connectez-vous.');
  const snapshot = await getDoc(doc(db, 'orders', ref));
  if (!snapshot.exists()) return null;
  const data = orderFromDoc(snapshot);
  if (data.buyerId !== user.id && data.sellerId !== user.id) {
    throw new Error('Cette commande ne vous concerne pas.');
  }
  return data;
}

export async function orders() {
  assertConfigured();
  const user = await me();
  if (!user) return [];
  const snapshot = await getDocs(query(collection(db, 'orders'), where('members', 'array-contains', user.id)));
  return sortByDate(snapshot.docs.map(orderFromDoc), 'createdAt', 'desc');
}

async function transition(ref, next) {
  assertConfigured();
  const user = await me();
  if (!user) throw new Error('Connectez-vous.');
  const target = doc(db, 'orders', ref);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(target);
    if (!snapshot.exists()) throw new Error('Commande introuvable.');
    const data = orderFromDoc(snapshot);

    if (next === 'expediee') {
      if (data.sellerId !== user.id) throw new Error('Seul le vendeur peut marquer la remise.');
      if (data.status !== 'commande') throw new Error('Cette commande ne peut plus etre expediee.');
    } else {
      if (data.buyerId !== user.id) throw new Error('Seul l acheteur peut confirmer la reception.');
      if (data.status === 'terminee') throw new Error('Reception deja confirmee.');
    }

    const history = (data.history || []).concat([{ status: next, at: Date.now() }]);
    transaction.update(target, { status: next, history: history, updatedAt: Date.now() });
    return { ...data, status: next, history: history };
  });
}

export function shipOrder(ref) {
  return transition(ref, 'expediee');
}

export function confirmReception(ref) {
  return transition(ref, 'terminee');
}

/* --- bandeau de configuration --- */

function configurationBanner() {
  if (isConfigured() || typeof document === 'undefined') return;
  const box = document.createElement('div');
  box.setAttribute('style', [
    'position:relative', 'z-index:60', 'background:#b03a2e', 'color:#fff',
    'padding:10px 16px', 'font:14px/1.4 system-ui,sans-serif', 'text-align:center'
  ].join(';'));
  box.textContent =
    'Firebase n est pas encore configure : renseignez js/firebase-config.js puis rechargez la page.';
  document.body.insertBefore(box, document.body.firstChild);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', configurationBanner);
  } else {
    configurationBanner();
  }
}

const BeniGo = {
  RELAYS,
  STATUS_LABELS,
  signup,
  login,
  logout,
  me,
  currentUser,
  requireUser,
  listings,
  listing,
  myListings,
  addListing,
  removeListing,
  uploadImage,
  comments,
  addComment,
  createOrder,
  order,
  orders,
  shipOrder,
  confirmReception,
  money,
  dateLabel,
  escapeHtml
};

if (typeof window !== 'undefined') window.BeniGo = BeniGo;

export default BeniGo;
