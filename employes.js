// === FIREBASE (CDN v11) ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, get, child, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// === CONFIG FIREBASE ===
const firebaseConfig = {
  apiKey: "TA_CLE_API",
  authDomain: "planning-segond.firebaseapp.com",
  databaseURL: "https://planning-segond-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "planning-segond",
  storageBucket: "planning-segond.appspot.com",
  messagingSenderId: "951519078075",
  appId: "1:951519078075:web:1152d3023ed737b8afab9e"
};

// === INITIALISATION ===
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// === ÉLÉMENTS DU DOM ===
const retourBtn = document.getElementById("retour");
const metierInput = document.getElementById("metier");
const employeSelect = document.getElementById("employe");
const voirPlanningBtn = document.getElementById("voirPlanning");
const planningContainer = document.getElementById("planningContainer");
const periodeSemaine = document.getElementById("periodeSemaine");
const prevSemaineBtn = document.getElementById("prevSemaine");
const nextSemaineBtn = document.getElementById("nextSemaine");

// === RETOUR ACCUEIL ===
retourBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});

// === VARIABLES ===
let employesParMetier = {};
let planning = {};
let semaineOffset = 0; // 0 = semaine actuelle, +1 = suivante, -1 = précédente

// === CHARGEMENT DES DONNÉES ===
async function chargerDepuisFirebase() {
  try {
    const dbRef = ref(db);
    const snapEmp = await get(child(dbRef, "employes"));
    employesParMetier = snapEmp.exists() ? snapEmp.val() : {};

    const snapPl = await get(child(dbRef, "planning"));
    planning = snapPl.exists() ? snapPl.val() : {};
  } catch (e) {
    console.error("⚠️ Erreur Firebase :", e);
  }
}

// === OUTILS DE DATE ===
function getLundi(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dim, 1 = lun, ... 6 = sam
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// "20/10/2025"
function fmtFR(d) {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Met à jour le titre "Semaine du XX/XX/XXXX au YY/YY/YYYY"
function majTitreSemaine() {
  const base = new Date();
  base.setDate(base.getDate() + semaineOffset * 7);

  const lundi = getLundi(base);
  const vendredi = new Date(lundi);
  vendredi.setDate(lundi.getDate() + 4);

  periodeSemaine.textContent = `${fmtFR(lundi)} au ${fmtFR(vendredi)}`;
}

// === NAVIGATION DE SEMAINE ===
nextSemaineBtn.addEventListener("click", () => {
  semaineOffset += 1;           // semaine suivante
  majTitreSemaine();
  if (metierInput.value && employeSelect.value) {
    afficherPlanning(employeSelect.value, metierInput.value);
  }
});

prevSemaineBtn.addEventListener("click", () => {
  semaineOffset -= 1;           // semaine précédente
  majTitreSemaine();
  if (metierInput.value && employeSelect.value) {
    afficherPlanning(employeSelect.value, metierInput.value);
  }
});

// === CHARGEMENT EMPLOYÉS SELON MÉTIER ===
function chargerEmployes() {
  const metier = metierInput.value;
  employeSelect.innerHTML = '<option value="">-- Sélectionner --</option>';
  (employesParMetier[metier] || []).forEach(nom => {
    const option = document.createElement("option");
    option.value = nom;
    option.textContent = nom;
    employeSelect.appendChild(option);
  });
}
metierInput.addEventListener("change", chargerEmployes);

// === AFFICHER LE PLANNING ===
voirPlanningBtn.addEventListener("click", () => {
  const metier = metierInput.value;
  const employe = employeSelect.value;
  if (!metier || !employe) return alert("Sélectionne ton métier et ton prénom !");
  afficherPlanning(employe, metier);
});

function afficherPlanning(employe, metier) {
  planningContainer.innerHTML = "";

  // Base = aujourd'hui + offset de semaines, puis on récupère le lundi
  const base = new Date();
  base.setDate(base.getDate() + semaineOffset * 7);
  const lundi = getLundi(base);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  const jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
  const trHead = document.createElement("tr");
  jours.forEach(j => {
    const th = document.createElement("th");
    th.textContent = j;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const trBody = document.createElement("tr");
  for (let i = 0; i < 5; i++) {
    const date = new Date(lundi);
    date.setDate(lundi.getDate() + i);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD attendue par la DB

    const td = document.createElement("td");
    const chantier = planning[dateStr]?.[metier]?.[employe] || "—";
    td.textContent = chantier;
    trBody.appendChild(td);
  }

  tbody.appendChild(trBody);
  table.appendChild(thead);
  table.appendChild(tbody);
  planningContainer.appendChild(table);

  // MAJ du titre après rendu
  majTitreSemaine();
}

// === SYNCHRONISATION TEMPS RÉEL ===
onValue(ref(db, "planning"), (snapshot) => {
  if (snapshot.exists()) {
    planning = snapshot.val();
    // Si un employé est sélectionné, on rafraîchit la semaine affichée
    if (metierInput.value && employeSelect.value) {
      afficherPlanning(employeSelect.value, metierInput.value);
    } else {
      // sinon on met quand même à jour le titre pour la semaine courante
      majTitreSemaine();
    }
  }
});

// === INITIALISATION ===
await chargerDepuisFirebase();
majTitreSemaine(); // Affiche tout de suite la semaine ACTUELLE (ex: du 20 au 24/10/2025)
