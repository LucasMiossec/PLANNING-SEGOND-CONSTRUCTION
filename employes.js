// === FIREBASE (CDN v11) ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, get, child, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// === CONFIG FIREBASE (Copiée de cadres.js) ===
const firebaseConfig = {
  apiKey: "AIzaSyCe0hFb2nlkye4oEpZiHn3dK1GjEbdEpmE",
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
const planningContainer = document.getElementById("planningContainer");
const periodeSemaine = document.getElementById("periodeSemaine");
const prevSemaineBtn = document.getElementById("prevSemaine");
const nextSemaineBtn = document.getElementById("nextSemaine");

// === VARIABLES GLOBALES ===
let employesParMetier = {};
let planning = {};
let semaineOffset = 0;

// === RETOUR ===
if (retourBtn) {
  retourBtn.addEventListener("click", () => window.location.href = "index.html");
}

// === SYNC TEMPS RÉEL (Logique identique à cadres.js) ===
// On écoute la racine de la DB pour avoir les employés mis à jour instantanément
onValue(ref(db), (snapshot) => {
  const data = snapshot.val() || {};
  employesParMetier = data.employes || {};
  planning = data.planning || {};
  
  // Dès que la DB change, on rafraîchit la liste des employés et le tableau
  chargerEmployes();
  majTable();
});

// === CHARGEMENT DES EMPLOYÉS FILTRÉS ===
function chargerEmployes() {
  const metier = metierInput.value;
  const dateCible = formatDateLocale(new Date());

  employeSelect.innerHTML = '<option value="">-- Sélectionner --</option>';

  if (metier && employesParMetier[metier]) {
    
    const liste = employesParMetier[metier].filter(nom => {
      const fin = planning.finEmploye?.[metier]?.[nom];
      return !fin || fin > dateCible;
    });

    liste.forEach(nom => {
      const o = document.createElement("option");
      o.value = nom;
      o.textContent = nom;
      employeSelect.appendChild(o);
    });
  }
}


// === OUTILS DE DATE ===
function getLundi(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d;
}

function fmtFR(d) {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function majTitreSemaine() {
  const base = new Date();
  base.setDate(base.getDate() + semaineOffset * 7);
  const lundi = getLundi(base);
  const vendredi = new Date(lundi);
  vendredi.setDate(lundi.getDate() + 4);
  
  const fmtAnnee = (d) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  periodeSemaine.textContent = `${fmtAnnee(lundi)} au ${fmtAnnee(vendredi)}`;
}

// === NAVIGATION ===
if (nextSemaineBtn) nextSemaineBtn.addEventListener("click", () => {
  semaineOffset++;
  majTitreSemaine();
  majTable();
});
if (prevSemaineBtn) prevSemaineBtn.addEventListener("click", () => {
  semaineOffset--;
  majTitreSemaine();
  majTable();
});

// === MISE À JOUR DU TABLEAU ===
metierInput.addEventListener("change", () => {
    chargerEmployes();
    majTable();
});
employeSelect.addEventListener("change", majTable);

function majTable() {
  const metier = metierInput.value;
  const employe = employeSelect.value;
  
  if (!metier || !employe) {
    planningContainer.innerHTML = "";
    return;
  }
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

  // En-tête : Lundi, Mardi...
  const jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
  const trHead = document.createElement("tr");
  jours.forEach((j, i) => {
    const th = document.createElement("th");
    const dateJ = new Date(lundi);
    dateJ.setDate(lundi.getDate() + i);
    th.innerHTML = `${j}<br><span style="font-size: 0.85em; font-weight: 400;">${fmtFR(dateJ)}</span>`;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  // Ligne des chantiers
  const trBody = document.createElement("tr");
  for (let i = 0; i < 5; i++) {
    const date = new Date(lundi);
    date.setDate(lundi.getDate() + i);
    const dateStr = formatDateLocale(date);
    const td = document.createElement("td");

    let chantier = planning[dateStr]?.[metier]?.[employe] || "—";
    
    // On applique le même style visuel que dans Cadres pour les congés/arrêts
    if (Array.isArray(chantier)) {
        td.innerHTML = chantier.map(c => `<div class="chantier-item"><b>${c}</b></div>`).join("");
    } else {
        if (typeof chantier === "string" && chantier.includes("CONGÉ")) {
            td.innerHTML = "🌴 CONGÉ";
            td.style.backgroundColor = "rgba(255, 165, 0, 0.2)";
        } else if (typeof chantier === "string" && chantier.includes("ARRÊT")) {
            td.innerHTML = "🚑 ARRÊT";
            td.style.backgroundColor = "rgba(255, 0, 0, 0.2)";
        } else {
            td.innerHTML = chantier !== "—" ? `<b>${chantier}</b>` : "—";
        }
    }
    
    // Style par défaut pour un chantier normal
    if (chantier !== "—" && !String(chantier).includes("CONGÉ") && !String(chantier).includes("ARRÊT")) {
      td.style.backgroundColor = "rgba(182, 0, 0, 0.1)"; 
      td.style.borderBottom = "4px solid #b60000"; 
    }

    trBody.appendChild(td);
  }

  tbody.appendChild(trBody);
  table.appendChild(thead);
  table.appendChild(tbody);
  planningContainer.appendChild(table);
  majTitreSemaine();
}
// === ACCÈS FEUILLE D'HEURES ===
const feuilleHeuresBtn = document.getElementById("goFeuilleHeures");
if (feuilleHeuresBtn) {
  feuilleHeuresBtn.addEventListener("click", () => {
    const metier = metierInput.value;
    const employe = employeSelect.value;

    // passage des données à la page suivante
    localStorage.setItem("metier", metier);
    localStorage.setItem("employe", employe);

    window.location.href = "feuille-heures.html";
  });
}
// === INIT ===
majTitreSemaine();