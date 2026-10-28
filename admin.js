import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue, remove, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// ================= CONFIGURATION FIREBASE =================
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
let bonsInterventionGlobal = {};
let codesPinEmployes = {};

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
  bonsInterventionGlobal = data.bons_intervention?.items || {};
  codesPinEmployes = data.codes_pin_employes || {};

  // Actualisation du tableau des heures
  chargerDonneesSemaine();

  // Actualisation du récapitulatif mensuel
  chargerRecapMensuelAdmin();

  // Actualisation des bons d'intervention
  afficherBI();

  // 🔐 CORRECTION : affichage des salariés dans Accès employés
  afficherAccesEmployes();
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
  document.body.classList.remove("print-week-active", "print-month-active", "print-bi-active");
  document.body.classList.add(mode === "month" ? "print-month-active" : "print-week-active");
  remplirEnteteImpression(mode);
  window.print();
}

if (printBtn) printBtn.onclick = () => lancerImpression("week");
if (printMonthBtn) printMonthBtn.onclick = () => lancerImpression("month");

window.addEventListener("afterprint", () => {
  document.body.classList.remove("print-week-active", "print-month-active", "print-bi-active");
});

const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");

if (prevMonthBtn) {
  prevMonthBtn.addEventListener("click", () => {
    moisAfficheDate.setDate(1);
    moisAfficheDate.setMonth(moisAfficheDate.getMonth() - 1);
    chargerRecapMensuelAdmin();
  });
}

if (nextMonthBtn) {
  nextMonthBtn.addEventListener("click", () => {
    moisAfficheDate.setDate(1);
    moisAfficheDate.setMonth(moisAfficheDate.getMonth() + 1);
    chargerRecapMensuelAdmin();
  });
}

// ================= ONGLETS =================
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tab-panel").forEach(p => { p.hidden = (p.id !== "tab-" + btn.dataset.tab); });
  });
});

// ================= BONS D'INTERVENTION =================
const biListe = document.getElementById("bi-liste");
const biSearch = document.getElementById("bi-search");
const biCount = document.getElementById("biCount");
const biModal = document.getElementById("bi-modal");
const biDetail = document.getElementById("bi-detail");

// Échappe le texte saisi par les employés avant de l'insérer dans le HTML
function escHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function safeImg(src) {
  return typeof src === "string" && src.startsWith("data:image/") ? src : "";
}

function dateAppelFR(s) {
  if (!s) return "-";
  const [y, m, d] = String(s).split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
}

function dateHeureFR(s) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function afficherBI() {
  if (!biListe) return;

  const tous = Object.values(bonsInterventionGlobal)
    .filter(Boolean)
    .sort((a, b) => String(b.numero).localeCompare(String(a.numero)));

  if (biCount) biCount.textContent = tous.length ? `(${tous.length})` : "";

  const q = (biSearch?.value || "").trim().toLowerCase();
  const liste = !q ? tous : tous.filter(bi =>
    [bi.numero, bi.client, bi.adresse, bi.intervenant, bi.motif, bi.tel]
      .some(v => String(v || "").toLowerCase().includes(q))
  );

  const rows = liste.length
    ? liste.map(bi => `
        <tr>
          <td class="bi-num">${escHTML(bi.numero)}</td>
          <td>${escHTML(dateHeureFR(bi.dateIntervention))}</td>
          <td><b>${escHTML(bi.client)}</b></td>
          <td>${escHTML(bi.adresse)}</td>
          <td>${escHTML(bi.intervenant)}</td>
          <td class="text-center">${escHTML(bi.heures)} h</td>
          <td class="bi-actions-cell">
            <button type="button" class="bi-open" data-num="${escHTML(bi.numero)}">Voir</button>
            <button type="button" class="bi-delete" data-num="${escHTML(bi.numero)}" title="Supprimer ce BI">🗑️</button>
          </td>
        </tr>`).join("")
    : `<tr><td colspan="7" class="bi-empty">${tous.length ? "Aucun résultat." : "Aucun bon d'intervention enregistré pour le moment."}</td></tr>`;

  biListe.innerHTML = `
    <thead>
      <tr>
        <th>N°</th><th>Intervention</th><th>Client</th><th>Adresse</th>
        <th>Intervenant</th><th class="text-center">Heures</th><th>Actions</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>`;
}

