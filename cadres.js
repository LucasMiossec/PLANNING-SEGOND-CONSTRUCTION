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

// === FONCTION DATE STANDARD ===
function formatDateLocale(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// === ELEMENTS DOM ===
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

// === NAVIGATION DATE ===
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

  // Tri AF intelligent
  chantiersDisponibles.sort((a, b) => {
    const numA = parseInt(a.match(/AF\s*\d{2}\/(\d+)/)?.[1] || 99999);
    const numB = parseInt(b.match(/AF\s*\d{2}\/(\d+)/)?.[1] || 99999);
    return numA - numB;
  });
}

// === FORMATAGE DATE FR ===
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

// === MISE À JOUR DES LISTES AVEC FILTRE (FIN EMPLOYÉ/CHANTIER) ===
function chargerEmployesPourMetier() {
  const metier = metierInput.value;
  const dateCible = formatDateLocale(dateCourante);

  const liste = (employesParMetier[metier] || []).filter(e => {
    const fin = planning.finEmploye?.[metier]?.[e];
    return !fin || fin > dateCible;
  });

  chargerListe(employeSelect, liste);
}

function chargerChantiers() {
  const dateCible = formatDateLocale(dateCourante);

  const liste = chantiersDisponibles.filter(c => {
    const fin = planning.finChantier?.[c];
    return !fin || fin > dateCible;
  });

  chargerListe(chantierSelect, liste);
}

// === OUTIL CHARGER LISTE ===
function chargerListe(select, data) {
  select.innerHTML = '<option value="">-- Sélectionner --</option>';
  data.forEach(x => {
    const o = document.createElement("option");
    o.value = x;
    o.textContent = x;
    select.appendChild(o);
  });
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
  nouvelEmployeInput.value = "";
  chargerEmployesPourMetier();
});

// === SUPPRESSION EMPLOYÉ (AVEC DATE DE FIN) ===
supprimerEmployeBtn.addEventListener("click", async () => {
  const metier = metierInput.value;
  const nom = employeSelect.value;
  if (!nom) return alert("Sélectionne un employé à supprimer !");

  const dateFin = formatDateLocale(new Date());

  if (!planning.finEmploye) planning.finEmploye = {};
  if (!planning.finEmploye[metier]) planning.finEmploye[metier] = {};

  planning.finEmploye[metier][nom] = dateFin;

  await set(ref(db, "planning"), planning);

  alert(`ℹ️ ${nom} ne s'affichera plus après le ${dateFin}`);
  majDateEtTableau();
});

// === AJOUT CHANTIER ===
ajouterChantierBtn.addEventListener("click", async () => {
  const nom = nouveauChantierInput.value.trim();
  if (!nom) return alert("Entre un nom !");
  if (chantiersDisponibles.includes(nom)) return alert("Existe déjà !");
  chantiersDisponibles.push(nom);

  chantiersDisponibles.sort((a, b) => {
    const numA = parseInt(a.match(/AF\s*\d{2}\/(\d+)/)?.[1] || 99999);
    const numB = parseInt(b.match(/AF\s*\d{2}\/(\d+)/)?.[1] || 99999);
    return numA - numB;
  });

  await set(ref(db, "chantiers"), chantiersDisponibles);
  nouveauChantierInput.value = "";
  chargerChantiers();
});

// === SUPPRESSION CHANTIER (DATE DE FIN) ===
supprimerChantierBtn.addEventListener("click", async () => {
  const nom = chantierSelect.value;
  if (!nom) return alert("Sélectionne un chantier !");

  const dateFin = formatDateLocale(new Date());

  if (!planning.finChantier) planning.finChantier = {};
  planning.finChantier[nom] = dateFin;

  await set(ref(db, "planning"), planning);

  alert(`ℹ️ Le chantier "${nom}" ne sera plus proposé après le ${dateFin}`);
  majDateEtTableau();
});

// === AJOUT AFFECTATION (MULTI) ===
document.getElementById("ajouter").addEventListener("click", async () => {
  const date = formatDateLocale(dateInput.value);
  const metier = metierInput.value;
  const employe = employeSelect.value;
  const chantier = chantierSelect.value;

  if (!date || !metier || !employe || !chantier)
    return alert("Remplis tous les champs !");

  if (!planning[date]) planning[date] = {};
  if (!planning[date][metier]) planning[date][metier] = {};
  if (!Array.isArray(planning[date][metier][employe]))
    planning[date][metier][employe] = [];

  if (!planning[date][metier][employe].includes(chantier))
    planning[date][metier][employe].push(chantier);

  await set(ref(db, "planning"), planning);
  majDateEtTableau();
});

