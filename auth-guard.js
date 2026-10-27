
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { firebaseConfig, ADMIN_UIDS, CADRE_UIDS } from "./auth-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Durée maximale : 30 minutes
const SESSION_DURATION = 30 * 60 * 1000;
const SESSION_KEY = "segond_session_expiration";

let expirationTimer = null;

export function roleFor(user) {
  if (!user) return null;

  // Vérification des administrateurs
  if (ADMIN_UIDS.includes(user.uid)) {
    return "admin";
  }

  // Vérification des cadres
  if (CADRE_UIDS.includes(user.uid)) {
    return "cadre";
  }

  return null;
}

// Attendre que Firebase retrouve la session
export function waitForUser() {
  return new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(
      auth,
      user => {
        unsubscribe();
        resolve(user);
      },
      () => resolve(null)
    );
  });
}

// Enregistrer le début d'une nouvelle session
export function startSession() {
  const expiration = Date.now() + SESSION_DURATION;
  localStorage.setItem(SESSION_KEY, String(expiration));
  scheduleExpiration(expiration);
}

// Programmer la déconnexion
function scheduleExpiration(expiration) {
  if (expirationTimer !== null) {
    clearTimeout(expirationTimer);
  }

  const remaining = expiration - Date.now();

  if (remaining <= 0) {
    expireSession();
    return;
  }

  expirationTimer = setTimeout(expireSession, remaining);
}

// Déconnecter lorsque les 30 minutes sont écoulées
async function expireSession() {
  localStorage.removeItem(SESSION_KEY);

  try {
    await signOut(auth);
  } finally {
    location.replace("connexion.html?expired=1");
  }
}

// Vérifier les autorisations
export async function requireAccess(space) {
  const user = await waitForUser();
  const role = roleFor(user);

  const allowed =
    role === "admin" ||
    (space === "cadres" && role === "cadre");

  if (!allowed) {
    location.replace(
      "connexion.html?next=" + encodeURIComponent(space)
    );
    return false;
  }

  const expiration = Number(localStorage.getItem(SESSION_KEY));

  // Session absente ou expirée
  if (!Number.isFinite(expiration) || expiration <= Date.now()) {
    await expireSession();
    return false;
  }

  scheduleExpiration(expiration);

  return true;
}

// Déconnexion manuelle
export async function logout() {
  localStorage.removeItem(SESSION_KEY);

  if (expirationTimer !== null) {
    clearTimeout(expirationTimer);
  }

  await signOut(auth);
  location.replace("index.html");
}
