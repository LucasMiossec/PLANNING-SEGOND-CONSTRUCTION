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

// === FONCTION DATE LOCALE ===
function formatDateLocale(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// === ÉLÉMENTS DOM ===
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
const ajouterMaladieBtn = document.getElementById("ajouterMaladie");
const supprimerChantierJourBtn = document.getElementById("supprimerChantierJour");
const planningTable = document.getElementById("planningTable");

// === NAVIGATION JOUR ===
let dateCourante = new Date();
dateCourante.setDate(dateCourante.getDate() + 1);
const dateAffichee = document.getElementById("dateAffichee");
const prevJourBtn = document.getElementById("prevJour");
const nextJourBtn = document.getElementById("nextJour");

// === VARIABLES ===
let planning = {};
let employesParMetier = {};
let chantiersDisponibles = [];

// === CHARGEMENT FIREBASE ===
async function chargerDepuisFirebase() {
  const dbRef = ref(db);
  const snapEmp = await get(child(dbRef, "employes"));
  employesParMetier = snapEmp.exists() ? snapEmp.val() : {};
  const snapCh = await get(child(dbRef, "chantiers"));
  chantiersDisponibles = snapCh.exists() ? snapCh.val() : [];
  const snapPl = await get(child(dbRef, "planning"));
  planning = snapPl.exists() ? snapPl.val() : {};
}

// === FONCTIONS UTILES ===
function formaterDateFr(date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function majDateEtTableau() {
  dateAffichee.textContent = formaterDateFr(dateCourante);
  genererTableauPlanning(dateCourante);
}

function chargerListe(select, data) {
  select.innerHTML = '<option value="">-- Sélectionner --</option>';
  data.forEach(item => {
    const o = document.createElement("option");
    o.value = item;
    o.textContent = item;
    select.appendChild(o);
  });
}

function chargerEmployesPourMetier() {
  chargerListe(employeSelect, employesParMetier[metierInput.value] || []);
}
function chargerChantiers() {
  chargerListe(chantierSelect, chantiersDisponibles);
}
metierInput.addEventListener("change", chargerEmployesPourMetier);

// === AJOUT EMPLOYÉ ===
ajouterEmployeBtn.addEventListener("click", async () => {
  const metier = metierInput.value;
  const nom = nouvelEmployeInput.value.trim();
  if (!metier || !nom) return alert("Remplis tous les champs !");
  if (!employesParMetier[metier]) employesParMetier[metier] = [];
  if (employesParMetier[metier].includes(nom)) return alert("Déjà existant !");
  employesParMetier[metier].push(nom);
  await set(ref(db, `employes/${metier}`), employesParMetier[metier]);
  chargerEmployesPourMetier();
});

// === SUPPRESSION EMPLOYÉ ===
supprimerEmployeBtn.addEventListener("click", async () => {
  const metier = metierInput.value;
  const nom = employeSelect.value;
  if (!nom) return alert("Sélectionne un employé à supprimer !");
  employesParMetier[metier] = employesParMetier[metier].filter(e => e !== nom);
  await set(ref(db, `employes/${metier}`), employesParMetier[metier]);
  chargerEmployesPourMetier();
});

// === AJOUT / SUPPRESSION CHANTIER ===
ajouterChantierBtn.addEventListener("click", async () => {
  const nom = nouveauChantierInput.value.trim();
  if (!nom) return alert("Entre un nom !");
  if (chantiersDisponibles.includes(nom)) return alert("Existe déjà !");
  chantiersDisponibles.push(nom);
  await set(ref(db, "chantiers"), chantiersDisponibles);
  chargerChantiers();
});

supprimerChantierBtn.addEventListener("click", async () => {
  const nom = chantierSelect.value;
  if (!nom) return alert("Sélectionne un chantier !");
  chantiersDisponibles = chantiersDisponibles.filter(c => c !== nom);
  await set(ref(db, "chantiers"), chantiersDisponibles);
  chargerChantiers();
});

// === AJOUT AFFECTATION MULTI-CHANTIERS ===
document.getElementById("ajouter").addEventListener("click", async () => {
  const date = formatDateLocale(dateInput.value);
  const metier = metierInput.value;
  const employe = employeSelect.value;
  const chantier = chantierSelect.value;
  if (!date || !metier || !employe || !chantier) return alert("Remplis tous les champs !");
  if (!planning[date]) planning[date] = {};
  if (!planning[date][metier]) planning[date][metier] = {};
  if (!Array.isArray(planning[date][metier][employe])) planning[date][metier][employe] = [];
  if (!planning[date][metier][employe].includes(chantier)) planning[date][metier][employe].push(chantier);
  await set(ref(db, "planning"), planning);
  majDateEtTableau();
});

// === SUPPRESSION D'UN CHANTIER ===
supprimerChantierJourBtn.addEventListener("click", async () => {
  const date = formatDateLocale(dateInput.value);
  const metier = metierInput.value;
  const employe = employeSelect.value;
  const chantier = chantierSelect.value;
  if (!date || !metier || !employe || !chantier) return alert("Remplis tous les champs !");
  const chantiers = planning[date]?.[metier]?.[employe];
  if (!chantiers) return alert("Aucune affectation trouvée !");
  if (Array.isArray(chantiers)) {
    planning[date][metier][employe] = chantiers.filter(c => c !== chantier);
    if (planning[date][metier][employe].length === 0) delete planning[date][metier][employe];
  } else if (chantiers === chantier) delete planning[date][metier][employe];
  await set(ref(db, "planning"), planning);
  alert("🗑️ Chantier supprimé !");
  majDateEtTableau();
});

// === AJOUT CONGÉ ===
ajouterCongeBtn.addEventListener("click", async () => {
  const date = formatDateLocale(dateInput.value);
  const metier = metierInput.value;
  const employe = employeSelect.value;
  const duree = prompt("🗓️ Nombre de jours de congé ?", "1");
  const nbJours = parseInt(duree);
  if (!date || !metier || !employe || isNaN(nbJours)) return alert("Champs invalides !");
  for (let i = 0; i < nbJours; i++) {
    const jour = new Date(date);
    jour.setDate(jour.getDate() + i);
    const jourStr = formatDateLocale(jour);
    if (!planning[jourStr]) planning[jourStr] = {};
    if (!planning[jourStr][metier]) planning[jourStr][metier] = {};
    planning[jourStr][metier][employe] = "CONGÉ 🌴";
  }
  await set(ref(db, "planning"), planning);
  majDateEtTableau();
});

// === AJOUT ARRÊT MALADIE ===
ajouterMaladieBtn.addEventListener("click", async () => {
  const date = formatDateLocale(dateInput.value);
  const metier = metierInput.value;
  const employe = employeSelect.value;
  const duree = prompt("🩹 Nombre de jours d'arrêt maladie ?", "1");
  const nbJours = parseInt(duree);
  if (!date || !metier || !employe || isNaN(nbJours)) return alert("Champs invalides !");
  for (let i = 0; i < nbJours; i++) {
    const jour = new Date(date);
    jour.setDate(jour.getDate() + i);
    const jourStr = formatDateLocale(jour);
    if (!planning[jourStr]) planning[jourStr] = {};
    if (!planning[jourStr][metier]) planning[jourStr][metier] = {};
    planning[jourStr][metier][employe] = "ARRÊT 🚑";
  }
  await set(ref(db, "planning"), planning);
  alert("🚑 Arrêt maladie enregistré !");
  majDateEtTableau();
});

// === TABLEAU ===
function genererTableauPlanning(dateCible) {
  const dateStr = formatDateLocale(dateCible);
  planningTable.innerHTML = "";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  const trHead = document.createElement("tr");
  Object.keys(employesParMetier).forEach(m => {
    const th = document.createElement("th");
    th.textContent = m.toUpperCase();
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  const nb = Math.max(...Object.values(employesParMetier).map(l => l.length || 0));

  for (let i = 0; i < nb; i++) {
    const tr = document.createElement("tr");
    Object.keys(employesParMetier).forEach(m => {
      const td = document.createElement("td");
      const e = employesParMetier[m]?.[i];
      if (e) {
        const ch = planning[dateStr]?.[m]?.[e];
        td.textContent = e;
        if (ch) {
          td.classList.remove("checked", "conge", "maladie");
          const value = Array.isArray(ch) && ch.length === 1 && (ch[0].includes("CONGÉ") || ch[0].includes("ARRÊT"))
            ? ch[0]
            : ch;

          if (Array.isArray(value)) {
            td.classList.add("checked");
            td.textContent += ` → ${value.join(", ")}`;
          } else if (typeof value === "string" && value.includes("CONGÉ")) {
            td.classList.add("conge");
            td.textContent = `${e} 🌴`;
          } else if (typeof value === "string" && value.includes("ARRÊT")) {
            td.classList.add("maladie");
            td.textContent = `${e} 🚑`;
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

// === NAVIGATION ===
nextJourBtn.addEventListener("click", () => { dateCourante.setDate(dateCourante.getDate() + 1); majDateEtTableau(); });
prevJourBtn.addEventListener("click", () => { dateCourante.setDate(dateCourante.getDate() - 1); majDateEtTableau(); });

// === EXPORT / IMPRIMER LE PLANNING ===
document.getElementById("exportPDF").addEventListener("click", () => {
  const win = window.open("print.html", "_blank");
  localStorage.setItem("planningHTML", document.querySelector(".planning-container").innerHTML);
  localStorage.setItem("planningDate", dateAffichee.textContent);
});

// === SYNC FIREBASE ===
onValue(ref(db, "planning"), s => {
  if (s.exists()) {
    planning = s.val();
    majDateEtTableau();
  }
});

// === INIT ===
await chargerDepuisFirebase();
chargerEmployesPourMetier();
chargerChantiers();
majDateEtTableau();
retourBtn.addEventListener("click", () => (window.location.href = "index.html"));
