// === FIREBASE (CDN v11) ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, get, set, child, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// === CONFIGURATION FIREBASE ===
const firebaseConfig = {
  apiKey: "TA_CLE_API",
  authDomain: "planning-segond.firebaseapp.com",
  databaseURL: "https://planning-segond-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "planning-segond",
  storageBucket: "planning-segond.appspot.com",
  messagingSenderId: "951519078075",
  appId: "1:951519078075:web:1152d3023ed737b8afab9e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// === ÉLÉMENTS DU DOM ===
const retourBtn = document.getElementById("retour");
const dateInput = document.getElementById("date");
const metierInput = document.getElementById("metier");
const employeSelect = document.getElementById("employe");
const nouvelEmployeInput = document.getElementById("nouvelEmploye");
const ajouterEmployeBtn = document.getElementById("ajouterEmploye");
const supprimerEmployeBtn = document.getElementById("supprimerEmploye");
const chantierSelect = document.getElementById("chantier");
const nouveauChantierInput = document.getElementById("nouveauChantier");
const ajouterChantierBtn = document.getElementById("ajouterChantier");
const supprimerChantierBtn = document.getElementById("supprimerChantier");
const ajouterCongeBtn = document.getElementById("ajouterConge");
const planningTable = document.getElementById("planningTable");

// === VARIABLES ===
let planning = {};
let employesParMetier = {};
let chantiersDisponibles = [];
let majLocale = false;

// === CHARGEMENT INITIAL ===
async function chargerDepuisFirebase() {
  try {
    const dbRef = ref(db);
    const snapEmp = await get(child(dbRef, "employes"));
    employesParMetier = snapEmp.exists() ? snapEmp.val() : {};

    const snapCh = await get(child(dbRef, "chantiers"));
    chantiersDisponibles = snapCh.exists() ? snapCh.val() : [];

    const snapPl = await get(child(dbRef, "planning"));
    planning = snapPl.exists() ? snapPl.val() : {};

  } catch (e) {
    console.warn("⚠️ Erreur lecture Firebase :", e);
  }
}

// === FONCTIONS UTILITAIRES ===
function chargerListe(select, data) {
  select.innerHTML = '<option value="">-- Sélectionner --</option>';
  data.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
}

function chargerEmployesPourMetier() {
  const metier = metierInput.value;
  chargerListe(employeSelect, employesParMetier[metier] || []);
}

function chargerChantiers() {
  chargerListe(chantierSelect, chantiersDisponibles);
}

metierInput.addEventListener("change", chargerEmployesPourMetier);

// === AJOUT EMPLOYÉ ===
ajouterEmployeBtn.addEventListener("click", async () => {
  const metier = metierInput.value;
  const nom = (nouvelEmployeInput.value || "").trim();

  if (!metier) return alert("Choisis d'abord un corps d’état.");
  if (!nom) return alert("Entre un nom d'employé !");
  if (!employesParMetier[metier]) employesParMetier[metier] = [];
  if (employesParMetier[metier].includes(nom)) return alert("Cet employé existe déjà !");

  employesParMetier[metier].push(nom);

  try {
    majLocale = true;
    await set(ref(db, `employes/${metier}`), employesParMetier[metier]);
    localStorage.setItem("employesSegond", JSON.stringify(employesParMetier));
    nouvelEmployeInput.value = "";
    chargerEmployesPourMetier();
    setTimeout(() => majLocale = false, 1000);
  } catch (e) {
    console.error("❌ Échec ajout employé Firebase :", e);
  }
});

// === SUPPRESSION EMPLOYÉ ===
supprimerEmployeBtn.addEventListener("click", async () => {
  const metier = metierInput.value;
  const nom = employeSelect.value;
  if (!nom) return alert("Sélectionne un employé à supprimer !");
  employesParMetier[metier] = employesParMetier[metier].filter(e => e !== nom);

  try {
    majLocale = true;
    await set(ref(db, `employes/${metier}`), employesParMetier[metier]);
    localStorage.setItem("employesSegond", JSON.stringify(employesParMetier));
    chargerEmployesPourMetier();
    setTimeout(() => majLocale = false, 1000);
  } catch (e) {
    console.error("❌ Échec suppression employé Firebase :", e);
  }
});

// === AJOUT / SUPPRESSION CHANTIER ===
ajouterChantierBtn.addEventListener("click", async () => {
  const nom = (nouveauChantierInput.value || "").trim();
  if (!nom) return alert("Entre un nom de chantier !");
  if (chantiersDisponibles.includes(nom)) return alert("Ce chantier existe déjà !");
  chantiersDisponibles.push(nom);

  try {
    majLocale = true;
    await set(ref(db, "chantiers"), chantiersDisponibles);
    localStorage.setItem("chantiersSegond", JSON.stringify(chantiersDisponibles));
    nouveauChantierInput.value = "";
    chargerChantiers();
    setTimeout(() => majLocale = false, 1000);
  } catch (e) {
    console.error("❌ Échec ajout chantier Firebase :", e);
  }
});

supprimerChantierBtn.addEventListener("click", async () => {
  const nom = chantierSelect.value;
  if (!nom) return alert("Sélectionne un chantier à supprimer !");
  chantiersDisponibles = chantiersDisponibles.filter(c => c !== nom);

  try {
    majLocale = true;
    await set(ref(db, "chantiers"), chantiersDisponibles);
    localStorage.setItem("chantiersSegond", JSON.stringify(chantiersDisponibles));
    chargerChantiers();
    setTimeout(() => majLocale = false, 1000);
  } catch (e) {
    console.error("❌ Échec suppression chantier Firebase :", e);
  }
});

// === AJOUT D’UNE AFFECTATION ===
document.getElementById("ajouter").addEventListener("click", async () => {
  const date = dateInput.value;
  const metier = metierInput.value;
  const employe = employeSelect.value;
  const chantier = chantierSelect.value;

  if (!date || !employe || !chantier) {
    alert("Merci de remplir tous les champs !");
    return;
  }

  if (!planning[date]) planning[date] = {};
  if (!planning[date][metier]) planning[date][metier] = {};
  planning[date][metier][employe] = chantier;

  try {
    majLocale = true;
    await set(ref(db, "planning"), planning);
    localStorage.setItem("planningSegond", JSON.stringify(planning));
    genererTableauPlanning();
    setTimeout(() => majLocale = false, 1000);
  } catch (e) {
    console.error("❌ Échec sauvegarde planning Firebase :", e);
  }
});

// === AJOUT CONGÉ ===
ajouterCongeBtn.addEventListener("click", async () => {
  const date = dateInput.value;
  const metier = metierInput.value;
  const employe = employeSelect.value;
  const duree = prompt("🗓️ Nombre de jours de congé ?", "1");

  if (!date || !metier || !employe) {
    alert("Merci de remplir les champs : date, métier et employé !");
    return;
  }

  const nbJours = parseInt(duree);
  if (isNaN(nbJours) || nbJours <= 0) return alert("Durée invalide !");

  for (let i = 0; i < nbJours; i++) {
    const jour = new Date(date);
    jour.setDate(jour.getDate() + i);
    const jourStr = jour.toISOString().split("T")[0];

    if (!planning[jourStr]) planning[jourStr] = {};
    if (!planning[jourStr][metier]) planning[jourStr][metier] = {};
    planning[jourStr][metier][employe] = "CONGÉ 🌴";
  }

  try {
    majLocale = true;
    await set(ref(db, "planning"), planning);
    localStorage.setItem("planningSegond", JSON.stringify(planning));
    alert("✅ Congé enregistré !");
    genererTableauPlanning();
    setTimeout(() => majLocale = false, 1000);
  } catch (e) {
    console.error("❌ Échec ajout congé Firebase :", e);
  }
});

// === GÉNÉRATION DU TABLEAU ===
function genererTableauPlanning() {
  planningTable.innerHTML = "";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  const trHead = document.createElement("tr");
  Object.keys(employesParMetier).forEach(metier => {
    const th = document.createElement("th");
    th.textContent = metier.toUpperCase();
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const nbLignes = Math.max(...Object.values(employesParMetier).map(l => l.length || 0));
  for (let i = 0; i < nbLignes; i++) {
    const tr = document.createElement("tr");
    Object.keys(employesParMetier).forEach(metier => {
      const td = document.createElement("td");
      const employe = employesParMetier[metier]?.[i];
      if (employe) {
        const chantierDemain = chantierAffecteDemain(metier, employe);
        td.textContent = employe;
        if (chantierDemain) {
          if (chantierDemain.includes("CONGÉ")) {
            td.classList.add("conge");
            td.textContent = `${employe} 🌴`;
          } else {
            td.classList.add("checked");
            td.textContent += ` → ${chantierDemain}`;
          }
        }
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  planningTable.appendChild(table);
}

// === VÉRIFICATION AFFECTATION DEMAIN ===
function chantierAffecteDemain(metier, employe) {
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const dateStr = demain.toISOString().split("T")[0];
  return planning[dateStr]?.[metier]?.[employe] || null;
}

// === MISE À JOUR EN TEMPS RÉEL ===
onValue(ref(db, "employes"), (snapshot) => {
  if (snapshot.exists() && !majLocale) {
    employesParMetier = snapshot.val();
    chargerEmployesPourMetier();
    genererTableauPlanning();
  }
});

onValue(ref(db, "chantiers"), (snapshot) => {
  if (snapshot.exists() && !majLocale) {
    chantiersDisponibles = snapshot.val();
    chargerChantiers();
  }
});

onValue(ref(db, "planning"), (snapshot) => {
  if (snapshot.exists() && !majLocale) {
    planning = snapshot.val();
    genererTableauPlanning();
  }
});

// === CHARGEMENT INITIAL ===
await chargerDepuisFirebase();
chargerEmployesPourMetier();
chargerChantiers();
genererTableauPlanning();

// === BOUTON RETOUR ===
retourBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});
