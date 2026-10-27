
import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  auth,
  roleFor,
  waitForUser,
  startSession
} from "./auth-guard.js";

// ========================================
// SEGOND CONSTRUCTION
// CONNEXION CADRES / ADMINISTRATEUR
// SESSION DE 30 MINUTES
// ========================================

// Éléments HTML
const form = document.getElementById("login-form");
const error = document.getElementById("error");
const submit = document.getElementById("submit");

// Durée de session
const SESSION_KEY = "segond_session_expiration";

// Récupérer la page demandée
const params = new URLSearchParams(window.location.search);

const next = params.get("next") === "admin"
  ? "admin"
  : "cadres";

// ========================================
// DESTINATION APRÈS CONNEXION
// ========================================

function destination(role) {
  if (role === "admin" && next === "admin") {
    return "admin.html";
  }

  return "cadres.html";
}

// ========================================
// VÉRIFIER UNE SESSION EXISTANTE
// ========================================

const existingUser = await waitForUser();
const existingRole = roleFor(existingUser);

if (existingRole) {
  const expiration = Number(
    localStorage.getItem(SESSION_KEY)
  );

  // La session existe et n'est pas expirée
  if (
    Number.isFinite(expiration) &&
    expiration > Date.now()
  ) {
    // Un cadre ne peut pas accéder à l'admin
    if (next === "admin" && existingRole !== "admin") {
      error.textContent =
        "Accès refusé : réservé à l'administrateur.";
    } else {
      window.location.replace(
        destination(existingRole)
      );
    }
  } else {
    // Session expirée : déconnexion Firebase
    localStorage.removeItem(SESSION_KEY);
    await signOut(auth);
  }
}

// ========================================
// MESSAGE DE SESSION EXPIRÉE
// ========================================

if (params.get("expired") === "1") {
  error.textContent =
    "Votre session de 30 minutes a expiré. Veuillez vous reconnecter.";
}

// ========================================
// CONNEXION AVEC FIREBASE
// ========================================

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  error.textContent = "";
  submit.disabled = true;

  try {
    // Récupérer les identifiants
    const email = document
      .getElementById("email")
      .value
      .trim();

    const password = document
      .getElementById("password")
      .value;

    // Vérifier les identifiants avec Firebase
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = credential.user;

    // Identifier le rôle
    const role = roleFor(user);

    // Compte inconnu ou non autorisé
    if (!role) {
      await signOut(auth);

      error.textContent =
        "Ce compte n'est pas autorisé à accéder à l'application.";

      return;
    }

    // Empêcher un cadre d'ouvrir l'admin
    if (next === "admin" && role !== "admin") {
      await signOut(auth);

      error.textContent =
        "Accès refusé : cet espace est réservé à l'administrateur.";

      return;
    }

    // ========================================
    // DÉMARRER LA SESSION DE 30 MINUTES
    // ========================================

    startSession();

    // Rediriger vers le bon espace
    window.location.replace(
      destination(role)
    );

  } catch (err) {
    console.error("Erreur de connexion Firebase :", err.code);

    error.textContent =
      "Connexion impossible. Vérifiez votre adresse e-mail et votre mot de passe.";

  } finally {
    submit.disabled = false;
  }
});
