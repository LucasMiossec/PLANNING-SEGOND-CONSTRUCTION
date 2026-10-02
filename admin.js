import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// ================= CONFIGURATION FIREBASE =================
const firebaseConfig = {
  apiKey: "AIzaSyCe0hFb2nlkye4oEpZiHn3dK1GjEbdEpmE",
  authDomain: "planning-segond.firebaseapp.com",
  databaseURL: "https://planning-segond-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "planning-segond",
  storageBucket: "planning-segond.appstop.com",
  messagingSenderId: "951519078075",
  appId: "1:951519078075:web:1152d3023ed737b8afab9e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ================= DOM =================
const weekInput = document.getElementById("week-date");
const weekRangeSpan = document.getElementById("week-range");
const prevBtn = document.getElementById("prev-week");
const nextBtn = document.getElementById("next-week");
const refreshBtn = document.getElementById("btn-refresh");
const printBtn = document.getElementById("btn-print-admin");
const printMonthBtn = document.getElementById("btn-print-month");
const dashboardContainer = document.getElementById("dashboard-container");
const detailsContainer = document.getElementById("details-container");

let dateCourante = new Date();
let moisAfficheDate = new Date(); 
let employesParMetier = {};
let planningGlobal = {};
let feuillesHeuresGlobal = {}; 

// ================= OUTILS DATE =================
function getLundi(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const res = new Date(d.setDate(diff));
  res.setHours(0,0,0,0);
  return res;
}

function formatDateISO(d) {
  return d.toISOString().split('T')[0];
}

function formatDateFR(d) {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function extractEmpName(empItem) {
  if (!empItem) return "";
  if (typeof empItem === "string") return empItem.trim();
  if (typeof empItem === "object") {
    return (empItem.nom || empItem.name || empItem.prenom || Object.values(empItem)[0] || "").toString().trim();
  }
  return String(empItem).trim();
}

function getStatutJourAbsence(emp, metier, dateISO) {
  if (!planningGlobal) return null;
  const affectation = planningGlobal[dateISO]?.[metier]?.[emp] || planningGlobal[dateISO]?.[emp];
  
  if (typeof affectation === "string") {
    const aff = affectation.toUpperCase();
    if (aff.includes("CONGÉ") || aff.includes("CONGE") || aff.includes("ARRÊT") || aff.includes("ARRET") || aff.includes("MALADIE")) {
      return "ABS";
    }
  }
  return null;
}

function getHeuresAbsence(emp, metier, lundiKey) {
  let hConge = 0;
  let hMaladie = 0;
  if (!planningGlobal) return { hConge, hMaladie };

  const lundi = new Date(lundiKey);
  for (let i = 0; i < 7; i++) {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    const day = d.getDay();
    if (day === 0 || day === 6) continue;

    const dateKey = formatDateISO(d);
    const heuresJour = (day === 5) ? 7 : 8;
    const affectation = planningGlobal[dateKey]?.[metier]?.[emp] || planningGlobal[dateKey]?.[emp];

    if (typeof affectation === "string") {
      const aff = affectation.toUpperCase();
      if (aff.includes("CONGÉ") || aff.includes("CONGE")) hConge += heuresJour;
      else if (aff.includes("ARRÊT") || aff.includes("ARRET") || aff.includes("MALADIE")) hMaladie += heuresJour;
    }
  }
  return { hConge, hMaladie };
}

function getLignesEmployeSemaine(FH_Semaine, empKey, empName) {
  if (!FH_Semaine) return [];
  let dataEmp = FH_Semaine[empKey] || FH_Semaine[empName];
  if (!dataEmp) {
    const foundKey = Object.keys(FH_Semaine).find(k => k && k.trim().toLowerCase() === empName.trim().toLowerCase());
    if (foundKey) dataEmp = FH_Semaine[foundKey];
  }
  return Array.isArray(dataEmp) ? dataEmp : (dataEmp ? Object.values(dataEmp) : []);
}

// ================= SYNC ET CHARGEMENT =================
onValue(ref(db), (snap) => {
  const data = snap.val() || {};
  employesParMetier = data.employes || {};
  planningGlobal = data.planning || {};
  feuillesHeuresGlobal = data.feuilles_heures || {}; 

  chargerDonneesSemaine();
  chargerRecapMensuelAdmin();
});

async function chargerDonneesSemaine() {
  const lundiDate = getLundi(dateCourante);
  const lundiKey = formatDateISO(lundiDate);
  if (weekInput) weekInput.value = lundiKey;

  const dimancheDate = new Date(lundiDate);
  dimancheDate.setDate(lundiDate.getDate() + 6);

  if (weekRangeSpan) {
    weekRangeSpan.textContent = `(Du Lundi ${formatDateFR(lundiDate)} au Dimanche ${formatDateFR(dimancheDate)})`;
  }

  const feuillesHeures = feuillesHeuresGlobal[lundiKey] || {};

  genererDashboard(feuillesHeures, lundiKey);
  genererDetails(feuillesHeures, lundiKey);
}

// ================= HELPERS RÉCAP MENSUEL =================
const JOURS_SEMAINE = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

function formatDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getFeuillesSemaine(lundiDate) {
  return feuillesHeuresGlobal[formatDateLocal(lundiDate)]
      || feuillesHeuresGlobal[formatDateISO(lundiDate)]
      || {};
}

function heuresParJour(lignes, lundiDate) {
  const map = {};
  lignes.forEach(l => {
    if (!l) return;
    const h = parseFloat(l.heures) || 0;
    const idx = JOURS_SEMAINE.indexOf(l.jour);
    if (!h || idx === -1) return;
    const d = new Date(lundiDate);
    d.setDate(lundiDate.getDate() + idx);
    const k = formatDateLocal(d);
    map[k] = (map[k] || 0) + h;
  });
  return map;
}

// ================= RÉCAPITULATIF MENSUEL =================
function chargerRecapMensuelAdmin() {
  const tableContainer = document.getElementById("monthRecapTable");
  const labelMois = document.getElementById("currentMonthLabel");
  if (!tableContainer) return;

  const year = moisAfficheDate.getFullYear();
  const month = moisAfficheDate.getMonth(); 
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  
  if (labelMois) {
    labelMois.innerText = `${monthNames[month]} ${year}`.toUpperCase();
  }

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalJoursMois = lastDayOfMonth.getDate();

  const toLocalISO = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  let semainesBlocs = [];
  let currSem = null;
  const joursLettres = ["D", "L", "M", "M", "J", "V", "S"];

  for (let day = 1; day <= totalJoursMois; day++) {
    const dObj = new Date(year, month, day);
    const numSem = getWeekNumber(dObj);
    const jsDay = dObj.getDay();
    const letter = joursLettres[jsDay];
    const isWeekend = (jsDay === 0 || jsDay === 6);

    if (!currSem || currSem.numSem !== numSem) {
      currSem = { numSem: numSem, jours: [] };
      semainesBlocs.push(currSem);
    }

    currSem.jours.push({
      dObj: dObj,
      numDay: day,
      letterDay: letter,
      isWeekend: isWeekend,
      dateISO: toLocalISO(dObj),
      dateFR: dObj.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
    });
  }

  let headerSemainesHTML = "";
  let headerJoursLettresHTML = "";
  let headerJoursNumHTML = "";

  semainesBlocs.forEach(sem => {
    headerSemainesHTML += `<th class="th-sem" colspan="${sem.jours.length}" style="border:1px solid #334155; padding:4px; text-align:center; background:#0f172a; color:#10b981;">SEMAINE ${sem.numSem}</th>`;

    sem.jours.forEach(j => {
      const bgHead = j.isWeekend ? "#334155" : "#1e293b";
      const colorHead = j.isWeekend ? "#f1f5f9" : "#94a3b8";

      headerJoursLettresHTML += `<th class="th-day${j.isWeekend ? ' we' : ''}" style="border:1px solid #334155; padding:3px; text-align:center; min-width:22px; background:${bgHead}; color:${colorHead}; font-weight:bold;">${j.letterDay}</th>`;
      headerJoursNumHTML += `<th class="th-day${j.isWeekend ? ' we' : ''}" style="border:1px solid #334155; padding:3px; text-align:center; min-width:22px; background:${bgHead}; color:${colorHead}; font-weight:normal;">${j.numDay}</th>`;
    });
  });

  let bodyHTML = "";

  Object.keys(employesParMetier).forEach(metier => {
    let rawEmployes = employesParMetier[metier];
    if (!rawEmployes) return;

    let entries = typeof rawEmployes === "object" ? Object.entries(rawEmployes) : rawEmployes.map(e => [e, e]);

    entries = entries.filter(([empKey, empItem]) => {
      const empName = extractEmpName(empItem);
      if (!empName) return false;
      const dateFin = planningGlobal.finEmploye?.[metier]?.[empName] || planningGlobal.finEmploye?.[empName];
      return !dateFin || dateFin >= toLocalISO(firstDayOfMonth);
    });

    if (entries.length === 0) return;

    const totalCols = totalJoursMois + 2;

    bodyHTML += `
      <tr class="row-metier" style="background:#b60000; color:#fff; font-weight:bold;">
        <td class="td-metier" colspan="${totalCols}" style="padding:5px 8px; border:1px solid #991b1b; text-transform:uppercase; text-align:left; font-size:11px;">${metier}</td>
      </tr>
    `;

    entries.forEach(([empKey, empItem]) => {
      const empName = extractEmpName(empItem);
      if (!empName) return;

      let empRowHTML = `<td class="td-emp" style="border:1px solid #334155; padding:4px 8px; font-weight:bold; background:#0f172a; color:#f8fafc; position:sticky; left:0; z-index:2;">${empName}</td>`;
      let totalMoisEmp = 0;

      semainesBlocs.forEach(sem => {
        sem.jours.forEach(j => {
          const lundiDuJour = getLundi(j.dObj);
          const FH_Semaine = getFeuillesSemaine(lundiDuJour);
          const lignes = getLignesEmployeSemaine(FH_Semaine, empKey, empName);
          const valH = heuresParJour(lignes, lundiDuJour)[j.dateISO] || 0;
          
          const statutAbsence = getStatutJourAbsence(empName, metier, j.dateISO);

          let txtDisplay = "";
          let textStyle = "color:#475569;";
          let extraClass = "";

          if (statutAbsence === "ABS") {
            txtDisplay = "ABS";
            textStyle = "font-weight:bold; color:#fbbf24;";
            extraClass = " abs";
          } else if (valH > 0) {
            totalMoisEmp += valH;
            txtDisplay = valH;
            textStyle = "font-weight:bold; color:#10b981;";
            extraClass = " on";
          }

          const bgCol = j.isWeekend ? "#1e293b" : "#0f172a";

          empRowHTML += `<td class="td-h${j.isWeekend ? ' we' : ''}${extraClass}" style="border:1px solid #334155; text-align:center; padding:3px 1px; background:${bgCol}; ${textStyle}">${txtDisplay}</td>`;
        });
      });

      empRowHTML += `<td class="td-total" style="border:1px solid #334155; text-align:center; font-weight:bold; background:#1e293b; color:#f8fafc; padding:4px;">${totalMoisEmp} h</td>`;

      bodyHTML += `<tr>${empRowHTML}</tr>`;
    });
  });

  tableContainer.innerHTML = `
    <thead>
      <tr>
        <th class="th-emp" rowspan="3" style="border:1px solid #334155; padding:6px; text-align:left; background:#0f172a; color:#fff; position:sticky; left:0; z-index:3; width:130px;">EMPLOYÉ</th>
        ${headerSemainesHTML}
        <th class="th-total" rowspan="3" style="border:1px solid #334155; padding:6px; text-align:center; background:#0f172a; color:#fff; width:50px;">TOTAL</th>
      </tr>
      <tr>${headerJoursLettresHTML}</tr>
      <tr>${headerJoursNumHTML}</tr>
    </thead>
    <tbody>
      ${bodyHTML}
    </tbody>
  `;
}

// ================= 1. DASHBOARD SYNTHÉTIQUE =================
function genererDashboard(feuillesHeures, lundiKey) {
  dashboardContainer.innerHTML = "";

  const metiers = Object.keys(employesParMetier);
  if (metiers.length === 0) {
    dashboardContainer.innerHTML = `<p class="empty-msg">Aucun corps d'état trouvé.</p>`;
    return;
  }

  metiers.forEach(metier => {
    const rawList = employesParMetier[metier] || {};
    const entries = typeof rawList === "object" ? Object.entries(rawList) : rawList.map(e => [e, e]);

    let listNames = [];

    entries.forEach(([empKey, empItem]) => {
      const emp = extractEmpName(empItem);
      if (!emp) return;

      const dateFin = planningGlobal.finEmploye?.[metier]?.[emp] || planningGlobal.finEmploye?.[emp];
      if (!dateFin || dateFin >= lundiKey) {
        listNames.push({ key: empKey, name: emp, item: empItem });
      }
    });

    if (listNames.length === 0) return;

    const groupDiv = document.createElement("div");
    groupDiv.className = "metier-group";

    let tableRowsHTML = "";

    listNames.sort((a, b) => a.name.localeCompare(b.name)).forEach(({ key, name, item }) => {
      const lignesEmp = getLignesEmployeSemaine(feuillesHeures, key, name);
      let totalH = 0;

      lignesEmp.forEach(l => {
        if (l) totalH += parseFloat(l.heures) || 0;
      });

      const { hConge, hMaladie } = getHeuresAbsence(name, metier, lundiKey);
      const totalAvecAbsences = totalH + hConge + hMaladie;

      let statusClass = "status-white";
      let statusText = "Non rempli (0h)";

      if (totalAvecAbsences >= 39) {
        statusClass = "status-green";
        statusText = "Complété";
      } else if (totalAvecAbsences > 0) {
        statusClass = "status-yellow";
        statusText = "En cours";
      }

      let detailsAbsence = "";
      if (hConge > 0 || hMaladie > 0) {
        let abs = [];
        if (hConge > 0) abs.push(`${hConge}h congé 🌴`);
        if (hMaladie > 0) abs.push(`${hMaladie}h maladie 🚑`);
        detailsAbsence = `<br><small style="color: #94a3b8; font-weight: normal;">(${abs.join(", ")})</small>`;
      }

      tableRowsHTML += `
        <tr>
          <td class="emp-name"><b>${name}</b>${detailsAbsence}</td>
          <td class="text-center"><b>${totalH} h</b></td>
          <td class="text-center"><span class="status-badge ${statusClass}">${statusText}</span></td>
        </tr>
      `;
    });

    groupDiv.innerHTML = `
      <div class="metier-header">${metier.toUpperCase()}</div>
      <table class="dashboard-table">
        <thead>
          <tr>
            <th>Employé</th>
            <th class="text-center">Total Heures</th>
            <th class="text-center">Statut</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHTML}
        </tbody>
      </table>
    `;

    dashboardContainer.appendChild(groupDiv);
  });
}

// ================= 2. DÉTAILS DES FEUILLES D'HEURES =================
function genererDetails(feuillesHeures, lundiKey) {
  detailsContainer.innerHTML = "";

  let tousLesEmployesActifs = [];
  Object.keys(employesParMetier).forEach(metier => {
    let rawList = employesParMetier[metier] || {};
    let entries = typeof rawList === "object" ? Object.entries(rawList) : rawList.map(e => [e, e]);

    entries.forEach(([empKey, item]) => {
      const e = extractEmpName(item);
      if (!e) return;
      const dateFin = planningGlobal.finEmploye?.[metier]?.[e] || planningGlobal.finEmploye?.[e];
      if (!dateFin || dateFin >= lundiKey) {
        tousLesEmployesActifs.push({ empKey, emp: e, metier, item });
      }
    });
  });

  if (tousLesEmployesActifs.length === 0) {
    detailsContainer.innerHTML = `<div class="card empty-card">Aucun employé actif pour cette semaine.</div>`;
    return;
  }

  let auMoinsUneFeuille = false;

  tousLesEmployesActifs.sort((a,b) => a.emp.localeCompare(b.emp)).forEach(({ empKey, emp, metier, item }) => {
    const lignes = getLignesEmployeSemaine(feuillesHeures, empKey, emp);
    let totalH = 0;

    let rowsHTML = "";
    lignes.forEach(ln => {
      if (!ln) return;
      const h = parseFloat(ln.heures) || 0;
      if (h > 0 || (ln.chantier && ln.chantier !== "")) {
        totalH += h;
        rowsHTML += `
          <tr>
            <td><b>${ln.jour || ""}</b> <small>(${ln.date || ""})</small></td>
            <td>${ln.chantier || "-"}</td>
            <td class="text-center"><b>${ln.heures || 0} h</b></td>
            <td>${ln.commentaire || ""}</td>
          </tr>
        `;
      }
    });

    const { hConge, hMaladie } = getHeuresAbsence(emp, metier, lundiKey);

    if (rowsHTML !== "" || hConge > 0 || hMaladie > 0) {
      auMoinsUneFeuille = true;
      const card = document.createElement("div");
      card.className = "card-emp";

      let absInfo = [];
      if (hConge > 0) absInfo.push(`${hConge}h Congé 🌴`);
      if (hMaladie > 0) absInfo.push(`${hMaladie}h Maladie 🚑`);
      const absText = absInfo.length > 0 ? ` | ${absInfo.join(" - ")}` : "";

      card.innerHTML = `
        <div class="card-header">
          <h3>👤 ${emp}</h3>
          <span class="total-badge">Total Travaillé : ${totalH} H${absText}</span>
        </div>
        <table class="detail-table">
          <thead>
            <tr>
              <th style="width:20%;">Jour</th>
              <th style="width:40%;">Chantier</th>
              <th style="width:10%; text-align:center;">H</th>
              <th style="width:30%;">Observations</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML || '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">Congé / Arrêt maladie enregistré sur le planning</td></tr>'}
          </tbody>
        </table>
      `;
      detailsContainer.appendChild(card);
    }
  });

  if (!auMoinsUneFeuille) {
    detailsContainer.innerHTML = `<div class="card empty-card" style="padding:20px; background:#1e293b; border-radius:8px; text-align:center;">Aucune feuille d'heures remplie pour les employés actifs cette semaine.</div>`;
  }
}

// ================= ÉVÉNEMENTS DE NAVIGATION & IMPRESSION =================
if (prevBtn) {
  prevBtn.onclick = () => {
    dateCourante.setDate(dateCourante.getDate() - 7);
    chargerDonneesSemaine();
  };
}

if (nextBtn) {
  nextBtn.onclick = () => {
    dateCourante.setDate(dateCourante.getDate() + 7);
    chargerDonneesSemaine();
  };
}

if (weekInput) {
  weekInput.onchange = () => {
    if (weekInput.value) {
      const parts = weekInput.value.split('-');
      dateCourante = new Date(parts[0], parts[1] - 1, parts[2]);
      chargerDonneesSemaine();
    }
  };
}

if (refreshBtn) {
  refreshBtn.onclick = () => chargerDonneesSemaine();
}

// ================= IMPRESSION =================
function remplirEnteteImpression(mode) {
  const titre = document.getElementById("ph-title");
  const sub = document.getElementById("ph-sub");
  const date = document.getElementById("ph-date");

  if (mode === "month") {
    const label = document.getElementById("currentMonthLabel")?.innerText || "";
    if (titre) titre.textContent = "Récapitulatif mensuel des heures";
    if (sub) sub.textContent = label;
  } else {
    const lundi = getLundi(dateCourante);
    const dimanche = new Date(lundi);
    dimanche.setDate(lundi.getDate() + 6);
    if (titre) titre.textContent = `Suivi des heures — Semaine ${getWeekNumber(lundi)}`;
    if (sub) sub.textContent = `Du lundi ${formatDateFR(lundi)} au dimanche ${formatDateFR(dimanche)}`;
  }
  if (date) {
    date.textContent = "Imprimé le " + new Date().toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }
}

function lancerImpression(mode) {
  document.body.classList.remove("print-week-active", "print-month-active");
  document.body.classList.add(mode === "month" ? "print-month-active" : "print-week-active");
  remplirEnteteImpression(mode);
  window.print();
}

if (printBtn) printBtn.onclick = () => lancerImpression("week");
if (printMonthBtn) printMonthBtn.onclick = () => lancerImpression("month");

window.addEventListener("afterprint", () => {
  document.body.classList.remove("print-week-active", "print-month-active");
});

document.addEventListener("DOMContentLoaded", () => {
  const prevMonthBtn = document.getElementById("prevMonthBtn");
  const nextMonthBtn = document.getElementById("nextMonthBtn");

  if (prevMonthBtn) {
    prevMonthBtn.onclick = () => {
      moisAfficheDate.setMonth(moisAfficheDate.getMonth() - 1);
      chargerRecapMensuelAdmin();
    };
  }

  if (nextMonthBtn) {
    nextMonthBtn.onclick = () => {
      moisAfficheDate.setMonth(moisAfficheDate.getMonth() + 1);
      chargerRecapMensuelAdmin();
    };
  }
});