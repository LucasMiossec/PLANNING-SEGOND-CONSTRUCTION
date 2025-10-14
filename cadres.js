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
const planningTable = document.getElementById("planningTable");

let planning = {};
let employesParMetier = {};
let chantiersDisponibles = [];

// === CHARGEMENT SÉCURISÉ DU LOCALSTORAGE ===
try {
  planning = JSON.parse(localStorage.getItem("planningSegond")) || {};
  employesParMetier = JSON.parse(localStorage.getItem("employesSegond")) || {
    electricite: ["André", "Christopher", "Kevin", "Ali man", "Rachide", "Gabriel"],
    plomberie: ["Fernando", "Olivier", "Miguel", "Daniel"],
    menuiserie: ["Rémy"],
    peinture: ["Cyriaque", "Carlos", "Kévin", "Denis", "Olivier", "Francesco"],
    maconnerie: ["Rosario", "Gilberto", "Alex", "Jimmy", "Luciano", "Angelo", "Florian", "Simone" ,"Polino"]
  };

  chantiersDisponibles = JSON.parse(localStorage.getItem("chantiersSegond")) || [];
} catch (e) {
  console.warn("⚠️ localStorage bloqué, utilisation de la liste par défaut.");
  planning = {};
  employesParMetier = {
    electricite: ["André", "Christopher", "Kevin", "Ali man", "Rachide", "Gabriel"], 
    plomberie: ["Fernando", "Olivier", "Miguel", "Daniel"],
    menuiserie: ["Rémy"],
    peinture: ["Cyriaque", "Carlos", "Kévin", "Denis", "Olivier", "Francesco"],
    maconnerie: ["Rosario", "Gilberto", "Alex", "Jimmy", "Luciano", "Angelo", "Florian", "Simone"]
  };
  chantiersDisponibles = [];
}

// === SI PAS DE CHANTIERS ENREGISTRÉS, ON RECRÉE TA LISTE ===
if (!Array.isArray(chantiersDisponibles) || chantiersDisponibles.length === 0) {
  chantiersDisponibles = [
    "AF 25/0346 - SEBASTIEN SEGOND OASIS",
    "AF 25/0331 - ECOLE ST CHARLES",
    "AF 24/0276 - VILLA PAOLA",
    "AF 25/0435 - LES CAROUBIERS",
    "AF 25/0424 - CREALTYS SUN PALACE",
    "AF 25/0471 - SUN PALACE",
    "AF 25/0481 - ESCORIAL 1309 - LOT PLOMBERIE",
    "AF 25/0438 - MMM ALDEA SEGOND - BEAU RIVAGE",
    "AF 25/0472 - SIIO - DOCTEUR SCHAU",
    "AF 25/0291 - IUM",
    "DEPANNAGE",
    "AF 25/0677 - ESCORIAL APP 1901 - LOT ELEC",
    "AF25/0610 - SMBP BUDGET TRESOR -2025-1365/S",
    "SAPPA ANTIBES",
    "AF 25/0684 - MME GAZIN",
    "AF 26/0680 - CSM",
    "AF 25/0668 - ESCORIAL APP 1302 - LOT ELEC",
    "AF25/0681 - ESCORIAL APP 414 - LOT ELEC"
  ];

  try {
    localStorage.setItem("chantiersSegond", JSON.stringify(chantiersDisponibles));
    console.log("✅ Liste de chantiers recréée et sauvegardée !");
  } catch (err) {
    console.warn("⚠️ Impossible d’enregistrer les chantiers :", err);
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
ajouterEmployeBtn.addEventListener("click", () => {
  const metier = metierInput.value;
  const nom = nouvelEmployeInput.value.trim();
  if (!nom) return alert("Entre un nom d'employé !");
  if (!employesParMetier[metier]) employesParMetier[metier] = [];
  if (employesParMetier[metier].includes(nom)) return alert("Cet employé existe déjà !");
  employesParMetier[metier].push(nom);
  localStorage.setItem("employesSegond", JSON.stringify(employesParMetier));
  chargerEmployesPourMetier();
  nouvelEmployeInput.value = "";
});

// === SUPPRESSION EMPLOYÉ ===
supprimerEmployeBtn.addEventListener("click", () => {
  const metier = metierInput.value;
  const nom = employeSelect.value;
  if (!nom) return alert("Sélectionne un employé à supprimer !");
  employesParMetier[metier] = employesParMetier[metier].filter(e => e !== nom);
  localStorage.setItem("employesSegond", JSON.stringify(employesParMetier));
  chargerEmployesPourMetier();
});

// === AJOUT / SUPPRESSION CHANTIER ===
ajouterChantierBtn.addEventListener("click", () => {
  const nom = nouveauChantierInput.value.trim();
  if (!nom) return alert("Entre un nom de chantier !");
  if (chantiersDisponibles.includes(nom)) return alert("Ce chantier existe déjà !");
  chantiersDisponibles.push(nom);
  localStorage.setItem("chantiersSegond", JSON.stringify(chantiersDisponibles));
  chargerChantiers();
  nouveauChantierInput.value = "";
});

supprimerChantierBtn.addEventListener("click", () => {
  const nom = chantierSelect.value;
  if (!nom) return alert("Sélectionne un chantier à supprimer !");
  chantiersDisponibles = chantiersDisponibles.filter(c => c !== nom);
  localStorage.setItem("chantiersSegond", JSON.stringify(chantiersDisponibles));
  chargerChantiers();
});

// === AJOUT D’UNE AFFECTATION ===
document.getElementById("ajouter").addEventListener("click", () => {
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

  localStorage.setItem("planningSegond", JSON.stringify(planning));
  genererTableauPlanning();
});

// === GÉNÉRATION DU TABLEAU PLANNING ===
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

  const nbLignes = Math.max(...Object.values(employesParMetier).map(l => l.length));
  for (let i = 0; i < nbLignes; i++) {
    const tr = document.createElement("tr");
    Object.keys(employesParMetier).forEach(metier => {
      const td = document.createElement("td");
      const employe = employesParMetier[metier][i];
      if (employe) {
        const chantierDemain = chantierAffecteDemain(metier, employe);
        td.textContent = employe;

        if (chantierDemain) {
          td.classList.add("checked");
          td.textContent += ` → ${chantierDemain}`;
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

// === Vérifie si l’employé est affecté demain ===
function chantierAffecteDemain(metier, employe) {
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  const dateStr = demain.toISOString().split("T")[0];
  return planning[dateStr] &&
    planning[dateStr][metier] &&
    planning[dateStr][metier][employe]
    ? planning[dateStr][metier][employe]
    : null;
}

// === AU CHARGEMENT ===
chargerEmployesPourMetier();
chargerChantiers();
genererTableauPlanning();

// === BOUTON RETOUR ===
retourBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});
