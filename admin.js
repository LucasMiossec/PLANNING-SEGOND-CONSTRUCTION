import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

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

const adminContent = document.getElementById("admin-content");
const weekInput = document.getElementById("week-date");
let dateCourante = new Date();

// Outil : Trouver le lundi
function getLundi(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const res = new Date(d.setDate(diff));
  res.setHours(0,0,0,0);
  return res;
}

async function chargerTousLesRapports() {
  const lundiKey = getLundi(dateCourante).toISOString().split('T')[0];
  adminContent.innerHTML = `<p style="text-align:center;">Chargement de la semaine du ${lundiKey}...</p>`;

  try {
    const snapshot = await get(ref(db, `feuilles_heures/${lundiKey}`));
    const data = snapshot.val();

    if (!data) {
      adminContent.innerHTML = `<div class="status-none">Aucun employé n'a encore rempli sa feuille pour cette semaine.</div>`;
      return;
    }

    adminContent.innerHTML = ""; // On vide

    // On boucle sur chaque employé trouvé dans la base
    for (const [nomEmploye, lignes] of Object.entries(data)) {
      let totalHeures = 0;
      let htmlLignes = "";

      lignes.forEach(l => {
        totalHeures += parseFloat(l.heures) || 0;
        if (parseFloat(l.heures) > 0) {
          htmlLignes += `<tr>
            <td>${l.jour}</td>
            <td>${l.chantier}</td>
            <td>${l.heures}h</td>
            <td>${l.commentaire || ""}</td>
          </tr>`;
        }
      });

      const card = document.createElement("div");
      card.className = "card-employe";
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3>👤 ${nomEmploye.toUpperCase()}</h3>
            <span class="status-ok">Total : ${totalHeures} H</span>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-top:10px; background: rgba(0,0,0,0.2);">
            <thead>
                <tr style="font-size:0.8em; text-align:left; opacity:0.7;">
                    <th>Jour</th><th>Chantier</th><th>H</th><th>Obs.</th>
                </tr>
            </thead>
            <tbody>${htmlLignes}</tbody>
        </table>
      `;
      adminContent.appendChild(card);
    }
  } catch (error) {
    adminContent.innerHTML = `<p style="color:red;">Erreur : ${error.message}</p>`;
  }
}

// Navigation
document.getElementById("prev-week").onclick = () => { dateCourante.setDate(dateCourante.getDate() - 7); mettreAJour(); };
document.getElementById("next-week").onclick = () => { dateCourante.setDate(dateCourante.getDate() + 7); mettreAJour(); };
document.getElementById("btn-refresh").onclick = () => { chargerTousLesRapports(); };

function mettreAJour() {
  weekInput.value = dateCourante.toISOString().split('T')[0];
  chargerTousLesRapports();
}

// Init
weekInput.value = dateCourante.toISOString().split('T')[0];
chargerTousLesRapports();