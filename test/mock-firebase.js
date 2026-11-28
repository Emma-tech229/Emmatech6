/* Doublure en memoire des modules Firebase utilises par js/store.js.
   Sert uniquement aux tests : elle reproduit les fonctions appelees, la
   semantique des documents et les contraintes de requete utilisees. */

const documents = new Map();
const accounts = new Map();
const listeners = new Set();
let authUser = null;
let counter = 0;

function notify() {
  listeners.forEach((callback) => callback(authUser));
}

function docPath(segments) {
  return segments.join('/');
}

export function initializeApp(config) {
  return { name: '[mock]', options: config };
}

export function getAuth() {
  return { currentUser: authUser };
}

export function onAuthStateChanged(auth, callback) {
  listeners.add(callback);
  queueMicrotask(() => callback(authUser));
  return () => listeners.delete(callback);
}

export async function createUserWithEmailAndPassword(auth, email, password) {
  if (accounts.has(email)) {
    const error = new Error('email already in use');
    error.code = 'auth/email-already-in-use';
    throw error;
  }
  counter += 1;
  const user = { uid: 'uid_' + counter, email, displayName: null };
  accounts.set(email, { user, password });
  authUser = user;
  notify();
  return { user };
}

export async function signInWithEmailAndPassword(auth, email, password) {
  const record = accounts.get(email);
  if (!record) {
    const error = new Error('user not found');
    error.code = 'auth/user-not-found';
    throw error;
  }
  if (record.password !== password) {
    const error = new Error('wrong password');
    error.code = 'auth/wrong-password';
    throw error;
  }
  authUser = record.user;
  notify();
  return { user: record.user };
}

export async function getIdToken(user) {
  return 'jeton-' + (user && user.uid ? user.uid : 'anonyme');
}

export async function signOut() {
  authUser = null;
  notify();
}

export async function updateProfile(user, data) {
  if (data && data.displayName) user.displayName = data.displayName;
}

export async function deleteUser(user) {
  for (const [email, record] of accounts.entries()) {
    if (record.user.uid === user.uid) accounts.delete(email);
  }
  if (authUser && authUser.uid === user.uid) {
    authUser = null;
    notify();
  }
}

export function getFirestore() {
  return { kind: 'firestore' };
}

export function collection(db, ...segments) {
  return { type: 'collection', path: docPath(segments) };
}

export function doc(db, ...segments) {
  return { type: 'doc', path: docPath(segments), id: segments[segments.length - 1] };
}

export function where(field, op, value) {
  return { type: 'where', field, op, value };
}

export function orderBy(field, direction) {
  return { type: 'orderBy', field, direction: direction || 'asc' };
}

export function query(target, ...constraints) {
  return { type: 'query', target, constraints };
}

function snapshot(id, path) {
  const data = documents.get(path);
  return {
    id,
    ref: { type: 'doc', path, id },
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : JSON.parse(JSON.stringify(data)))
  };
}

export async function getDoc(reference) {
  const id = reference.path.split('/').pop();
  return snapshot(id, reference.path);
}

export async function setDoc(reference, data) {
  documents.set(reference.path, JSON.parse(JSON.stringify(data)));
}

export async function updateDoc(reference, data) {
  const current = documents.get(reference.path);
  if (!current) {
    const error = new Error('No document to update');
    error.code = 'not-found';
    throw error;
  }
  documents.set(reference.path, Object.assign({}, current, JSON.parse(JSON.stringify(data))));
}

export async function addDoc(target, data) {
  counter += 1;
  const id = 'auto_' + counter.toString(36);
  documents.set(target.path + '/' + id, JSON.parse(JSON.stringify(data)));
  return { id, path: target.path + '/' + id };
}

function matches(docData, constraint) {
  if (constraint.op === '==') return docData[constraint.field] === constraint.value;
  if (constraint.op === 'array-contains') {
    const list = docData[constraint.field];
    return Array.isArray(list) && list.indexOf(constraint.value) !== -1;
  }
  throw new Error('Op non geree par la doublure : ' + constraint.op);
}

export async function getDocs(target) {
  const source = target.type === 'query' ? target.target : target;
  const constraints = target.type === 'query' ? target.constraints : [];
  const prefix = source.path + '/';

  let entries = [];
  for (const [path, data] of documents.entries()) {
    if (!path.startsWith(prefix)) continue;
    if (path.slice(prefix.length).includes('/')) continue;
    entries.push({ id: path.slice(prefix.length), data });
  }

  for (const constraint of constraints) {
    if (constraint.type === 'where') entries = entries.filter((e) => matches(e.data, constraint));
  }
  for (const constraint of constraints) {
    if (constraint.type === 'orderBy') {
      entries.sort((a, b) => {
        const first = a.data[constraint.field] || 0;
        const second = b.data[constraint.field] || 0;
        if (first === second) return 0;
        return (first < second ? -1 : 1) * (constraint.direction === 'desc' ? -1 : 1);
      });
    }
  }

  return {
    empty: entries.length === 0,
    size: entries.length,
    docs: entries.map((entry) => snapshot(entry.id, prefix + entry.id))
  };
}

export async function runTransaction(db, handler) {
  const transaction = {
    get: getDoc,
    set: (reference, data) => {
      documents.set(reference.path, JSON.parse(JSON.stringify(data)));
      return Promise.resolve();
    },
    update: async (reference, data) => {
      const current = documents.get(reference.path);
      if (!current) throw new Error('No document to update');
      documents.set(reference.path, Object.assign({}, current, JSON.parse(JSON.stringify(data))));
    },
    delete: async (reference) => documents.delete(reference.path)
  };
  return handler(transaction);
}

export function __reset() {
  documents.clear();
  accounts.clear();
  listeners.clear();
  authUser = null;
  counter = 0;
}
