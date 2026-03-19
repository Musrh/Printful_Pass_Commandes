// printfulService.js
import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_URL = "https://api.printful.com/orders";

// 🔹 Initialisation Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 🔹 Route pour envoyer une commande Firestore à Printful
app.post("/admin/send-to-printful/:orderId", async (req, res) => {
  const { orderId } = req.params;
  const order = req.body;

  if (!order || !order.items || !order.items.length) {
    return res
      .status(400)
      .json({ success: false, message: "Données invalides ou items manquants" });
  }

  // 🔹 Transformation id → variant_id
  const itemsForPrintful = order.items.map((i) => {
    const variant_id = i.variant_id || i.id; // prend id si variant_id non défini
    console.log(
      `Produit "${i.nom}" - quantity: ${i.quantity} | ID: ${i.id} | Variant ID: ${variant_id}`
    );
    return {
      variant_id,
      quantity: i.quantity,
    };
  });

  // 🔹 Préparer recipient avec valeurs par défaut si vide
  const recipient = {
    name: order.nomClient || order.email || "Client",
    address1: order.adresseLivraison || "Adresse inconnue",
    city: order.ville || "Ville inconnue",
    country_code: order.pays || "FR",
    zip: order.codePostal || "00000",
  };

  console.log("🔹 Recipient envoyé à Printful:", recipient);
  console.log("🔹 Items envoyés à Printful:", itemsForPrintful);

  try {
    const response = await fetch(PRINTFUL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PRINTFUL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient,
        items: itemsForPrintful,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Erreur Printful:", data?.error?.message || data);
      return res
        .status(500)
        .json({ success: false, message: data?.error?.message || "Erreur Printful" });
    }

    // 🔹 Mise à jour Firestore
    await db.collection("commandes").doc(orderId).update({ envoyePrintful: true });

    console.log(
      `✅ Commande ${orderId} envoyée à Printful avec succès. Printful order ID: ${data?.result?.id}`
    );

    res.json({
      success: true,
      message: `Commande ${orderId} envoyée à Printful ✅`,
      printfulOrderId: data?.result?.id,
    });
  } catch (err) {
    console.error("❌ Erreur lors de l'envoi à Printful:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`🚀 Printful service running on port ${PORT}`)
);
