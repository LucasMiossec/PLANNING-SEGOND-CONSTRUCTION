const metierInput = document.getElementById("metier");
const employeSelect = document.getElementById("employe");
const voirPlanningBtn = document.getElementById("voirPlanning");
const planningContainer = document.getElementById("planningContainer");

document.getElementById("retour").addEventListener("click", () => {
  window.location.href = "index.html";
});

let employesParMetier = JSON.parse(localStorage.getItem("employesSegond")) || {
  electricite: ["André", "Christopher", "Kevin", "Ali man", "Rachide", "Gabriel"],
  plomberie: ["Fernando", "Olivier", "Miguel", "Daniel"],
  menuiserie: ["Rémy"],
  peinture: ["Cyriaque", "Carlos","Kévin", "Denis", "Olivier", "Francesco"],
  maconnerie: ["Rosario","Gilberto","Alex","Jimmy","Luciano","Angelo","Florian","Simone"]
};

let planning = JSON.parse(localStorage.getItem("planningSegond")) || {};

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

voirPlanningBtn.addEventListener("click", () => {
  const metier = metierInput.value;
  const employe = employeSelect.value;
  if (!metier || !employe) return alert("Sélectionne ton métier et ton prénom !");

  afficherPlanning(employe, metier);
});

function afficherPlanning(employe, metier) {
  planningContainer.innerHTML = "";

  // Calcul de la semaine en cours (lundi à vendredi)
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