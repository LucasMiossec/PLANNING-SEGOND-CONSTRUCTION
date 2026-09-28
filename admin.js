import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, get, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

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
const dashboardContainer = document.getElementById("dashboard-container");
const detailsContainer = document.getElementById("details-container");

let dateCourante = new Date();
let employesParMetier = {};
let planningGlobal = {};

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

// ================= SYNC ET CHARGEMENT =================
onValue(ref(db), (snap) => {
  const data = snap.val() || {};
  employesParMetier = data.employes || {};
  planningGlobal = data.planning || {};
  chargerDonneesSemaine();
});

async function chargerDonneesSemaine() {
  const lundiDate = getLundi(dateCourante);
  const lundiKey = formatDateISO(lundiDate);
  weekInput.value = lundiKey;

  const dimancheDate = new Date(lundiDate);
  dimancheDate.setDate(lundiDate.getDate() + 6);

  if (weekRangeSpan) {
    weekRangeSpan.textContent = `(Du Lundi ${formatDateFR(lundiDate)} au Dimanche ${formatDateFR(dimancheDate)})`;
  }

  const snapFH = await get(ref(db, `feuilles_heures/${lundiKey}`));
  const feuillesHeures = snapFH.val() || {};

  genererDashboard(feuillesHeures, lundiKey);
  genererDetails(feuillesHeures, lundiKey);
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
    const list = Array.isArray(employesParMetier[metier]) 
      ? employesParMetier[metier] 
      : Object.values(employesParMetier[metier]);

    const actifs = list.filter(e => {
      const dateFin = planningGlobal.finEmploye?.[metier]?.[e];
      return !dateFin || dateFin > lundiKey;
    });

    const uniques = [...new Set(actifs)];
    if (uniques.length === 0) return;

    const groupDiv = document.createElement("div");
    groupDiv.className = "metier-group";

    let tableRowsHTML = "";

    uniques.sort().forEach(emp => {
      const lignesEmp = feuillesHeures[emp] || [];
      let totalH = 0;

      lignesEmp.forEach(l => {
        totalH += parseFloat(l.heures) || 0;
      });

      let statusClass = "status-white";
      let statusText = "Non rempli (0h)";

      if (totalH >= 39) {
        statusClass = "status-green";
        statusText = "Complété";
      } else if (totalH > 0) {
        statusClass = "status-yellow";
        statusText = "En cours";
      }

      tableRowsHTML += `
        <tr>
          <td class="emp-name"><b>${emp}</b></td>
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
    let list = Array.isArray(employesParMetier[metier]) 
      ? employesParMetier[metier] 
      : Object.values(employesParMetier[metier]);

    list.forEach(e => {
      const dateFin = planningGlobal.finEmploye?.[metier]?.[e];
      if (!dateFin || dateFin > lundiKey) {
        tousLesEmployesActifs.push(e);
      }
    });
  });

  tousLesEmployesActifs = [...new Set(tousLesEmployesActifs)];

  if (tousLesEmployesActifs.length === 0) {
    detailsContainer.innerHTML = `<div class="card empty-card">Aucun employé actif pour cette semaine.</div>`;
    return;
  }

  let auMoinsUneFeuille = false;

  tousLesEmployesActifs.sort().forEach(emp => {
    const lignes = feuillesHeures[emp] || [];
    let totalH = 0;

    let rowsHTML = "";
    lignes.forEach(ln => {
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

    if (rowsHTML !== "") {
      auMoinsUneFeuille = true;
      const card = document.createElement("div");
      card.className = "card-emp";
      card.innerHTML = `
        <div class="card-header">
          <h3>👤 ${emp}</h3>
          <span class="total-badge">Total : ${totalH} H</span>
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
          <tbody>${rowsHTML}</tbody>
        </table>
      `;
      detailsContainer.appendChild(card);
    }
  });

  if (!auMoinsUneFeuille) {
    detailsContainer.innerHTML = `<div class="card empty-card" style="padding:20px; background:#1e293b; border-radius:8px; text-align:center;">Aucune feuille d'heures remplie pour les employés actifs cette semaine.</div>`;
  }
}

// ================= 3. EXPORT / IMPRESSION PDF AVEC COULEURS DE L'APPLICATION =================
printBtn.onclick = async () => {
  const lundiDate = getLundi(dateCourante);
  const lundiKey = formatDateISO(lundiDate);
  const dimancheDate = new Date(lundiDate);
  dimancheDate.setDate(lundiDate.getDate() + 6);

  const periodeStr = `Du Lundi ${formatDateFR(lundiDate)} au Dimanche ${formatDateFR(dimancheDate)}`;

  const snapFH = await get(ref(db, `feuilles_heures/${lundiKey}`));
  const feuillesHeures = snapFH.val() || {};

  // --- HTML Synthèse avec styles de couleurs originaux ---
  let synthHTML = "";
  Object.keys(employesParMetier).forEach(metier => {
    let list = Array.isArray(employesParMetier[metier]) 
      ? employesParMetier[metier] 
      : Object.values(employesParMetier[metier]);

    const actifs = list.filter(e => {
      const dateFin = planningGlobal.finEmploye?.[metier]?.[e];
      return !dateFin || dateFin > lundiKey;
    });

    if (actifs.length > 0) {
      synthHTML += `
        <tr style="background:#1e293b; color:#10b981; font-weight:bold;">
          <td colspan="3" style="padding:8px 12px; border:1px solid #334155; font-size:14px; text-transform:uppercase;">${metier}</td>
        </tr>
      `;
      actifs.sort().forEach(emp => {
        const lignes = feuillesHeures[emp] || [];
        let total = 0;
        lignes.forEach(l => total += parseFloat(l.heures) || 0);

        let statusBg = "#f8fafc";
        let statusColor = "#475569";
        let statusBorder = "#cbd5e1";
        let statusText = "Non rempli (0h)";

        if (total >= 39) {
          statusBg = "#dcfce7";
          statusColor = "#15803d";
          statusBorder = "#86efac";
          statusText = "Complété";
        } else if (total > 0) {
          statusBg = "#fef9c3";
          statusColor = "#a16207";
          statusBorder = "#fde047";
          statusText = "En cours";
        }

        synthHTML += `
          <tr style="background:#fff;">
            <td style="border:1px solid #cbd5e1; padding:8px 12px; font-weight:600; color:#0f172a;">${emp}</td>
            <td style="border:1px solid #cbd5e1; padding:8px 12px; text-align:center; font-weight:bold; color:#0f172a;">${total} h</td>
            <td style="border:1px solid #cbd5e1; padding:8px 12px; text-align:center;">
              <span style="background:${statusBg}; color:${statusColor}; border:1px solid ${statusBorder}; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:bold; display:inline-block;">${statusText}</span>
            </td>
          </tr>
        `;
      });
    }
  });

  // --- HTML Détail des Feuilles d'Heures ---
  let detailHTML = "";
  
  // Récupérer tous les employés actifs
  let tousLesActifs = [];
  Object.keys(employesParMetier).forEach(metier => {
    let list = Array.isArray(employesParMetier[metier]) ? employesParMetier[metier] : Object.values(employesParMetier[metier]);
    list.forEach(e => {
      const dateFin = planningGlobal.finEmploye?.[metier]?.[e];
      if (!dateFin || dateFin > lundiKey) tousLesActifs.push(e);
    });
  });
  tousLesActifs = [...new Set(tousLesActifs)].sort();

  tousLesActifs.forEach(emp => {
    const lignes = feuillesHeures[emp] || [];
    let rows = "";
    let totalEmp = 0;

    lignes.forEach(l => {
      const h = parseFloat(l.heures) || 0;
      if (h > 0 || (l.chantier && l.chantier !== "")) {
        totalEmp += h;
        rows += `
          <tr style="background:#fff;">
            <td style="border:1px solid #cbd5e1; padding:6px 10px;"><b>${l.jour || ""}</b> <small style="color:#64748b;">(${l.date || ""})</small></td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; color:#0f172a;">${l.chantier || "-"}</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; text-align:center; font-weight:bold; color:#0f172a;">${l.heures || 0} h</td>
            <td style="border:1px solid #cbd5e1; padding:6px 10px; color:#475569;">${l.commentaire || ""}</td>
          </tr>
        `;
      }
    });

    if (rows !== "") {
      detailHTML += `
        <div style="margin-top:20px; page-break-inside: avoid;">
          <div style="background:#0f172a; color:#fff; padding:8px 12px; border-radius:6px 6px 0 0; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:bold; font-size:15px;">👤 ${emp}</span>
            <span style="background:#059669; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:13px;">Total : ${totalEmp} H</span>
          </div>
          <table style="width:100%; border-collapse:collapse; margin-top:0;">
            <thead>
              <tr style="background:#f1f5f9; color:#334155; font-size:12px; text-align:left;">
                <th style="border:1px solid #cbd5e1; padding:6px 10px; width:22%;">Jour</th>
                <th style="border:1px solid #cbd5e1; padding:6px 10px; width:38%;">Chantier</th>
                <th style="border:1px solid #cbd5e1; padding:6px 10px; width:10%; text-align:center;">H</th>
                <th style="border:1px solid #cbd5e1; padding:6px 10px; width:30%;">Observations</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }
  });

  const printFullHTML = `
    <div style="font-family: Arial, sans-serif; padding:15px; color:#0f172a; background:#fff;">
      
      <!-- EN-TÊTE PRINCIPAL -->
      <div style="text-align:center; border-bottom:3px solid #b60000; padding-bottom:12px; margin-bottom:20px;">
        <h1 style="color:#b60000; margin:0; font-size:24px; text-transform:uppercase; letter-spacing:1px;">SEGOND CONSTRUCTION</h1>
        <h2 style="margin:6px 0 0 0; font-size:16px; color:#334155;">📊 RÉCAPITULATIF DIRECTION — ${periodeStr.toUpperCase()}</h2>
      </div>

      <!-- SECTION 1 : DASHBOARD SYNTHÈSE -->
      <h3 style="color:#0f172a; border-bottom:2px solid #0f172a; padding-bottom:5px; margin-top:0;">📌 Suivi Synthétique des Saisies</h3>
      
      <table style="width:100%; border-collapse:collapse; margin-bottom:30px;">
        <thead>
          <tr style="background:#b60000; color:#fff;">
            <th style="border:1px solid #991b1b; padding:10px; text-align:left; font-size:14px;">Employé</th>
            <th style="border:1px solid #991b1b; padding:10px; text-align:center; width:20%; font-size:14px;">Total Heures</th>
            <th style="border:1px solid #991b1b; padding:10px; text-align:center; width:25%; font-size:14px;">Statut</th>
          </tr>
        </thead>
        <tbody>
          ${synthHTML}
        </tbody>
      </table>

      <!-- SECTION 2 : DÉTAILS DES HEURES -->
      <h3 style="color:#0f172a; border-bottom:2px solid #0f172a; padding-bottom:5px; margin-top:30px; page-break-before: auto;">📋 Détail des Feuilles d'Heures Saisies</h3>
      ${detailHTML || '<p style="color:#64748b; font-style:italic;">Aucune feuille d\'heures détaillée remplie pour cette semaine.</p>'}

    </div>
  `;

  localStorage.setItem("planningHTML", printFullHTML);
  localStorage.setItem("planningDate", `Recap_Direction_${lundiKey}`);
  window.open("print.html", "_blank");
};

// ================= ÉVÉNEMENTS =================
prevBtn.onclick = () => {
  dateCourante.setDate(dateCourante.getDate() - 7);
  chargerDonneesSemaine();
};

nextBtn.onclick = () => {
  dateCourante.setDate(dateCourante.getDate() + 7);
  chargerDonneesSemaine();
};

weekInput.onchange = () => {
  dateCourante = new Date(weekInput.value);
  chargerDonneesSemaine();
};

refreshBtn.onclick = () => chargerDonneesSemaine();