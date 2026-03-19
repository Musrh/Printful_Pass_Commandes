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
  const bodyOrder = req.body; // commande envoyée par front-end

  if (!bodyOrder || !bodyOrder.items) {
    return res
      .status(400)
      .json({ success: false, message: "Données invalides" });
  }

  // 🔹 Convertir chaque produit id -> variant_id
  bodyOrder.items = bodyOrder.items.map((item) => ({
    ...item,
    variant_id: item.id, // le champ attendu par Printful
  }));

  // 🔹 Log pour confirmer variant_id
  console.log(`📦 Commande reçue : orderId=${orderId}`);
  bodyOrder.items.forEach((item, idx) => {
    console.log(
      `Produit #${idx + 1}: nom=${item.nom}, id=${item.id}, variant_id=${item.variant_id}, quantité=${item.quantity}`
    );
  });

  try {
    // 🔹 Envoi à Printful
    const response = await fetch(PRINTFUL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PRINTFUL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          name: bodyOrder.nomClient || bodyOrder.email,
          address1: bodyOrder.adresseLivraison || bodyOrder.adresse || "",
          city: bodyOrder.ville || "",
          country_code: bodyOrder.pays || "FR",
          zip: bodyOrder.codePostal || "",
        },
        items: bodyOrder.items.map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
        })),
      }),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data?.error?.message || "Erreur Printful");

    // 🔹 Mettre à jour Firestore pour marquer commande envoyée
    await db.collection("commandes").doc(orderId).update({
      envoyePrintful: true,
      printfulOrderId: data?.result?.id || null,
    });

    console.log(
      `✅ Commande ${orderId} envoyée à Printful avec succès. Printful order ID: ${data?.result?.id}`
    );

    res.json({
      success: true,
      message: "Commande envoyée à Printful ✅",
      data,
    });
  } catch (err) {
    console.error("❌ Erreur Printful:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`🚀 Printful service running on port ${PORT}`)
);
