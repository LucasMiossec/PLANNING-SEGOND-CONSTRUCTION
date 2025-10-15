// === IMPORT DES MODULES ===
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");

// === CONFIGURATION DU SERVEUR ===
const app = express();
const PORT = 3000;
const DB_FILE = "./database.json";

app.use(cors());
app.use(bodyParser.json());

// === FONCTIONS UTILES ===

// Charger les données depuis le fichier JSON
function loadData() {
  try {
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.log("⚠️ Aucune base existante, création d'une nouvelle...");
    return { planning: {}, employes: {}, chantiers: {} };
  }
}

// Sauvegarder les données dans le fichier JSON
function saveData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// === ROUTES DU SERVEUR ===

// Obtenir les données
app.get("/getPlanning", (req, res) => {
  const data = loadData();
  res.json(data);
});

// Sauvegarder les données
app.post("/savePlanning", (req, res) => {
  const data = req.body;
  saveData(data);
  res.json({ success: true, message: "✅ Données sauvegardées avec succès !" });
});

// === DÉMARRAGE DU SERVEUR ===
app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});
