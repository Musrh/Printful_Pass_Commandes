import express from "express";
import fetch from "node-fetch";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const PRINTFUL_URL = "https://api.printful.com/orders";

// 🔹 Firebase admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 🔹 Route pour envoyer une commande Firestore à Printful
app.post("/admin/send-to-printful/:orderId", async (req, res) => {
  const { orderId } = req.params;
  const order = req.body;

  if (!order || !order.items) {
    return res.status(400).json({ success: false, message: "Données invalides" });
  }

  try {
    // 🔹 Log côté serveur les produits avec variant_id
    console.log(`📦 Commande ${orderId} - Items à envoyer :`);
    order.items.forEach((item) => {
      console.log(`Nom: ${item.nom} | Quantité: ${item.quantity} | Variant ID: ${item.variant_id}`);
    });

    const response = await fetch(PRINTFUL_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PRINTFUL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          name: order.nomClient || order.email,
          address1: order.adresseLivraison,
          city: order.ville || "",
          country_code: order.pays,
          zip: order.codePostal || "",
        },
        items: order.items.map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
        })),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Erreur Printful :", data);
      throw new Error(data?.error?.message || "Erreur Printful");
    }

    // 🔹 Mettre à jour Firestore pour marquer commande envoyée
    await db.collection("commandes").doc(orderId).update({ envoyePrintful: true });

    console.log(`✅ Commande ${orderId} envoyée à Printful avec succès. Printful order ID: ${data?.result?.id}`);

    // 🔹 Retour côté front pour afficher confirmation
    res.json({
      success: true,
      message: `Commande ${orderId} envoyée à Printful`,
      printfulOrderId: data?.result?.id || null,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Printful service running on port ${PORT}`));
