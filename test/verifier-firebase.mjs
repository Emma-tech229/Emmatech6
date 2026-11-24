/* Verification de la configuration Firebase de BeniGo.
   Lancement : node test/verifier-firebase.mjs
   Avec un compte de test (verifie aussi l ecriture Firestore et le Storage) :
     BENIGO_EMAIL=test@benigo.bj BENIGO_PASSWORD=secret1 node test/verifier-firebase.mjs
   ou : node test/verifier-firebase.mjs --email test@benigo.bj --password secret1

   Le script n utilise que fetch et les API REST de Firebase : aucune
   dependance a installer. Il ne modifie rien, sauf avec un compte de test, ou
   il depose une petite image de verification sous listings/{uid}/ puis la
   supprime. */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const { firebaseConfig, isConfigured } = await import(
  pathToFileURL(path.join(root, 'js', 'firebase-config.js')).href
);

const SDK_VERSION = '10.12.5';
const TIMEOUT = 15000;
const MODULES = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js', 'firebase-storage.js'];
const PLACEHOLDER = /REMPLACER/i;

let failures = 0;
let warnings = 0;
let skipped = 0;

function ok(label, detail) {
  console.log('ok    ' + label + (detail ? ' (' + detail + ')' : ''));
}

function fail(label, detail) {
  failures += 1;
  console.log('ECHEC ' + label + (detail ? ' -> ' + detail : ''));
}

function warn(label, detail) {
  warnings += 1;
  console.log('note  ' + label + (detail ? ' (' + detail + ')' : ''));
}

function skip(label, reason) {
  skipped += 1;
  console.log('saute ' + label + (reason ? ' (' + reason + ')' : ''));
}

function section(title) {
  console.log('\n' + title);
}

async function request(url, options) {
  const response = await fetch(url, Object.assign({ signal: AbortSignal.timeout(TIMEOUT) }, options));
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    body = null;
  }
  return { status: response.status, ok: response.ok, body: body, text: text };
}

function apiError(result) {
  const error = result && result.body && result.body.error;
  if (!error) return 'HTTP ' + result.status + ' ' + String(result.text || '').slice(0, 160);
  const message = error.message || 'erreur';
  const reason = error.details && error.details[0] && error.details[0].reason;
  return 'HTTP ' + result.status + ' ' + message + (reason ? ' [' + reason + ']' : '');
}

function argument(name) {
  const index = process.argv.indexOf('--' + name);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

const email = argument('email') || process.env.BENIGO_EMAIL || '';
const password = argument('password') || process.env.BENIGO_PASSWORD || '';
const key = '?key=' + encodeURIComponent(firebaseConfig.apiKey || '');
const firestoreBase =
  'https://firestore.googleapis.com/v1/projects/' +
  encodeURIComponent(firebaseConfig.projectId) +
  '/databases/(default)/documents';
const storageBase =
  'https://firebasestorage.googleapis.com/v0/b/' + encodeURIComponent(firebaseConfig.storageBucket) + '/o';

/* 1. Champs de configuration -------------------------------------------- */

section('Configuration (js/firebase-config.js)');

if (!isConfigured()) {
  fail('projet Firebase renseigne', 'js/firebase-config.js contient encore les valeurs REMPLACER');
  console.log(
    '\nOuvrez la console Firebase > Parametres du projet > Vos applications >\n' +
      'Application Web, puis copiez les valeurs dans js/firebase-config.js.\n' +
      'Relancez ensuite : node test/verifier-firebase.mjs'
  );
  process.exit(1);
}

const FIELDS = [
  ['apiKey', 'cle API'],
  ['authDomain', 'domaine d authentification'],
  ['projectId', 'identifiant du projet'],
  ['storageBucket', 'bucket Storage'],
  ['appId', 'identifiant de l application'],
  ['messagingSenderId', 'identifiant d envoi']
];

for (const [field, label] of FIELDS) {
  const value = String(firebaseConfig[field] || '');
  if (!value || PLACEHOLDER.test(value)) fail(label + ' renseigne');
  else ok(label + ' renseigne', field === 'apiKey' ? value.slice(0, 6) + '...' : value);
}

if (/\.firebaseapp\.com$/.test(String(firebaseConfig.storageBucket || ''))) {
  warn('bucket Storage', 'format ancien ; la console affiche .firebasestorage.app');
}
if (!/^AIza/.test(String(firebaseConfig.apiKey || ''))) {
  warn('cle API', 'une cle web Firebase commence generalement par AIza');
}
if (failures) {
  console.log('\nCorrigez les champs manquants avant de relancer la verification.');
  process.exit(1);
}

/* 2. SDK servis par Google ---------------------------------------------- */

section('SDK Firebase version ' + SDK_VERSION);

for (const module of MODULES) {
  const url = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/' + module;
  try {
    const result = await request(url);
    if (result.ok) ok(module + ' accessible');
    else fail(module + ' accessible', 'HTTP ' + result.status);
  } catch (error) {
    fail(module + ' accessible', error.message);
  }
}

/* 3. Authentication ----------------------------------------------------- */

section('Firebase Authentication');

let idToken = '';
let uid = '';
let apiKeyOk = false;

try {
  const result = await request(
    'https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri' + key,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'verification@benigo.invalid',
        continueUri: 'http://localhost:3000'
      })
    }
  );
  if (result.ok && result.body) {
    apiKeyOk = true;
    ok('cle API acceptee, Identity Toolkit actif');
    if (result.body.signinMethods) {
      ok('fournisseur email/mot de passe actif', result.body.signinMethods.join(', '));
    }
  } else {
    fail('cle API acceptee, Identity Toolkit actif', apiError(result));
  }
} catch (error) {
  fail('cle API acceptee, Identity Toolkit actif', error.message);
}