function ouvrirBI(numero) {
  const bi = bonsInterventionGlobal[numero];
  if (!bi) return;

  const visa = safeImg(bi.visaResponsable);
  const sigClient = safeImg(bi.signatureClient);

  biDetail.innerHTML = `
    <div class="bi-doc-head">
      <div class="bi-brand">SEGOND CONSTRUCTION<small>45, rue Grimaldi - 98000 Monaco</small></div>
      <div class="bi-doc-num">Bon d'intervention n° ${escHTML(bi.numero)}</div>
    </div>

    <div class="bi-grid">
      <div class="bi-field"><span>Client</span>${escHTML(bi.client)}</div>
      <div class="bi-field"><span>Téléphone</span>${escHTML(bi.tel)}</div>
      <div class="bi-field full"><span>Adresse</span>${escHTML(bi.adresse)}</div>
    </div>

    <div class="bi-grid three">
      <div class="bi-field"><span>Date de l'appel</span>${escHTML(dateAppelFR(bi.dateAppel))}</div>
      <div class="bi-field"><span>Date et heure de l'intervention</span>${escHTML(dateHeureFR(bi.dateIntervention))}</div>
      <div class="bi-field"><span>Intervenant</span>${escHTML(bi.intervenant)}</div>
    </div>

    <div class="bi-grid">
      <div class="bi-field full"><span>Motif de l'intervention</span><div class="pre">${escHTML(bi.motif)}</div></div>
      <div class="bi-field full"><span>Travaux effectués</span><div class="pre">${escHTML(bi.travaux)}</div></div>
      <div class="bi-field full"><span>Matériel</span><div class="pre">${escHTML(bi.materiel)}</div></div>
    </div>

    <div class="bi-grid three">
      <div class="bi-field"><span>Nombre d'heures</span>${escHTML(bi.heures)} h</div>
      <div class="bi-field"><span>Déplacement</span>${escHTML(bi.deplacement)}</div>
      <div class="bi-field"><span>Nombre de personnels</span>${escHTML(bi.nbPersonnes)}</div>
    </div>

    <div class="bi-sigs">
      <div class="bi-sig">Visa responsable${visa ? `<img src="${visa}" alt="Visa responsable">` : ""}</div>
      <div class="bi-sig">Signature client${sigClient ? `<img src="${sigClient}" alt="Signature client">` : ""}</div>
    </div>

    <div style="margin-top:10px; font-size:0.75rem; color:#94a3b8;">
      Enregistré le ${escHTML(bi.creeLe ? new Date(bi.creeLe).toLocaleString("fr-FR") : "-")}
    </div>
  `;

  biModal.hidden = false;
}

function fermerBI() {
  if (biModal) biModal.hidden = true;
}

if (biSearch) biSearch.addEventListener("input", afficherBI);

if (biListe) {
  biListe.addEventListener("click", (e) => {
    const btnOpen = e.target.closest(".bi-open");
    const btnDelete = e.target.closest(".bi-delete");

    if (btnOpen) {
      ouvrirBI(btnOpen.dataset.num);
    }

    if (btnDelete) {
      const numero = btnDelete.dataset.num;
      if (confirm(`Êtes-vous sûr de vouloir supprimer définitivement le Bon d'intervention n° ${numero} ?`)) {
        const biRef = ref(db, `bons_intervention/items/${numero}`);
        remove(biRef)
          .then(() => {
            // La mise à jour s'effectue automatiquement grâce au onValue global
          })
          .catch((error) => {
            alert("Erreur lors de la suppression : " + error.message);
          });
      }
    }
  });
}

