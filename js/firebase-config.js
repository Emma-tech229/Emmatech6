/* Configuration du projet Firebase de BeniGo.
   Console Firebase > Parametres du projet > Vos applications > Application Web.
   Ces valeurs sont publiques (elles identifient le projet, elles ne donnent pas
   acces aux donnees) : la securite vient des regles Firestore et Storage. */
export const firebaseConfig = {
  apiKey: 'AIzaSyAf1stav5UZtXrOsxJH9LuC78pVbLxNnG4',
  authDomain: 'benigo-578cc.firebaseapp.com',
  projectId: 'benigo-578cc',
  storageBucket: 'benigo-578cc.firebasestorage.app',
  messagingSenderId: '436151357813',
  appId: '1:436151357813:web:147059aee14f54af89033c'
};

export function isConfigured() {
  return Boolean(firebaseConfig.projectId) && !String(firebaseConfig.projectId).startsWith('REMPLACER');
}
