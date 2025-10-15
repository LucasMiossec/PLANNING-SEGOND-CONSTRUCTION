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

// === RETOUR ACCUEIL ===
retourBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});

let employesParMetier = {};
let planning = {};

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

  const ajd = new Date();
  const premierJour = new Date(ajd.setDate(ajd.getDate() - ajd.getDay() + 1));

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
    const date = new Date(premierJour);
    date.setDate(premierJour.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    const td = document.createElement("td");
    const chantier = planning[dateStr]?.[metier]?.[employe] || "—";
    td.textContent = chantier;
    trBody.appendChild(td);
  }

  tbody.appendChild(trBody);
  table.appendChild(thead);
  table.appendChild(tbody);
  planningContainer.appendChild(table);
}

// === SYNCHRONISATION TEMPS RÉEL ===
onValue(ref(db, "planning"), (snapshot) => {
  if (snapshot.exists()) {
    planning = snapshot.val();
    const metier = metierInput.value;
    const employe = employeSelect.value;
    if (metier && employe) afficherPlanning(employe, metier);
  }
});

await chargerDepuisFirebase();
