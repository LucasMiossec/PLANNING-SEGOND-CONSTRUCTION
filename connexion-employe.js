import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { firebaseConfig } from "./auth-config.js";
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const metier = document.getElementById("metier");
const employe = document.getElementById("employe");
const code = document.getElementById("code");
const message = document.getElementById("message");
const form = document.getElementById("connexion-form");
const bouton = document.getElementById("btn-connexion");
let employes = {}, planning = {};
function nomDe(e) { return typeof e === "string" ? e.trim() : String(e?.nom || e?.name || e?.prenom || "").trim(); }
function option(select, value, label) { const o = document.createElement("option"); o.value=value; o.textContent=label; select.append(o); }
function actualiserEmployes() {
  employe.replaceChildren(); option(employe,"","-- Sélectionner mon prénom --");
  const groupe=employes[metier.value] || {};
  const aujourdHui = new Date();
  const jour = `${aujourdHui.getFullYear()}-${String(aujourdHui.getMonth()+1).padStart(2,"0")}-${String(aujourdHui.getDate()).padStart(2,"0")}`;
  [...new Set(Object.values(groupe).map(nomDe).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr")).forEach(n=>{
    const fin=planning.finEmploye?.[metier.value]?.[n] || planning.finEmploye?.[n];
    if(!fin || fin >= jour) option(employe,n,n);
  });
  employe.disabled=!metier.value;
}
try {
  const snap=await get(ref(db)); const data=snap.val() || {};
  employes=data.employes || {}; planning=data.planning || {};
  Object.keys(employes).sort((a,b)=>a.localeCompare(b,"fr")).forEach(m=>option(metier,m,m));
  const preMetier=sessionStorage.getItem("employe_metier_selectionne") || localStorage.getItem("metier") || "";
  const preNom=sessionStorage.getItem("employe_nom_selectionne") || localStorage.getItem("employe") || "";
  if(employes[preMetier]) metier.value=preMetier;
  actualiserEmployes();
  if([...employe.options].some(o=>o.value===preNom)) employe.value=preNom;
} catch(e) { message.textContent="Impossible de charger les salariés : "+e.message; }
metier.addEventListener("change",actualiserEmployes);
code.addEventListener("input",()=>{code.value=code.value.replace(/\D/g,"").slice(0,4);});
form.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!metier.value || !employe.value || !/^\d{4}$/.test(code.value)) {message.textContent="Sélectionne ton métier, ton prénom et un PIN à 4 chiffres.";return;}
  bouton.disabled=true; message.textContent="Vérification...";
  try {
    const s=await get(ref(db,`codes_pin_employes/${metier.value}/${employe.value}/pin`));
    if(!s.exists() || String(s.val())!==code.value) {message.textContent="Code PIN incorrect ou non configuré.";return;}
    sessionStorage.setItem("segond_pin_session",JSON.stringify({metier:metier.value,employe:employe.value}));
    window.location.replace("feuille-heures.html");
  } catch(err) {message.textContent="Erreur de connexion : "+err.message;}
  finally {bouton.disabled=false;}
});
