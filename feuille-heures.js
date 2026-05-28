import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// ================= FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyCe0hFb2nlkye4oEpZiHn3dK1GjEbdEpmE",
  authDomain: "planning-segond.firebaseapp.com",
  databaseURL: "https://planning-segond-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "planning-segond",
  storageBucket: "planning-segond.appspot.com",
  messagingSenderId: "951519078075",
  appId: "1:951519078075:web:1152d3023ed737b8afab9e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ================= DOM =================
const tbody = document.getElementById("tbody");
const totalH = document.getElementById("total-h");
const weekInput = document.getElementById("week-date");
const prevBtn = document.getElementById("prev-week");
const nextBtn = document.getElementById("next-week");
const metierSelect = document.getElementById("metier");
const employeSelect = document.getElementById("employe");

let employesParMetier = {};
let chantiersDisponibles = [];
let planningGlobal = {}; // Pour stocker les dates de fin
let dateCourante = new Date();
const jours = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

// ================= SYNC INITIALE FIREBASE =================
onValue(ref(db), (snap) => {
  const data = snap.val() || {};
  
  // Stockage du planning pour filtrer les anciens employés (comme cadres.js)
  planningGlobal = data.planning || {};

  if (data.chantiers) {
    chantiersDisponibles = Array.isArray(data.chantiers) ? data.chantiers : Object.values(data.chantiers);
    rafraichirSelectsChantiers();
  }

  if (data.employes) {
    employesParMetier = data.employes;
    chargerEmployes(); 
  }
});

// ================= CHARGER EMPLOYÉS (AVEC LOGIQUE CADRES.JS) =================
function chargerEmployes() {
  const metier = metierSelect.value;
  const dateAujourdhui = new Date().toISOString().split('T')[0];

  // 🟢 SAUVEGARDE DE LA VALEUR ACTUELLE
  const employeActuel = employeSelect.value;

  employeSelect.innerHTML = `<option value="">-- Employé --</option>`;

  if (metier && employesParMetier[metier]) {
    let list = Array.isArray(employesParMetier[metier]) 
      ? employesParMetier[metier] 
      : Object.values(employesParMetier[metier]);

    const actifs = list.filter(e => {
      const dateFin = planningGlobal.finEmploye?.[metier]?.[e];
      return !dateFin || dateFin > dateAujourdhui;
    });

    const uniques = [...new Set(actifs)];

    uniques.sort().forEach(e => {
      if (e && e.trim() !== "") {
        const opt = document.createElement("option");
        opt.value = e;
        opt.textContent = e;
        employeSelect.appendChild(opt);
      }
    });
  }

  // 🟢 RESTAURATION DE L’EMPLOYÉ SI IL EXISTE ENCORE
  if (employeActuel) {
    employeSelect.value = employeActuel;
  }
}

// ================= SAUVEGARDE ET CHARGEMENT =================

function sauvegarderDonnees() {
  const emp = employeSelect.value;
  const lundi = getLundi(dateCourante).toISOString().split('T')[0];
  if (!emp || emp === "" || emp === "-- Employé --") return;

  const lignes = [];
  document.querySelectorAll("#tbody tr").forEach(tr => {
    lignes.push({
      jour: tr.dataset.jour,
      date: tr.querySelector(".date-cell")?.textContent || "",
      chantier: tr.querySelector(".chantier").value,
      heures: tr.querySelector(".h").value,
      commentaire: tr.querySelector(".comm-input")?.value || ""
    });
  });
  set(ref(db, `feuilles_heures/${lundi}/${emp}`), lignes);
}

async function chargerDonneesEmploye() {
  const emp = employeSelect.value;
  const lundiDate = getLundi(dateCourante);
  const lundiKey = lundiDate.toISOString().split('T')[0];
  
  if (!emp || emp === "" || emp === "-- Employé --") {
    tbody.innerHTML = "";
    totalH.textContent = "0";
    return;
  }

  const snapshot = await get(ref(db, `feuilles_heures/${lundiKey}/${emp}`));
  const data = snapshot.val();
  
  tbody.innerHTML = "";
  if (data && data.length > 0) {
    data.forEach(ln => restaurerLigne(ln));
  } else {
    jours.forEach((j, i) => {
      const d = new Date(lundiDate);
      d.setDate(lundiDate.getDate() + i);
      ajouterLigne(j, d);
    });
  }
  calculerTotal();
}

// ================= LOGIQUE DU TABLEAU =================

function ajouterLigne(jourNom, dateJour, initData = null) {
  const tr = document.createElement("tr");
  tr.dataset.jour = jourNom;
  
  let dateStr = (dateJour instanceof Date) ? dateJour.toLocaleDateString("fr-FR") : dateJour;

  // AJOUT DES ATTRIBUTS DATA-LABEL POUR LE DESIGN RESPONSIVE
  tr.innerHTML = `
    <td class="jour-label">
      <strong>${jourNom}</strong><br>
      <small class="date-cell">${dateStr}</small>
    </td>
    <td data-label="Chantier :"><select class="chantier"></select></td>
    <td data-label="Heures :"><input type="number" class="h" value="${initData?.heures || 0}" step="0.5" inputmode="decimal"></td>
    <td data-label="Note :"><input type="text" class="comm-input" placeholder="..." value="${initData?.commentaire || ""}"></td>
    <td><button class="del">❌</button></td>
  `;
  
  const sel = tr.querySelector(".chantier");
  remplirChantiers(sel);
  if(initData) sel.value = initData.chantier;

  tr.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("change", () => { calculerTotal(); sauvegarderDonnees(); });
  });
  
  tr.querySelector(".del").addEventListener("click", () => { 
    // AJOUT D'UNE CONFIRMATION POUR ÉVITER LES ERREURS SUR MOBILE
    if(confirm("Supprimer cette ligne ?")) {
      tr.remove(); 
      calculerTotal(); 
      sauvegarderDonnees(); 
    }
  });
  
  const newIndex = jours.indexOf(jourNom);
  const existingRows = Array.from(tbody.querySelectorAll("tr"));
  let inserted = false;
  for (let row of existingRows) {
    if (jours.indexOf(row.dataset.jour) > newIndex) {
      tbody.insertBefore(tr, row);
      inserted = true;
      break;
    }
  }
  if (!inserted) tbody.appendChild(tr);
}