/* 4. Firestore --------------------------------------------------------- */

section('Cloud Firestore');

try {
  const result = await request(firestoreBase + '/listings' + key + '&pageSize=1');
  if (result.ok) {
    const count = (result.body && result.body.documents && result.body.documents.length) || 0;
    ok('base Firestore joignable', 'lecture publique de listings (' + count + ' document(s))');
  } else if (result.body && result.body.error && result.body.error.status === 'PERMISSION_DENIED') {
    if (!apiKeyOk) {
      fail('base Firestore joignable', 'cle API refusee, verification impossible');
    } else {
      fail(
        'regles Firestore publiees',
        'lecture de listings refusee : collez firestore.rules dans Firestore > Regles'
      );
    }
  } else if (result.status === 404) {
    fail(
      'base Firestore joignable',
      'base introuvable : creez Firestore Database dans la console, ou verifiez projectId'
    );
  } else {
    fail('base Firestore joignable', apiError(result));
  }
} catch (error) {
  fail('base Firestore joignable', error.message);
}

/* 5. Storage ----------------------------------------------------------- */

section('Cloud Storage');

try {
  const result = await request(storageBase + '?maxResults=1');
  const detail = apiError(result);
  if (result.status === 401 || result.status === 403) {
    ok('bucket Storage joignable', 'existe, acces anonyme refuse comme prevu');
  } else if (result.status === 404) {
    fail(
      'bucket Storage joignable',
      apiKeyOk
        ? 'bucket introuvable : activez Storage, ou verifiez storageBucket'
        : 'bucket introuvable : verifiez la cle API, le bucket et le projectId'
    );
  } else if (result.ok) {
    ok('bucket Storage joignable');
  } else {
    fail('bucket Storage joignable', detail);
  }
} catch (error) {
  fail('bucket Storage joignable', error.message);
}

/* 6. Verification avec un compte de test ------------------------------- */

section('Compte de test et ecritures');

if (!email || !password) {
  skip('connexion du compte de test', 'BENIGO_EMAIL et BENIGO_PASSWORD non definis');
  skip('lecture du profil Firestore', 'aucun compte de test');
  skip('envoi et suppression d une image Storage', 'aucun compte de test');
  console.log(
    '\nPour verifier aussi les regles et le Storage :\n' +
      '  BENIGO_EMAIL=vous@exemple.bj BENIGO_PASSWORD=votre-mot-de-passe node test/verifier-firebase.mjs'
  );
} else {
  try {
    const result = await request(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword' + key,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
      }
    );
    if (result.ok && result.body && result.body.idToken) {
      idToken = result.body.idToken;
      uid = result.body.localId;
      ok('connexion du compte de test', email);
    } else {
      fail('connexion du compte de test', apiError(result));
    }
  } catch (error) {
    fail('connexion du compte de test', error.message);
  }

  if (idToken) {
    const headers = { Authorization: 'Bearer ' + idToken };

    try {
      const result = await request(firestoreBase + '/users/' + encodeURIComponent(uid), { headers: headers });
      if (result.ok) {
        const fields = (result.body && result.body.fields) || {};
        ok('profil Firestore lu', 'users/' + uid + ' (' + Object.keys(fields).join(', ') + ')');
      } else if (result.status === 404) {
        ok('regles Firestore appliquees', 'profil absent de la base');
      } else if (result.body && result.body.error && result.body.error.status === 'PERMISSION_DENIED') {
        fail('lecture du profil Firestore', 'regles Firestore non publiees ou differentes');
      } else {
        fail('lecture du profil Firestore', apiError(result));
      }
    } catch (error) {
      fail('lecture du profil Firestore', error.message);
    }

    const objectName = 'listings/' + uid + '/verification-' + Date.now() + '.jpg';
    const objectUrl = storageBase + '/' + encodeURIComponent(objectName);
    const image = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 255, 217]);

    try {
      const upload = await request(storageBase + '?uploadType=media&name=' + encodeURIComponent(objectName), {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'image/jpeg' }, headers),
        body: image
      });
      if (upload.ok) {
        const download = await request(objectUrl + '?alt=media', { headers: headers });
        if (download.ok) ok('envoi et relecture d une image Storage', objectName);
        else fail('envoi et relecture d une image Storage', apiError(download));

        const removed = await request(objectUrl, { method: 'DELETE', headers: headers });
        if (removed.ok) ok('suppression de l image de verification');
        else warn('suppression de l image de verification', apiError(removed) + ' ; supprimez ' + objectName);
      } else if (upload.status === 403) {
        fail(
          'envoi d une image Storage',
          'refuse par les regles : publiez storage.rules dans Storage > Regles'
        );
      } else if (upload.status === 404) {
        fail('envoi d une image Storage', 'bucket introuvable ou Storage non active');
      } else {
        fail('envoi d une image Storage', apiError(upload));
      }
    } catch (error) {
      fail('envoi d une image Storage', error.message);
    }
  }
}

/* Resume --------------------------------------------------------------- */

console.log('');
if (failures) {
  console.log(failures + ' verification(s) en echec' + (warnings ? ', ' + warnings + ' note(s)' : ''));
  process.exit(1);
}
console.log(
  'Configuration Firebase operationnelle' +
    (skipped ? ' (' + skipped + ' verification(s) sautee(s)' : '') +
    (skipped ? ')' : '') +
    (warnings ? ', ' + warnings + ' note(s)' : '')
);
