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

// === FIX DÉCALAGE UTC ===
function formatDateLocale(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// === ÉLÉMENTS DU DOM ===
const retourBtn = document.getElementById("retour");
const metierInput = document.getElementById("metier");
const employeSelect = document.getElementById("employe");
const voirPlanningBtn = document.getElementById("voirPlanning");
const planningContainer = document.getElementById("planningContainer");
const periodeSemaine = document.getElementById("periodeSemaine");
const prevSemaineBtn = document.getElementById("prevSemaine");
const nextSemaineBtn = document.getElementById("nextSemaine");
const exportBtn = document.getElementById("exportPDF"); // ✅ Bouton PDF

// === RETOUR ===
retourBtn.addEventListener("click", () => window.location.href = "index.html");

// === VARIABLES ===
let employesParMetier = {};
let planning = {};
let semaineOffset = 0;

// === FIREBASE LOAD ===
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
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function fmtFR(d) {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function majTitreSemaine() {
  const base = new Date();
  base.setDate(base.getDate() + semaineOffset * 7);
  const lundi = getLundi(base);
  const vendredi = new Date(lundi);
  vendredi.setDate(lundi.getDate() + 4);
  periodeSemaine.textContent = `${fmtFR(lundi)} au ${fmtFR(vendredi)}`;
}

// === NAVIGATION ===
nextSemaineBtn.addEventListener("click", () => {
  semaineOffset++;
  majTitreSemaine();
  majTable();
});
prevSemaineBtn.addEventListener("click", () => {
  semaineOffset--;
  majTitreSemaine();
  majTable();
});

// === EMPLOYÉS ===
function chargerEmployes() {
  const metier = metierInput.value;
  employeSelect.innerHTML = '<option value="">-- Sélectionner --</option>';
  (employesParMetier[metier] || []).forEach(nom => {
    const o = document.createElement("option");
    o.value = nom;
    o.textContent = nom;
    employeSelect.appendChild(o);
  });
}
metierInput.addEventListener("change", chargerEmployes);

// === AFFICHER PLANNING ===
voirPlanningBtn.addEventListener("click", majTable);

function majTable() {
  const metier = metierInput.value;
  const employe = employeSelect.value;
  if (!metier || !employe) return;
  afficherPlanning(employe, metier);
}

function afficherPlanning(employe, metier) {
  planningContainer.innerHTML = "";

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
    const dateStr = formatDateLocale(date);
    const td = document.createElement("td");

    let chantier = planning[dateStr]?.[metier]?.[employe] || "—";
    if (Array.isArray(chantier)) chantier = chantier.join(", ");
    td.textContent = chantier;
    trBody.appendChild(td);
  }

  tbody.appendChild(trBody);
  table.appendChild(thead);
  table.appendChild(tbody);
  planningContainer.appendChild(table);
  majTitreSemaine();
}

// === SYNC TEMPS RÉEL ===
onValue(ref(db, "planning"), snap => {
  if (snap.exists()) {
    planning = snap.val();
    majTable();
  }
});

// === EXPORT / IMPRIMER LE PLANNING ===
if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    const win = window.open("print.html", "_blank");
    localStorage.setItem("planningHTML", document.querySelector(".planning-container").innerHTML);
    localStorage.setItem("planningDate", periodeSemaine.textContent);
  });
}

// === INIT ===
await chargerDepuisFirebase();
majTitreSemaine();