function restaurerLigne(ln) {
    ajouterLigne(ln.jour, ln.date, ln);
}

// ================= OUTILS =================

function getLundi(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const res = new Date(d.setDate(diff));
  res.setHours(0,0,0,0);
  return res;
}

function remplirChantiers(select) {
  select.innerHTML = `<option value="">-- Chantier --</option>`;
  chantiersDisponibles.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    select.appendChild(opt);
  });
}

function rafraichirSelectsChantiers() {
    document.querySelectorAll(".chantier").forEach(sel => {
        const val = sel.value;
        remplirChantiers(sel);
        sel.value = val;
    });
}

function calculerTotal() {
  let total = 0;
  document.querySelectorAll(".h").forEach(i => total += parseFloat(i.value) || 0);
  totalH.textContent = total;
}

// ================= ÉVÉNEMENTS =================

metierSelect.onchange = () => { 
    chargerEmployes(); 
    chargerDonneesEmploye(); 
};

employeSelect.onchange = () => { 
    chargerDonneesEmploye(); 
};

prevBtn.onclick = () => { 
  dateCourante.setDate(dateCourante.getDate() - 7); 
  weekInput.value = dateCourante.toISOString().split('T')[0]; 
  chargerDonneesEmploye(); 
};

nextBtn.onclick = () => { 
  dateCourante.setDate(dateCourante.getDate() + 7); 
  weekInput.value = dateCourante.toISOString().split('T')[0]; 
  chargerDonneesEmploye(); 
};

weekInput.onchange = () => { 
  dateCourante = new Date(weekInput.value); 
  chargerDonneesEmploye(); 
};

document.querySelectorAll(".btn-day").forEach(btn => {
  btn.onclick = () => {
    const jourNom = btn.getAttribute("data-day");
    const lundi = getLundi(dateCourante);
    const indexJour = jours.indexOf(jourNom);
    const dateCible = new Date(lundi);
    dateCible.setDate(lundi.getDate() + indexJour);
    ajouterLigne(jourNom, dateCible);
    sauvegarderDonnees();
  };
});

// ================= EXPORT PDF =================

document.getElementById("btn-pdf").onclick = () => {
  const employe = employeSelect.value || "Employé";
  const dateLundi = getLundi(dateCourante).toLocaleDateString("fr-FR");

  let tableHTML = "";
  document.querySelectorAll("#tbody tr").forEach(tr => {
    const jour = tr.querySelector(".jour-label")?.innerText || "";
    const chantierSel = tr.querySelector(".chantier");
    const chantier = chantierSel.options[chantierSel.selectedIndex]?.text || "";
    const heures = tr.querySelector(".h").value || "0";
    const obs = tr.querySelector(".comm-input").value || "";

    if(heures !== "0" || (chantier !== "" && chantier !== "-- Chantier --")) {
        tableHTML += `
          <tr>
            <td style="border:1px solid #000; padding:8px;">${jour.replace('\n', '<br>')}</td>
            <td style="border:1px solid #000; padding:8px;">${chantier}</td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"><b>${heures}</b></td>
            <td style="border:1px solid #000; padding:8px; font-size:11px;">${obs}</td>
          </tr>
        `;
    }
  });

  const finalHTML = `
    <div style="width:100%; font-family:Arial; padding:10px;">
      <div style="text-align:center; border-bottom:3px solid #b60000; margin-bottom:20px; padding-bottom:10px;">
        <h1 style="color:#b60000; margin:0;">SEGOND CONSTRUCTION</h1>
        <h2 style="margin:5px 0;">FEUILLE D'HEURES HEBDOMADAIRE</h2>
      </div>
      <p><b>EMPLOYÉ :</b> ${employe.toUpperCase()} | <b>SEMAINE DU :</b> ${dateLundi}</p>
      <table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <thead>
          <tr style="background:#b60000; color:#fff;">
            <th style="border:1px solid #000; padding:10px; width:20%;">JOUR</th>
            <th style="border:1px solid #000; padding:10px; width:30%;">CHANTIER</th>
            <th style="border:1px solid #000; padding:10px; width:10%;">H</th>
            <th style="border:1px solid #000; padding:10px; width:40%;">OBSERVATIONS</th>
          </tr>
        </thead>
        <tbody>${tableHTML}</tbody>
      </table>
      <h3 style="text-align:right; color:#b60000; margin-top:20px;">TOTAL : ${totalH.textContent} H</h3>
    </div>
  `;

  localStorage.setItem("planningHTML", finalHTML);
  localStorage.setItem("planningDate", `Heures_${employe}_${dateLundi}`);
  window.open("print.html", "_blank");
};

// Initialisation
weekInput.value = dateCourante.toISOString().split("T")[0];
chargerDonneesEmploye();