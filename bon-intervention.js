// === FIREBASE (CDN v11) ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

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

// Structure en base :
//   bons_intervention/compteur            -> dernier numéro attribué (nombre)
//   bons_intervention/items/0001, 0002... -> les BI enregistrés
const compteurRef = ref(db, "bons_intervention/compteur");

// === DOM ===
const $ = (id) => document.getElementById(id);
const form = $("biForm");
const btnSave = $("btnSave");
const erreursBox = $("erreurs");
const prochainNumero = $("prochainNumero");

const CHAMPS = {
  client: "Client",
  adresse: "Adresse",
  tel: "Téléphone",
  dateAppel: "Date de l'appel",
  dateIntervention: "Date et heure de l'intervention",
  intervenant: "Intervenant",
  motif: "Motif de l'intervention",
  travaux: "Travaux effectués",
  materiel: "Matériel",
  heures: "Nombre d'heures",
  deplacement: "Déplacement",
  nbPersonnes: "Nombre de personnels"
};

const DRAFT_KEY = "bi_brouillon";

// === NAVIGATION ===
$("retour").addEventListener("click", () => (window.location.href = "employes.html"));
$("btnFermer").addEventListener("click", () => (window.location.href = "employes.html"));

// === PREMIER NUMÉRO DISPONIBLE ===
const itemsRef = ref(db, "bons_intervention/items");
const pad4 = n => String(n).padStart(4, "0");
let numerosOccupes = new Set();
function premierLibre(occupes) {
  let n = 1;
  while (occupes.has(pad4(n))) n++;
  return pad4(n);
}
onValue(itemsRef, snap => {
  numerosOccupes = new Set(Object.keys(snap.val() || {}));
  prochainNumero.textContent = premierLibre(numerosOccupes);
});

// === SIGNATURES (canvas tactile) ===
function creerPad(canvas) {
  const ctx = canvas.getContext("2d");
  let dessine = false;
  let vide = true;

  function init() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    vide = true;
  }

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener("pointerdown", (e) => {
    dessine = true;
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    vide = false;
    canvas.classList.remove("err");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dessine) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  const stop = () => (dessine = false);
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);

  init();
  return {
    init,
    estVide: () => vide,
    data: () => canvas.toDataURL("image/jpeg", 0.6)
  };
}

const padVisa = creerPad($("padVisa"));
const padClient = creerPad($("padClient"));
const pads = { visa: padVisa, client: padClient };

document.querySelectorAll(".sig-clear").forEach((b) =>
  b.addEventListener("click", () => pads[b.dataset.pad].init())
);

// === BROUILLON LOCAL (si le téléphone se ferme, on ne perd rien) ===
// Un brouillon n'est PAS un BI : il ne reçoit aucun numéro.
function sauverBrouillon() {
  const d = {};
  Object.keys(CHAMPS).forEach((k) => (d[k] = $(k).value));
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) {}
}

function chargerBrouillon() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); } catch (e) {}
  Object.keys(CHAMPS).forEach((k) => { if (d[k] !== undefined) $(k).value = d[k]; });

  // Préremplissages
  if (!$("intervenant").value) {
    $("intervenant").value = localStorage.getItem("employe") || "";
  }
  if (!$("dateAppel").value) {
    const t = new Date();
    $("dateAppel").value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }
}

form.addEventListener("input", (e) => {
  e.target.classList.remove("err");
  sauverBrouillon();
});

function viderFormulaire() {
  Object.keys(CHAMPS).forEach((k) => ($(k).value = ""));
  padVisa.init();
  padClient.init();
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  chargerBrouillon();
  erreursBox.hidden = true;
}

$("btnReset").addEventListener("click", () => {
  if (confirm("Vider tout le brouillon ?")) viderFormulaire();
});

// === VALIDATION : le BI doit être TOTALEMENT rempli ===
function valider() {
  const manques = [];
  Object.entries(CHAMPS).forEach(([k, label]) => {
    const el = $(k);
    el.classList.remove("err");
    const v = el.value.trim();
    let ok = v !== "";
    if (k === "heures") ok = parseFloat(v) > 0;
    if (k === "nbPersonnes") ok = parseInt(v, 10) >= 1;
    if (!ok) { manques.push(label); el.classList.add("err"); }
  });
  if (padVisa.estVide()) { manques.push("Visa responsable"); $("padVisa").classList.add("err"); }
  if (padClient.estVide()) { manques.push("Signature client"); $("padClient").classList.add("err"); }
  return manques;
}

// === ENREGISTREMENT ===
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const manques = valider();
  if (manques.length) {
    erreursBox.hidden = false;
    erreursBox.innerHTML = `<b>BI incomplet — il n'est pas enregistré et ne prend pas de numéro.</b><ul>${manques.map((m) => `<li>${m}</li>`).join("")}</ul>`;
    erreursBox.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  erreursBox.hidden = true;

  if (!navigator.onLine) {
    alert("Pas de connexion. Le BI n'est pas enregistré (le brouillon est conservé). Réessaie quand le réseau revient.");
    return;
  }

  btnSave.disabled = true;
  btnSave.textContent = "Enregistrement…";

  try {
    const bi = {
      metier: localStorage.getItem("metier") || "",
      creeLe: new Date().toISOString(),
      visaResponsable: padVisa.data(),
      signatureClient: padClient.data()
    };
    Object.keys(CHAMPS).forEach(k => bi[k] = $(k).value.trim());

    // Attribution et enregistrement atomiques pour éviter les doublons.
    let numeroAttribue = null;
    const res = await runTransaction(itemsRef, current => {
      const items = current || {};
      const numero = premierLibre(new Set(Object.keys(items)));
      numeroAttribue = numero;
      return { ...items, [numero]: { ...bi, numero } };
    }, { applyLocally: false });
    if (!res.committed || !numeroAttribue) throw new Error("Enregistrement non validé");

    try { localStorage.removeItem(DRAFT_KEY); } catch (e2) {}
    $("succesNum").textContent = "BI n° " + numeroAttribue;
    $("succes").hidden = false;
  } catch (err) {
    console.error(err);
    alert("Échec de l'enregistrement. Ton brouillon est conservé. Réessaie.");
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = "💾 Enregistrer le bon d'intervention";
  }
});

$("btnNouveau").addEventListener("click", () => {
  $("succes").hidden = true;
  viderFormulaire();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// === INIT ===
chargerBrouillon();