import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_URL = "https://api.printful.com/orders";

// 🔹 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🔹 ROUTE ENVOI PRINTFUL
app.post("/admin/send-to-printful/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const bodyOrder = req.body;

    if (!bodyOrder || !bodyOrder.items) {
      return res.status(400).json({
        success: false,
        message: "Données invalides",
      });
    }

    console.log("📦 Commande reçue :", orderId);

    // 🔥 LOG VARIANT AVANT ENVOI
    bodyOrder.items.forEach((item) => {
      console.log(
        `Produit: ${item.nom} | ID reçu: ${item.id} | Quantité: ${item.quantity}`
      );
    });

    const response = await fetch(PRINTFUL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PRINTFUL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          name: bodyOrder.nomClient || bodyOrder.email,
          address1: bodyOrder.adresseLivraison || "Default Address",
          city: bodyOrder.ville || "Default City",
          country_code: bodyOrder.pays || "FR",
          zip: bodyOrder.codePostal || "00000",
        },
        items: bodyOrder.items.map((i) => ({
          variant_id: Number(i.id), // ⚠️ ici tu envoies l'id actuel
          quantity: Number(i.quantity),
        })),
      }),
    });

    const data = await response.json();

    console.log("📦 Réponse Printful :", data);

    if (!response.ok) {
      console.error("❌ Erreur Printful :", data);
      return res.status(400).json({
        success: false,
        message: data?.error?.message || "Erreur Printful",
      });
    }

    // 🔹 Update Firestore
    await db.collection("commandes").doc(orderId).update({
      envoyePrintful: true,
      printfulOrderId: data?.result?.id || null,
    });

    console.log(
      `✅ Commande ${orderId} envoyée avec succès. Printful ID: ${data?.result?.id}`
    );

    res.json({
      success: true,
      printfulOrderId: data?.result?.id,
    });

  } catch (err) {
    console.error("🔥 ERREUR SERVEUR :", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`🚀 Printful service running on port ${PORT}`)
);