// === SUPPRIMER CHANTIER POUR 1 JOUR ===
supprimerChantierJourBtn.addEventListener("click", async () => {
  const date = formatDateLocale(dateInput.value);
  const metier = metierInput.value;
  const employe = employeSelect.value;
  const chantier = chantierSelect.value;

  const ch = planning[date]?.[metier]?.[employe];
  if (!ch) return alert("Aucune affectation !");
  
  if (Array.isArray(ch)) {
    planning[date][metier][employe] = ch.filter(x => x !== chantier);
    if (planning[date][metier][employe].length === 0)
      delete planning[date][metier][employe];
  }

  await set(ref(db, "planning"), planning);
  alert("🗑️ Chantier retiré !");
  majDateEtTableau();
});

// === CONGE ===
ajouterCongeBtn.addEventListener("click", async () => {
  const date = formatDateLocale(dateInput.value);
  const metier = metierInput.value;
  const employe = employeSelect.value;

  const nb = parseInt(prompt("🗓️ Nombre de jours ?", "1"));
  if (!nb) return;

  for (let i = 0; i < nb; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() + i);
    const j = formatDateLocale(d);

    if (!planning[j]) planning[j] = {};
    if (!planning[j][metier]) planning[j][metier] = {};
    planning[j][metier][employe] = "CONGÉ 🌴";
  }

  await set(ref(db, "planning"), planning);
  majDateEtTableau();
});

// === MALADIE ===
ajouterMaladieBtn.addEventListener("click", async () => {
  const date = formatDateLocale(dateInput.value);
  const metier = metierInput.value;
  const employe = employeSelect.value;

  const nb = parseInt(prompt("🩹 Jours maladie ?", "1"));
  if (!nb) return;

  for (let i = 0; i < nb; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() + i);
    const j = formatDateLocale(d);

    if (!planning[j]) planning[j] = {};
    if (!planning[j][metier]) planning[j][metier] = {};
    planning[j][metier][employe] = "ARRÊT 🚑";
  }

  await set(ref(db, "planning"), planning);
  majDateEtTableau();
});

// === TABLEAU PLANNING ===
function genererTableauPlanning(dateCible) {
  const dateStr = formatDateLocale(dateCible);
  planningTable.innerHTML = "";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  // 🔥 Étape 1 : construire une liste ACTIVE et COMPACTE
  let actifs = {};
  Object.keys(employesParMetier).forEach(m => {
    actifs[m] = (employesParMetier[m] || []).filter(nom => {
      const fin = planning.finEmploye?.[m]?.[nom];
      return !fin || fin > dateStr;
    });
  });

  // === EN-TÊTES ===
  const trH = document.createElement("tr");
  Object.keys(actifs).forEach(m => {
    const th = document.createElement("th");
    th.textContent = m.toUpperCase();
    trH.appendChild(th);
  });
  thead.appendChild(trH);

  // === Nombre de lignes basé sur la LISTE ACTIVE ===
  const nb = Math.max(...Object.values(actifs).map(L => L.length));

  // === LIGNES ===
  for (let i = 0; i < nb; i++) {
    const tr = document.createElement("tr");

    Object.keys(actifs).forEach(m => {
      const td = document.createElement("td");
      const e = actifs[m][i]; // 🔥 COMPACT, SANS TROU

      if (!e) {
        tr.appendChild(td);
        return;
      }

      const ch = planning[dateStr]?.[m]?.[e];

      if (!ch) {
        td.textContent = e;
      } else {
        td.classList.add("checked");

        if (Array.isArray(ch)) {
          td.innerHTML = `<strong>${e}</strong><br>${ch.join("<br>")}`;
        } else if (typeof ch === "string" && ch.includes("CONGÉ")) {
          td.classList.add("conge");
          td.innerHTML = `<strong>${e}</strong><br>CONGÉ 🌴`;
        } else if (typeof ch === "string" && ch.includes("ARRÊT")) {
          td.classList.add("maladie");
          td.innerHTML = `<strong>${e}</strong><br>ARRÊT 🚑`;
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
nextJourBtn.addEventListener("click", () => {
  dateCourante.setDate(dateCourante.getDate() + 1);
  majDateEtTableau();
});
prevJourBtn.addEventListener("click", () => {
  dateCourante.setDate(dateCourante.getDate() - 1);
  majDateEtTableau();
});

// === IMPRIMER / EXPORT PDF ===
document.getElementById("exportPDF").addEventListener("click", () => {
  localStorage.setItem("planningHTML", document.querySelector(".planning-container").innerHTML);
  localStorage.setItem("planningDate", dateAffichee.textContent);

  const dateISO = dateCourante.toISOString().split("T")[0];
  localStorage.setItem("planningDateISO", dateISO);

  window.open("print.html", "_blank");
});

// === FIREBASE SYNC ===
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