document.getElementById("bi-close")?.addEventListener("click", fermerBI);
biModal?.addEventListener("click", (e) => { if (e.target === biModal) fermerBI(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerBI(); });

document.getElementById("bi-print")?.addEventListener("click", () => {
  document.body.classList.remove("print-week-active", "print-month-active");
  document.body.classList.add("print-bi-active");
  window.print();
});

// =====================================================
// 🔐 ACCÈS EMPLOYÉS — GESTION DES CODES PIN
// VERSION PRÉPARATION / PRÉVISUALISATION
// =====================================================

const accessSearch = document.getElementById("access-search");
const accessList = document.getElementById("access-list");

// Génère un code PIN aléatoire à 4 chiffres
function genererPin4() {
  const valeurs = new Uint32Array(1);
  crypto.getRandomValues(valeurs);

  return String(valeurs[0] % 10000).padStart(4, "0");
}

// Affiche les employés dans l'onglet Accès employés
function afficherAccesEmployes() {
  if (!accessList) return;

  const recherche = (accessSearch?.value || "")
    .trim()
    .toLocaleLowerCase("fr");

  const aujourdHui = formatDateLocal(new Date());

  const salaries = [];

  // Récupération des employés déjà présents dans Firebase
  for (const [metier, groupe] of Object.entries(employesParMetier)) {
    if (!groupe || typeof groupe !== "object") continue;

    for (const [cle, employe] of Object.entries(groupe)) {
      const nom = extractEmpName(employe);

      if (!nom) continue;

      // Ne pas afficher les employés ayant quitté l'entreprise
      const fin =
        planningGlobal.finEmploye?.[metier]?.[nom] ||
        planningGlobal.finEmploye?.[nom];

      if (fin && fin < aujourdHui) continue;

      // Recherche par nom ou métier
      if (
        recherche &&
        !`${metier} ${nom}`
          .toLocaleLowerCase("fr")
          .includes(recherche)
      ) {
        continue;
      }

      salaries.push({
        metier,
        nom
      });
    }
  }

  // Tri alphabétique
  salaries.sort(
    (a, b) =>
      a.metier.localeCompare(b.metier, "fr") ||
      a.nom.localeCompare(b.nom, "fr")
  );

  accessList.replaceChildren();

  if (!salaries.length) {
    const vide = document.createElement("p");
    vide.className = "access-note";
    vide.textContent = "Aucun salarié correspondant.";

    accessList.appendChild(vide);
    return;
  }

  // Création d'une ligne pour chaque employé
  for (const salarie of salaries) {
    const ligne = document.createElement("div");
    ligne.className = "access-row";

    // Identité de l'employé
    const identite = document.createElement("div");

    const nom = document.createElement("strong");
    nom.textContent = salarie.nom;

    const metier = document.createElement("small");
    metier.textContent = salarie.metier;

    identite.append(nom, metier);

    // Zone des boutons
    const zone = document.createElement("div");

    zone.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    `;

    // Champ PIN
    const input = document.createElement("input");

    input.type = "text";
    input.inputMode = "numeric";
    input.maxLength = 4;
    input.placeholder = "PIN (4 chiffres)";
    input.value = codesPinEmployes[salarie.metier]?.[salarie.nom]?.pin || "";
    input.autocomplete = "off";

    input.setAttribute(
      "aria-label",
      `PIN de ${salarie.nom} (simulation)`
    );

    input.style.cssText = `
      width: 155px;
      max-width: 100%;
      padding: 9px;
    `;

    // Autoriser uniquement les chiffres
    input.addEventListener("input", () => {
      input.value = input.value
        .replace(/\D/g, "")
        .slice(0, 4);
    });

    // Bouton génération aléatoire
    const generer = document.createElement("button");

    generer.type = "button";
    generer.textContent = "🎲 Générer";

    generer.addEventListener("click", () => {
      input.value = genererPin4();
      input.focus();
    });

    // Bouton prévisualisation
    const preparer = document.createElement("button");

    preparer.type = "button";
    preparer.textContent = "💾 Enregistrer";

    preparer.addEventListener("click", async () => {
      if (!/^\d{4}$/.test(input.value)) {
        alert("Saisis exactement 4 chiffres.");
        return;
      }
      preparer.disabled = true;
      try {
        await set(ref(db, `codes_pin_employes/${salarie.metier}/${salarie.nom}`), {
          pin: input.value
        });
        alert(`PIN enregistré pour ${salarie.nom}.`);
      } catch (err) {
        alert("Erreur Firebase : " + err.message);
      } finally {
        preparer.disabled = false;
      }
    });

    // Assemblage
    zone.append(input, generer, preparer);

    ligne.append(identite, zone);

    accessList.appendChild(ligne);
  }
}

// Recherche dynamique
accessSearch?.addEventListener(
  "input",
  afficherAccesEmployes
);