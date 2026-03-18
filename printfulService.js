// printfulService.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// ----------------------------
// 🔐 CONFIG
// ----------------------------
const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;

if (!PRINTFUL_API_KEY) {
  console.error("❌ PRINTFUL_API_KEY manquante dans Railway !");
  process.exit(1);
}

const PRINTFUL_URL = "https://api.printful.com/orders";

// ----------------------------
// 🚀 CREATE PRINTFUL ORDER
// ----------------------------
app.post("/create-order", async (req, res) => {
  console.log("📦 Requête reçue du backend paiement");

  const { order } = req.body;

  if (!order) {
    console.error("❌ Aucune donnée order reçue");
    return res.status(400).json({ success: false, message: "Order manquant" });
  }

  console.log("📝 Données reçues :", JSON.stringify(order, null, 2));

  try {
    // 🔎 Validation minimale
    if (!order.nomClient || !order.adresse || !order.pays) {
      throw new Error("Informations client incomplètes");
    }

    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      throw new Error("Aucun item dans la commande");
    }

    // ⚠️ Vérification variant_id obligatoire
    order.items.forEach((item) => {
      if (!item.variant_id) {
        throw new Error(
          `variant_id manquant pour produit ${item.nom || "inconnu"}`
        );
      }
    });

    // ----------------------------
    // 🧾 Construction corps Printful
    // ----------------------------
    const body = {
      recipient: {
        name: order.nomClient,
        address1: order.adresse,
        city: order.ville || "Unknown",
        country_code: order.pays,
        zip: order.codePostal || "00000",
      },
      items: order.items.map((i) => ({
        variant_id: Number(i.variant_id),
        quantity: Number(i.quantity),
      })),
    };

    console.log("📤 Envoi vers Printful :", JSON.stringify(body, null, 2));

    // ----------------------------
    // 📡 Appel API Printful
    // ----------------------------
    const response = await fetch(PRINTFUL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PRINTFUL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    console.log("📥 Réponse API Printful :", JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(data?.error?.message || "Erreur API Printful");
    }

    console.log("✅ COMMANDE CRÉÉE CHEZ PRINTFUL !");
    console.log("🆔 Printful Order ID :", data.result?.id);

    res.json({
      success: true,
      printfulOrderId: data.result?.id,
      fullResponse: data,
    });

  } catch (err) {
    console.error("❌ ERREUR PRINTFUL :", err.message);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ----------------------------
// 🩺 HEALTH CHECK
// ----------------------------
app.get("/", (req, res) => {
  res.json({
    status: "Printful Service Running",
    message: "Service opérationnel",
  });
});

// ----------------------------
// 🚀 START SERVER
// ----------------------------
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Printful service running on port ${PORT}`);
});
