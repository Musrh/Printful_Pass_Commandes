import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(express.json());

// Autoriser le front-end
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_URL = "https://api.printful.com/orders";

// 🔹 Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 🔹 Route pour envoyer une commande Firestore à Printful
app.post("/sendtoprintful/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const bodyOrder = req.body;

    if (!bodyOrder || !bodyOrder.items) {
      return res.status(400).json({ success: false, message: "Données invalides" });
    }

    console.log("📦 Commande reçue du front-end :", orderId);

    const finalItems = [];

    for (const item of bodyOrder.items) {
      const productRef = await db.collection("PrintfulProducts").doc(String(item.id)).get();

      if (!productRef.exists) {
        throw new Error(`Produit ${item.id} introuvable dans Firestore`);
      }

      const productData = productRef.data();

      const variant = productData.variants.find(
        v => v.size === item.taille && v.color === item.couleur
      );

      if (!variant) {
        throw new Error(`Variant introuvable pour ${item.nom} (${item.couleur}/${item.taille})`);
      }

      console.log(`✅ Variant trouvé pour ${item.nom} : ${variant.id}`);

      finalItems.push({
        variant_id: Number(variant.id),
        quantity: Number(item.quantity),
      });
    }

    console.log("📦 Items envoyés à Printful :", finalItems);

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
        items: finalItems,
      }),
    });

    const data = await response.json();
    console.log("📦 Réponse Printful :", data);

    if (!response.ok) {
      return res.status(400).json({ success: false, message: data?.error?.message || "Erreur Printful" });
    }

    // 🔹 Marquer la commande comme envoyée dans Firestore
    await db.collection("commandes").doc(orderId).update({
      envoyePrintful: true,
      printfulOrderId: data?.result?.id || null,
    });

    res.json({
      success: true,
      message: `Commande ${orderId} envoyée à Printful ✅`,
      printfulOrderId: data?.result?.id,
    });

  } catch (err) {
    console.error("🔥 ERREUR SERVEUR :", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Printful service running on port ${PORT}`));
